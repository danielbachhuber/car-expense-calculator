import type { Car, CarSavings, Household } from './types';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type TimelinePoint = {
  /** Fractional year used as chart x-value. */
  x: number;
  balance: number;
  /** Total outstanding loan balance across all cars at this point (including any new loan taken at replacement). */
  totalLoanBalance: number;
  /** Total equity across all unreplaced cars: projected resale value minus outstanding loan balance. */
  totalCarEquity: number;
  /** Human-readable label shown on the x-axis (e.g. "2031"). Empty for non-tick points. */
  label: string;
  /** Human-readable month + year for tooltip (e.g. "Nov 2026"). */
  monthYear: string;
  /** Cars replaced at this exact event (only set on the post-replacement point). */
  replacements: string[];
};

/**
 * Projects a car's trade-in value at a target (year, month) using a depreciation
 * rate derived from currentValue → estimatedResaleValue over the original estimate horizon.
 *
 * estimatedResaleYear is the stable anchor — it doesn't change when the user
 * adjusts the replacement year via the stepper.
 */
export function getProjectedResaleValue(
  car: Car,
  targetYear: number,
  targetMonth: number,
  currentYear: number,
  currentMonth: number,
): number {
  const stored = car.estimatedResaleValue ?? 0;
  if (stored <= 0 || car.currentValue <= 0) return stored;

  const anchorYear = car.estimatedResaleYear ?? car.replacementYear;
  const anchorFY = anchorYear; // anchor is always January of that year

  const currentFY = currentYear + currentMonth / 12;
  const targetFY  = targetYear  + targetMonth  / 12;

  const originalYears = anchorFY - currentFY;
  if (originalYears <= 0) return stored;

  const annualMultiplier = Math.pow(stored / car.currentValue, 1 / originalYears);

  const targetYears = targetFY - currentFY;
  if (targetYears <= 0) return car.currentValue;

  return Math.round(car.currentValue * Math.pow(annualMultiplier, targetYears));
}

/**
 * Projects the remaining loan balance at a target (year, month) using standard
 * amortization: B(n) = P*(1+r)^n − pmt*((1+r)^n − 1)/r
 *
 * Returns 0 if no loan, if the loan is already paid off by the target date,
 * or if the target date is before the balance-as-of date.
 */
export function getProjectedLoanBalance(
  car: Car,
  targetYear: number,
  targetMonth: number,
): number {
  if (!car.loan) return 0;

  const { remainingBalance, remainingBalanceAsOf, monthlyPayment, apr, maturityDate } = car.loan;

  // Parse ISO date strings
  const [asOfYear, asOfMo] = remainingBalanceAsOf.split('-').map(Number);
  const asOfMonth = asOfMo - 1; // convert to 0-indexed

  const [matYear, matMo] = maturityDate.split('-').map(Number);
  const matMonth = matMo - 1; // convert to 0-indexed

  const monthsToTarget = (targetYear - asOfYear) * 12 + (targetMonth - asOfMonth);

  if (monthsToTarget <= 0) return Math.max(0, remainingBalance);

  const monthsToMaturity = (matYear - asOfYear) * 12 + (matMonth - asOfMonth);
  if (monthsToTarget >= monthsToMaturity) return 0;

  const r = apr / 100 / 12;

  if (r === 0) {
    return Math.max(0, Math.round(remainingBalance - monthlyPayment * monthsToTarget));
  }

  const factor = Math.pow(1 + r, monthsToTarget);
  const balance = remainingBalance * factor - monthlyPayment * (factor - 1) / r;
  return Math.max(0, Math.round(balance));
}

/**
 * Generates a month-by-month savings + loan balance timeline.
 *
 * Savings model:
 *   • Each month, household savings first repay any outstanding "replacement loan",
 *     then accumulate to the savings balance.
 *   • At a replacement event, net cost = replacementCost − tradeIn + oldLoanPayoff.
 *     If net cost > available savings, the shortfall is covered by a new loan;
 *     savings floors at 0.
 *
 * Chart x-values:
 *   • Regular months:    year + month/12   (January = integer tick)
 *   • Pre-cliff:         year + (month + 0.4)/12
 *   • Post-cliff:        year + (month + 0.5)/12
 */
