import { useState, useCallback } from 'react';
import type { Car } from './types';
import { calculateCarSavings, formatMonthlyCurrency, formatCurrency } from './calculations';
import { CarCard } from './components/CarCard';
import { CarForm } from './components/CarForm';
import { SavingsChart } from './components/SavingsChart';
import { useAppData } from './useAppData';

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth(); // 0-indexed

export default function App() {
  const { household, cars, loaded, updateHousehold, addCar, updateCar, deleteCar } = useAppData();
  const [showForm, setShowForm] = useState(false);

  const savingsResults = cars.map(car =>
    calculateCarSavings(car, CURRENT_YEAR, CURRENT_MONTH)
  );
  const now = new Date(CURRENT_YEAR, CURRENT_MONTH);

  // Amortized monthly cost of ownership: (purchase price − projected resale + loan interest) ÷ ownership months
  const { monthlyOwnershipCost, totalPurchasePrice, totalProjectedResale, totalLoanInterest } = (() => {
    let cost = 0;
    let purchase = 0;
    let resale = 0;
    let interest = 0;
    for (const s of savingsResults) {
      const car = s.car;
      if (!car.purchaseDate || !car.purchasePrice) continue;
      const pd = new Date(car.purchaseDate);
      const repMonth = car.replacementMonth ?? 0;
      const ownershipMonths =
        (car.replacementYear - pd.getFullYear()) * 12 + (repMonth - pd.getMonth());
      if (ownershipMonths <= 0) continue;
      purchase += car.purchasePrice;
      resale += s.projectedResaleValue;
      // Loan interest = total payments over loan life − principal
      let loanInterest = 0;
      if (car.loan) {
        const loanStart = new Date(car.purchaseDate);
        const loanEnd = new Date(car.loan.maturityDate);
        const loanMonths = (loanEnd.getFullYear() - loanStart.getFullYear()) * 12
          + (loanEnd.getMonth() - loanStart.getMonth());
        loanInterest = Math.max(0, car.loan.monthlyPayment * loanMonths - car.loan.originalAmount);
        interest += loanInterest;
      }
      const netCost = Math.max(0, car.purchasePrice - s.projectedResaleValue + loanInterest);
      cost += netCost / ownershipMonths;
    }
    return { monthlyOwnershipCost: cost, totalPurchasePrice: purchase, totalProjectedResale: resale, totalLoanInterest: interest };
  })();

  // Projected loan payment milestones at each replacement date
  const NEW_LOAN_APR = 0.07;
  const NEW_LOAN_TERM = 60;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const currentMonthAbs = CURRENT_YEAR * 12 + CURRENT_MONTH;

  type ActiveLoan = { name: string; payment: number; endMonth: number; isNew?: boolean };
  type Milestone = { label: string; loanPayment: number; newLoanPayment: number; milestoneNewPayment: number; totalOutlay: number; loans: { name: string; payment: number }[] };

  // Sort cars by replacement date (shared across milestone calc and rate computations)
  const sortedSavings = [...savingsResults].sort((a, b) => {
    const aM = a.car.replacementYear * 12 + (a.car.replacementMonth ?? 0);
    const bM = b.car.replacementYear * 12 + (b.car.replacementMonth ?? 0);
    return aM - bM;
  });

  const initialLoans: ActiveLoan[] = cars
    .filter(c => c.loan && new Date(c.loan.maturityDate) > now)
    .map(c => ({
      name: c.name,
      payment: c.loan!.monthlyPayment,
      endMonth: (new Date(c.loan!.maturityDate).getFullYear() * 12 + new Date(c.loan!.maturityDate).getMonth()) - currentMonthAbs,
    }));

  const todayLoanPayment = initialLoans.reduce((s, l) => s + l.payment, 0);

  /** Simulate milestones for a given monthly savings rate. Returns per-car savings and milestone array. */
  function simulateMilestones(monthlySavings: number) {
    let loans = initialLoans.map(l => ({ ...l }));
    const perCarSavings = new Map<string, number>();

    const result: Milestone[] = [{
      label: 'Today',
      loanPayment: todayLoanPayment,
      newLoanPayment: 0,
      milestoneNewPayment: 0,
      totalOutlay: todayLoanPayment + monthlySavings,
      loans: loans.map(l => ({ name: l.name, payment: l.payment })),
    }];

    let savingsBalance = household.totalSaved;
    let lastMonth = 0;
    let replacementIndex = 0;

    for (const s of sortedSavings) {
      const car = s.car;
      const repMonth = car.replacementMonth ?? 0;
      const monthsFromNow = (car.replacementYear * 12 + repMonth) - currentMonthAbs;

      savingsBalance += monthlySavings * (monthsFromNow - lastMonth);
      perCarSavings.set(car.id, savingsBalance);

      loans = loans.filter(l => l.name !== car.name && l.endMonth > monthsFromNow);

      const outOfPocket = Math.max(0, car.replacementCost - s.projectedResaleValue + s.projectedLoanBalance);
      const paidWithCash = Math.min(outOfPocket, savingsBalance);
      const newLoanAmount = Math.max(0, outOfPocket - paidWithCash);
      savingsBalance -= paidWithCash;

      replacementIndex++;
      const replacementLabel = `Replacement car ${replacementIndex}`;
      let thisEventPayment = 0;
      if (newLoanAmount > 0) {
        const r = NEW_LOAN_APR / 12;
        const pmt = newLoanAmount * r / (1 - Math.pow(1 + r, -NEW_LOAN_TERM));
        loans.push({ name: replacementLabel, payment: pmt, endMonth: monthsFromNow + NEW_LOAN_TERM, isNew: true });
        thisEventPayment = pmt;
      }

      const milestoneLoanPayment = loans.reduce((s, l) => s + l.payment, 0);
      const milestoneNewLoanPayment = loans.filter(l => l.isNew).reduce((s, l) => s + l.payment, 0);
      result.push({
        label: `${monthNames[repMonth]} ${car.replacementYear} — replace ${car.name}`,
        loanPayment: milestoneLoanPayment,
        newLoanPayment: milestoneNewLoanPayment,
        milestoneNewPayment: thisEventPayment,
        totalOutlay: milestoneLoanPayment + monthlySavings,
        loans: loans.map(l => ({ name: l.name, payment: l.payment })),
      });

      lastMonth = monthsFromNow;
    }

    return { milestones: result, perCarSavings };
  }

  // Primary milestones using current savings rate
  const { milestones, perCarSavings: projectedSavingsAtReplacement } = simulateMilestones(household.monthlySavings);

  // Binary search for a target savings rate
  function findSavingsRate(predicate: (monthlySavings: number) => boolean, lo = 0, hi = 20000): number {
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      if (predicate(mid)) hi = mid; else lo = mid;
    }
    return Math.ceil(hi);
  }

  // "Cash only" rate: no new replacement loans needed at any replacement
  const cashOnlyRate = findSavingsRate((rate) => {
    const { milestones: ms } = simulateMilestones(rate);
    return ms.slice(1).every(m => m.newLoanPayment < 0.01);
  });

  // "Status quo" rate: max savings rate where each replacement's new loan + rate ≤ today's outlay.
  // Per-event check: at each replacement, the new loan taken for THAT car + savings rate stays within budget.
  const todayOutlay = todayLoanPayment + household.monthlySavings;
  const statusQuoRate = (() => {
    // Find max rate where all milestones satisfy: milestoneNewPayment + rate ≤ todayOutlay
    // Since (milestoneNewPayment + rate) increases monotonically with rate, we find the threshold.
    let lo = 0, hi = 20000;
    for (let i = 0; i < 50; i++) {
      const mid = (lo + hi) / 2;
      const { milestones: ms } = simulateMilestones(mid);
      const feasible = ms.slice(1).every(m => m.milestoneNewPayment + mid <= todayOutlay + 0.01);
      if (feasible) lo = mid; else hi = mid;
    }
    // If even rate=0 is infeasible, return null
    const { milestones: check } = simulateMilestones(0);
    const feasibleAtZero = check.slice(1).every(m => m.milestoneNewPayment <= todayOutlay + 0.01);
    if (!feasibleAtZero) return null;
    return Math.floor(lo);
  })();

  const handleReplacementDateChange = useCallback((carId: string, year: number, month: number) => {
    const car = cars.find(c => c.id === carId);
    if (car) updateCar({ ...car, replacementYear: year, replacementMonth: month });
  }, [cars, updateCar]);

  const handleReplacementCostChange = useCallback((carId: string, cost: number) => {
    const car = cars.find(c => c.id === carId);
    if (car) updateCar({ ...car, replacementCost: cost });
  }, [cars, updateCar]);

  const handleSave = useCallback((data: Omit<Car, 'id'> & { id?: string }) => {
    if (data.id) {
      updateCar({ ...data, id: data.id } as Car);
    } else {
      addCar(data as Omit<Car, 'id'>);
    }
    setShowForm(false);
  }, [addCar, updateCar]);

  const handleCancel = useCallback(() => {
    setShowForm(false);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">Car Replacement Planner</h1>
        </div>

        {/* Summary banner */}
        {cars.length > 0 && (
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6 mb-4 space-y-4">

            {/* Row 1: Current cost */}
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-1">Right now</div>
                  <div>
                    <span className="text-slate-600 text-sm">Your cars cost </span>
                    <span className="text-2xl font-bold text-slate-900">{formatMonthlyCurrency(monthlyOwnershipCost)}/mo</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 text-right space-y-0.5">
                  <div>
                    Saving{' '}
                    <button
                      onClick={() => {
                        const raw = prompt('Monthly savings amount ($):', String(household.monthlySavings));
                        if (raw !== null && !isNaN(Number(raw))) updateHousehold({ ...household, monthlySavings: Number(raw) });
                      }}
                      className="text-slate-500 font-medium hover:text-blue-600 transition-colors"
                    >
                      {formatMonthlyCurrency(household.monthlySavings)}/mo
                    </button>
                    {' · '}
                    <button
                      onClick={() => {
                        const raw = prompt('Total saved ($):', String(household.totalSaved));
                        if (raw !== null && !isNaN(Number(raw))) updateHousehold({ ...household, totalSaved: Number(raw) });
                      }}
                      className="text-slate-500 font-medium hover:text-slate-700 transition-colors"
                    >
                      {formatCurrency(household.totalSaved)}
                    </button>
                    {' '}set aside
                  </div>
                  <div>Status quo: <span className="text-slate-500 font-medium">{statusQuoRate !== null ? `${formatCurrency(statusQuoRate)}/mo` : 'N/A'}</span></div>
                  <div>Cash only: <span className="text-slate-500 font-medium">{formatCurrency(cashOnlyRate)}/mo</span></div>
                </div>
              </div>
              <div className="mt-1 space-y-0.5">
                <div className="text-xs text-slate-400">
                  {formatCurrency(totalPurchasePrice)} purchase + {formatCurrency(totalLoanInterest)} interest − {formatCurrency(totalProjectedResale)} resale
                </div>
                <div className="text-xs text-slate-400">
                  {savingsResults.map((s, i) => {
                    const car = s.car;
                    if (!car.purchaseDate) return null;
                    const pd = new Date(car.purchaseDate);
                    const repMonth = car.replacementMonth ?? 0;
                    const totalMonths = (car.replacementYear - pd.getFullYear()) * 12 + (repMonth - pd.getMonth());
                    const years = Math.floor(totalMonths / 12);
                    const months = totalMonths % 12;
                    const duration = months > 0 ? `${years}yr ${months}mo` : `${years}yr`;
                    return (
                      <span key={car.id}>
                        {i > 0 && ' · '}
                        {car.name} {duration}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Row 2: Looking ahead — projected loan payments */}
            <div className="border-t border-slate-100 pt-4">
              <div className="mb-2">
                <div className="text-xs text-slate-400 uppercase tracking-wide font-medium">Looking ahead</div>
              </div>
              <div className="space-y-2">
                {milestones.map((m, i) => (
                  <div key={i} className="flex items-start justify-between">
                    <div>
                      <div className={`text-sm ${i === 0 ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>
                        {m.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {m.loans.map((l, j) => (
                          <span key={j}>
                            {j > 0 && ' + '}
                            {l.name} {formatMonthlyCurrency(l.payment)}
                          </span>
                        ))}
                        {m.loans.length > 0 && ' + '}
                        Savings {formatMonthlyCurrency(household.monthlySavings)}
                      </div>
                    </div>
                    <div className={`text-sm font-semibold whitespace-nowrap ml-4 ${
                      m.loanPayment === 0 ? 'text-green-600' : 'text-slate-800'
                    }`}>
                      {formatMonthlyCurrency(m.totalOutlay)}/mo
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* Timeline chart */}
        {cars.length > 0 && (
          <SavingsChart
            household={household}
            cars={cars}
            currentYear={CURRENT_YEAR}
            currentMonth={CURRENT_MONTH}
          />
        )}

        {/* Car cards */}
        <div className="flex flex-col gap-4 mb-6">
          {savingsResults.map(s => (
            <CarCard
              key={s.car.id}
              savings={s}
              projectedSavings={projectedSavingsAtReplacement.get(s.car.id) ?? (household.totalSaved + household.monthlySavings * s.monthsRemaining)}
              onDelete={deleteCar}
              onReplacementDateChange={handleReplacementDateChange}
              onReplacementCostChange={handleReplacementCostChange}
              currentYear={CURRENT_YEAR}
              currentMonth={CURRENT_MONTH}
            />
          ))}

          {loaded && cars.length === 0 && !showForm && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
              <div className="text-4xl mb-3">🚗</div>
              <div className="font-medium">No cars yet</div>
              <div className="text-sm mt-1">Add your first car to start planning.</div>
            </div>
          )}
        </div>

        {/* Add car form */}
        {showForm ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Add a car</h2>
            <CarForm
              initial={null}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full rounded-2xl border-2 border-dashed border-blue-200 text-blue-600 font-medium py-4 hover:bg-blue-50 transition"
          >
            + Add a car
          </button>
        )}
      </div>
    </div>
  );
}
