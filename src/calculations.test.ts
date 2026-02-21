import { describe, it, expect } from 'vitest';
import type { Car, Household } from './types';
import {
  getProjectedResaleValue,
  getProjectedLoanBalance,
  generateSavingsTimeline,
  calculateCarSavings,
  formatCurrency,
  formatMonthlyCurrency,
} from './calculations';

// ─── Fixtures (simulated data) ─────────────────────────────────────────────────

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 0; // January (0-indexed) — simplifies x-axis math

/** A sedan bought 2 years ago, loan not yet paid off, replacing in 2028. */
const sedan: Car = {
  id: 'sedan-1',
  name: 'Sedan',
  purchaseDate: '2024-01-15',
  purchasePrice: 35000,
  currentValue: 25000,
  replacementCost: 40000,
  replacementYear: 2028,
  replacementMonth: 0, // January
  currentSavings: 0,
  estimatedResaleValue: 15000,
  estimatedResaleYear: 2030,
  loan: {
    originalAmount: 25000,
    remainingBalance: 18000,
    remainingBalanceAsOf: '2026-01-01',
    monthlyPayment: 500,
    apr: 6.0,
    maturityDate: '2029-01-01',
  },
};

/** An SUV bought 1 year ago, loan matures at replacement time, replacing in 2030. */
const suv: Car = {
  id: 'suv-1',
  name: 'SUV',
  purchaseDate: '2025-01-10',
  purchasePrice: 50000,
  currentValue: 35000,
  replacementCost: 55000,
  replacementYear: 2030,
  replacementMonth: 6, // July
  currentSavings: 0,
  estimatedResaleValue: 18000,
  estimatedResaleYear: 2032,
  loan: {
    originalAmount: 30000,
    remainingBalance: 26000,
    remainingBalanceAsOf: '2026-01-01',
    monthlyPayment: 600,
    apr: 5.0,
    maturityDate: '2030-01-01',
  },
};

/** A car with no loan and no depreciation data — minimal fields. */
const basicCar: Car = {
  id: 'basic-1',
  name: 'Basic Car',
  currentValue: 10000,
  replacementCost: 20000,
  replacementYear: 2029,
  currentSavings: 0,
};

const household: Household = {
  monthlySavings: 1000,
  totalSaved: 5000,
};

// ─── getProjectedResaleValue ───────────────────────────────────────────────────

describe('getProjectedResaleValue', () => {
  it('returns currentValue when target is now', () => {
    const val = getProjectedResaleValue(sedan, CURRENT_YEAR, CURRENT_MONTH, CURRENT_YEAR, CURRENT_MONTH);
    expect(val).toBe(sedan.currentValue);
  });

  it('returns stored estimatedResaleValue at anchor year (Jan)', () => {
    // Sedan anchor is 2030, target Jan 2030
    const val = getProjectedResaleValue(sedan, 2030, 0, CURRENT_YEAR, CURRENT_MONTH);
    expect(val).toBe(sedan.estimatedResaleValue);
  });

  it('depreciates between current and anchor', () => {
    const val = getProjectedResaleValue(sedan, 2028, 0, CURRENT_YEAR, CURRENT_MONTH);
    // Should be between currentValue ($25k) and estimatedResale ($15k)
    expect(val).toBeGreaterThan(15000);
    expect(val).toBeLessThan(25000);
  });

  it('depreciates further for later dates', () => {
    const early = getProjectedResaleValue(sedan, 2027, 0, CURRENT_YEAR, CURRENT_MONTH);
    const late = getProjectedResaleValue(sedan, 2029, 0, CURRENT_YEAR, CURRENT_MONTH);
    expect(late).toBeLessThan(early);
  });

  it('returns 0 when estimatedResaleValue is 0', () => {
    const car: Car = { ...sedan, estimatedResaleValue: 0 };
    expect(getProjectedResaleValue(car, 2028, 0, CURRENT_YEAR, CURRENT_MONTH)).toBe(0);
  });

  it('returns stored value when currentValue is 0', () => {
    const car: Car = { ...sedan, currentValue: 0 };
    expect(getProjectedResaleValue(car, 2028, 0, CURRENT_YEAR, CURRENT_MONTH)).toBe(sedan.estimatedResaleValue);
  });

  it('uses replacementYear as anchor when estimatedResaleYear is not set', () => {
    const car: Car = { ...sedan, estimatedResaleYear: undefined };
    // anchor becomes replacementYear (2028), target Jan 2027 is before anchor
    const val = getProjectedResaleValue(car, 2027, 0, CURRENT_YEAR, CURRENT_MONTH);
    expect(val).toBeGreaterThan(15000);
    expect(val).toBeLessThan(25000);
  });

  it('returns stored value when anchor is in the past', () => {
    const car: Car = { ...sedan, estimatedResaleYear: 2025 };
    // anchorFY (2025) < currentFY (2026.0) → originalYears <= 0
    const val = getProjectedResaleValue(car, 2028, 0, CURRENT_YEAR, CURRENT_MONTH);
    expect(val).toBe(sedan.estimatedResaleValue);
  });

  it('returns currentValue when target is before current date', () => {
    const val = getProjectedResaleValue(sedan, 2025, 6, CURRENT_YEAR, CURRENT_MONTH);
    expect(val).toBe(sedan.currentValue);
  });

  it('returns undefined estimatedResaleValue as 0', () => {
    const val = getProjectedResaleValue(basicCar, 2028, 0, CURRENT_YEAR, CURRENT_MONTH);
    expect(val).toBe(0);
  });
});