export function generateSavingsTimeline(
  household: Household,
  cars: Car[],
  currentYear: number,
  currentMonth: number, // 0-indexed
): TimelinePoint[] {
  if (cars.length === 0) return [];

  const lastYear = Math.max(...cars.map(c => c.replacementYear));
  const endYear  = lastYear + 2; // show 2 years past the last replacement

  const points: TimelinePoint[] = [];
  let balance        = household.totalSaved;
  let newLoanBalance = 0; // running balance of any loan taken to cover a shortfall
  const replacedCars = new Set<string>();

  /** Sum of unreplaced car loans + any new financing loan. */
  function totalLoans(y: number, mo: number): number {
    return cars.reduce((sum, car) => {
      if (replacedCars.has(car.id)) return sum;
      return sum + getProjectedLoanBalance(car, y, mo);
    }, 0) + newLoanBalance;
  }

  /** Sum of equity (projected value − loan) for each unreplaced car, floored at 0 per car. */
  function totalEquity(y: number, mo: number): number {
    return cars.reduce((sum, car) => {
      if (replacedCars.has(car.id)) return sum;
      const value = getProjectedResaleValue(car, y, mo, currentYear, currentMonth);
      const loan  = getProjectedLoanBalance(car, y, mo);
      return sum + Math.max(0, value - loan);
    }, 0);
  }

  // ── starting point ────────────────────────────────────────────────────────
  points.push({
    x: currentYear + currentMonth / 12,
    balance: Math.round(balance),
    totalLoanBalance: Math.round(totalLoans(currentYear, currentMonth)),
    totalCarEquity: Math.round(totalEquity(currentYear, currentMonth)),
    label: String(currentYear),
    monthYear: `${MONTHS_SHORT[currentMonth]} ${currentYear}`,
    replacements: [],
  });

  // ── month-by-month loop ───────────────────────────────────────────────────
  let y = currentYear;
  let m = currentMonth + 1;
  if (m >= 12) { y++; m = 0; }

  // Run through every month until Jan of (endYear + 1)
  while (y < endYear + 1 || (y === endYear + 1 && m === 0)) {

    // Monthly savings: repay new loan first, then accumulate
    if (newLoanBalance > 0) {
      const repayment = Math.min(household.monthlySavings, newLoanBalance);
      newLoanBalance = Math.max(0, newLoanBalance - repayment);
      balance += household.monthlySavings - repayment;
    } else {
      balance += household.monthlySavings;
    }

    // Cars being replaced this month
    const replacementsThisMonth = cars.filter(c =>
      !replacedCars.has(c.id) &&
      c.replacementYear === y &&
      (c.replacementMonth ?? 0) === m
    );

    if (replacementsThisMonth.length > 0) {
      // Pre-cliff peak
      points.push({
        x: y + (m + 0.4) / 12,
        balance: Math.round(balance),
        totalLoanBalance: Math.round(totalLoans(y, m)),
        totalCarEquity: Math.round(totalEquity(y, m)),
        label: '',
        monthYear: `${MONTHS_SHORT[m]} ${y}`,
        replacements: [],
      });

      const replacedNames: string[] = [];
      for (const car of replacementsThisMonth) {
        const resale   = getProjectedResaleValue(car, y, m, currentYear, currentMonth);
        const loanBal  = getProjectedLoanBalance(car, y, m);
        const netCost  = car.replacementCost - resale + loanBal;

        // Mark car as replaced (removes its loan from totalLoans)
        replacedCars.add(car.id);

        if (netCost > balance) {
          // Cover shortfall with a new loan
          newLoanBalance += netCost - balance;
          balance = 0;
        } else {
          balance -= netCost;
        }

        replacedNames.push(car.name);
      }

      // Post-cliff drop
      points.push({
        x: y + (m + 0.5) / 12,
        balance: Math.round(balance),
        totalLoanBalance: Math.round(totalLoans(y, m)),
        totalCarEquity: Math.round(totalEquity(y, m)),
        label: '',
        monthYear: `${MONTHS_SHORT[m]} ${y}`,
        replacements: replacedNames,
      });

    } else {
      // Regular monthly point; only January gets an x-axis tick label
      points.push({
        x: y + m / 12,
        balance: Math.round(balance),
        totalLoanBalance: Math.round(totalLoans(y, m)),
        totalCarEquity: Math.round(totalEquity(y, m)),
        label: m === 0 ? String(y) : '',
        monthYear: `${MONTHS_SHORT[m]} ${y}`,
        replacements: [],
      });
    }

    // Advance month
    m++;
    if (m >= 12) { y++; m = 0; }
  }

  return points;
}

export function calculateCarSavings(car: Car, currentYear: number, currentMonth: number): CarSavings {
  const repMonth = car.replacementMonth ?? 0;
  const monthsRemaining = (car.replacementYear - currentYear) * 12 + repMonth - currentMonth;

  const projectedResaleValue = getProjectedResaleValue(car, car.replacementYear, repMonth, currentYear, currentMonth);
  const projectedLoanBalance = getProjectedLoanBalance(car, car.replacementYear, repMonth);

  // Net cost = replacement cost − trade-in + loan payoff (loan must be settled at sale)
  const savingsNeeded = Math.max(0, car.replacementCost - car.currentSavings - projectedResaleValue + projectedLoanBalance);

  const isOverdue = monthsRemaining <= 0;

  const monthlySavingsNeeded =
    isOverdue || monthsRemaining === 0
      ? savingsNeeded
      : savingsNeeded / monthsRemaining;

  return {
    car,
    monthsRemaining: Math.max(0, monthsRemaining),
    savingsNeeded,
    monthlySavingsNeeded,
    yearlySavingsNeeded: monthlySavingsNeeded * 12,
    isOverdue,
    projectedResaleValue,
    projectedLoanBalance,
  };
}

export function calculateTotalMonthlySavings(savings: CarSavings[]): number {
  return savings.reduce((sum, s) => sum + s.monthlySavingsNeeded, 0);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMonthlyCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