// ─── getProjectedLoanBalance ───────────────────────────────────────────────────

describe('getProjectedLoanBalance', () => {
  it('returns 0 when car has no loan', () => {
    expect(getProjectedLoanBalance(basicCar, 2028, 0)).toBe(0);
  });

  it('returns remainingBalance at as-of date', () => {
    const bal = getProjectedLoanBalance(sedan, 2026, 0);
    expect(bal).toBe(sedan.loan!.remainingBalance);
  });

  it('returns remainingBalance for dates before as-of', () => {
    const bal = getProjectedLoanBalance(sedan, 2025, 6);
    expect(bal).toBe(Math.max(0, sedan.loan!.remainingBalance));
  });

  it('returns 0 at maturity', () => {
    // Sedan matures Jan 2029 → month 0
    expect(getProjectedLoanBalance(sedan, 2029, 0)).toBe(0);
  });

  it('returns 0 after maturity', () => {
    expect(getProjectedLoanBalance(sedan, 2030, 0)).toBe(0);
  });

  it('SUV loan is 0 at its maturity (Jan 2030)', () => {
    expect(getProjectedLoanBalance(suv, 2030, 0)).toBe(0);
  });

  it('amortizes balance downward over time', () => {
    const bal6 = getProjectedLoanBalance(sedan, 2026, 6);   // 6 months
    const bal12 = getProjectedLoanBalance(sedan, 2027, 0);  // 12 months
    const bal24 = getProjectedLoanBalance(sedan, 2028, 0);  // 24 months

    expect(bal6).toBeLessThan(sedan.loan!.remainingBalance);
    expect(bal12).toBeLessThan(bal6);
    expect(bal24).toBeLessThan(bal12);
    expect(bal24).toBeGreaterThan(0);
  });

  it('handles 0% APR loan', () => {
    const car: Car = {
      ...basicCar,
      loan: {
        originalAmount: 12000,
        remainingBalance: 12000,
        remainingBalanceAsOf: '2026-01-01',
        monthlyPayment: 500,
        apr: 0,
        maturityDate: '2028-01-01',
      },
    };
    // After 12 months: 12000 - 500*12 = 6000
    expect(getProjectedLoanBalance(car, 2027, 0)).toBe(6000);
  });

  it('never returns negative', () => {
    const bal = getProjectedLoanBalance(sedan, 2028, 11); // near maturity
    expect(bal).toBeGreaterThanOrEqual(0);
  });
});

// ─── calculateCarSavings ──────────────────────────────────────────────────────

describe('calculateCarSavings', () => {
  it('computes months remaining correctly', () => {
    const result = calculateCarSavings(sedan, CURRENT_YEAR, CURRENT_MONTH);
    // Jan 2026 to Jan 2028 = 24 months
    expect(result.monthsRemaining).toBe(24);
    expect(result.isOverdue).toBe(false);
  });

  it('computes months remaining with non-zero replacement month', () => {
    const result = calculateCarSavings(suv, CURRENT_YEAR, CURRENT_MONTH);
    // Jan 2026 to Jul 2030 = 54 months
    expect(result.monthsRemaining).toBe(54);
  });

  it('projectedLoanBalance is 0 when loan matures before replacement', () => {
    // SUV loan matures Jan 2030, replacement Jul 2030
    const result = calculateCarSavings(suv, CURRENT_YEAR, CURRENT_MONTH);
    expect(result.projectedLoanBalance).toBe(0);
  });

  it('projectedLoanBalance > 0 when loan matures after replacement', () => {
    // Sedan loan matures Jan 2029, replacement Jan 2028 — loan still active
    const result = calculateCarSavings(sedan, CURRENT_YEAR, CURRENT_MONTH);
    expect(result.projectedLoanBalance).toBeGreaterThan(0);
  });

  it('savingsNeeded = replacementCost - currentSavings - resale + loanPayoff', () => {
    const result = calculateCarSavings(sedan, CURRENT_YEAR, CURRENT_MONTH);
    const expected = sedan.replacementCost - sedan.currentSavings - result.projectedResaleValue + result.projectedLoanBalance;
    expect(result.savingsNeeded).toBe(Math.max(0, expected));
  });

  it('monthlySavingsNeeded = savingsNeeded / monthsRemaining', () => {
    const result = calculateCarSavings(sedan, CURRENT_YEAR, CURRENT_MONTH);
    expect(result.monthlySavingsNeeded).toBeCloseTo(result.savingsNeeded / result.monthsRemaining, 2);
  });

  it('marks overdue when replacement is in the past', () => {
    const car: Car = { ...sedan, replacementYear: 2025, replacementMonth: 0 };
    const result = calculateCarSavings(car, CURRENT_YEAR, CURRENT_MONTH);
    expect(result.isOverdue).toBe(true);
    expect(result.monthsRemaining).toBe(0);
  });

  it('handles car with no loan', () => {
    const result = calculateCarSavings(basicCar, CURRENT_YEAR, CURRENT_MONTH);
    expect(result.projectedLoanBalance).toBe(0);
    expect(result.monthsRemaining).toBe(36); // Jan 2026 to Jan 2029
  });
});

// ─── generateSavingsTimeline ──────────────────────────────────────────────────

describe('generateSavingsTimeline', () => {
  it('returns empty array when no cars', () => {
    expect(generateSavingsTimeline(household, [], CURRENT_YEAR, CURRENT_MONTH)).toEqual([]);
  });

  it('starts with current savings balance', () => {
    const points = generateSavingsTimeline(household, [sedan], CURRENT_YEAR, CURRENT_MONTH);
    expect(points[0].balance).toBe(Math.round(household.totalSaved));
  });

  it('savings grow by monthlySavings each month', () => {
    // Use basicCar (no loan) with a far-off replacement to isolate savings growth
    const simpleCar: Car = { ...basicCar, replacementYear: 2030 };
    const h: Household = { monthlySavings: 1000, totalSaved: 0 };
    const points = generateSavingsTimeline(h, [simpleCar], CURRENT_YEAR, CURRENT_MONTH);

    // Point 0 = Jan 2026 (starting), point 1 = Feb 2026 (1 month of savings)
    expect(points[1].balance).toBe(1000);
    expect(points[10].balance).toBe(10000);
  });

  it('replacement events create pre-cliff and post-cliff points', () => {
    const points = generateSavingsTimeline(household, [sedan], CURRENT_YEAR, CURRENT_MONTH);

    const replacementPoints = points.filter(p => p.replacements.length > 0);
    expect(replacementPoints.length).toBe(1);
    expect(replacementPoints[0].replacements).toContain('Sedan');

    // Pre-cliff has higher savings than post-cliff
    const idx = points.indexOf(replacementPoints[0]);
    expect(points[idx - 1].balance).toBeGreaterThan(points[idx].balance);
  });

  it('savings drop at replacement events', () => {
    const points = generateSavingsTimeline(household, [sedan], CURRENT_YEAR, CURRENT_MONTH);
    const replacement = points.find(p => p.replacements.includes('Sedan'))!;
    const preIdx = points.indexOf(replacement) - 1;

    expect(replacement.balance).toBeLessThan(points[preIdx].balance);
  });

  it('handles two cars with sequential replacements', () => {
    const points = generateSavingsTimeline(household, [sedan, suv], CURRENT_YEAR, CURRENT_MONTH);

    const sedanRep = points.find(p => p.replacements.includes('Sedan'));
    const suvRep = points.find(p => p.replacements.includes('SUV'));

    expect(sedanRep).toBeDefined();
    expect(suvRep).toBeDefined();
    expect(sedanRep!.x).toBeLessThan(suvRep!.x);
  });

  it('creates new loan when savings insufficient', () => {
    // Low savings — won't cover sedan replacement
    const lowHousehold: Household = { monthlySavings: 100, totalSaved: 0 };
    const points = generateSavingsTimeline(lowHousehold, [sedan], CURRENT_YEAR, CURRENT_MONTH);
    const replacement = points.find(p => p.replacements.includes('Sedan'))!;

    // Savings zeroed out, loan created for the shortfall
    expect(replacement.balance).toBe(0);
    expect(replacement.totalLoanBalance).toBeGreaterThan(0);
  });

  it('pays cash when savings are sufficient (no new loan)', () => {
    const richHousehold: Household = { monthlySavings: 1000, totalSaved: 100000 };
    const points = generateSavingsTimeline(richHousehold, [sedan], CURRENT_YEAR, CURRENT_MONTH);
    const replacement = points.find(p => p.replacements.includes('Sedan'))!;

    // Paid cash — savings still positive, no new loans
    expect(replacement.balance).toBeGreaterThan(0);
    // Only sedan in the list — its loan is removed after replacement, no new loan created
    expect(replacement.totalLoanBalance).toBe(0);
  });

  it('new loans amortize down over time after replacement', () => {
    const lowHousehold: Household = { monthlySavings: 100, totalSaved: 0 };
    const points = generateSavingsTimeline(lowHousehold, [sedan], CURRENT_YEAR, CURRENT_MONTH);
    const replacement = points.find(p => p.replacements.includes('Sedan'))!;
    const idx = points.indexOf(replacement);

    // 12 months later, loan balance should be lower
    const laterPoint = points[idx + 12];
    if (laterPoint) {
      expect(laterPoint.totalLoanBalance).toBeLessThan(replacement.totalLoanBalance);
    }
  });

  it('extends timeline 2 years past last replacement', () => {
    const points = generateSavingsTimeline(household, [sedan], CURRENT_YEAR, CURRENT_MONTH);
    const lastPoint = points[points.length - 1];
    // Sedan replacement is 2028, timeline extends to ~2030+
    expect(lastPoint.x).toBeGreaterThanOrEqual(2030);
  });

  it('January points get year labels', () => {
    const points = generateSavingsTimeline(household, [sedan], CURRENT_YEAR, CURRENT_MONTH);
    // Filter for points that have year labels (non-empty, numeric)
    const labeled = points.filter(p => p.label && /^\d{4}$/.test(p.label));
    expect(labeled.length).toBeGreaterThan(0);

    for (const p of labeled) {
      // Year labels appear at January (month 0) → x = year + 0/12 = integer
      // or at the starting point which is also January in this fixture
      const frac = p.x % 1;
      expect(frac).toBeCloseTo(0, 1);
    }
  });

  it('loan balance includes both existing car loans and new financing', () => {
    const lowHousehold: Household = { monthlySavings: 100, totalSaved: 0 };
    const points = generateSavingsTimeline(lowHousehold, [sedan, suv], CURRENT_YEAR, CURRENT_MONTH);

    // At start, loan balance = sum of both car loans
    const startLoans = points[0].totalLoanBalance;
    expect(startLoans).toBeGreaterThan(0);

    // After sedan replacement, SUV loan is still active + new sedan replacement loan
    const sedanRep = points.find(p => p.replacements.includes('Sedan'))!;
    expect(sedanRep.totalLoanBalance).toBeGreaterThan(0);
  });
});

// ─── formatCurrency / formatMonthlyCurrency ────────────────────────────────────

describe('formatCurrency', () => {
  it('formats whole dollars with commas', () => {
    expect(formatCurrency(1234)).toBe('$1,234');
  });

  it('rounds to nearest dollar', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('formatMonthlyCurrency', () => {
  it('formats with 2 decimal places', () => {
    expect(formatMonthlyCurrency(357.02)).toBe('$357.02');
  });

  it('pads to 2 decimal places', () => {
    expect(formatMonthlyCurrency(800)).toBe('$800.00');
  });
});
