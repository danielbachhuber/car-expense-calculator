import { useState, useCallback } from 'react';
import type { Car } from './types';
import { calculateCarSavings, calculateTotalMonthlySavings, formatMonthlyCurrency, formatCurrency } from './calculations';
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
  const totalMonthlyNeeded = calculateTotalMonthlySavings(savingsResults);
  const gap = totalMonthlyNeeded - household.monthlySavings;
  const onTrack = gap <= 0;

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
          <p className="text-slate-500 mt-1">
            Figure out how much to save each month to replace your cars on schedule.
          </p>
        </div>

        {/* Summary banner */}
        {cars.length > 0 && (
          <div className="rounded-2xl bg-blue-600 text-white p-6 mb-4 shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-blue-200 text-sm font-medium">Monthly savings target</div>
                <div className="text-4xl font-bold mt-1">{formatMonthlyCurrency(totalMonthlyNeeded)}</div>
                <div className="text-blue-200 text-sm mt-1">across {cars.length} car{cars.length !== 1 ? 's' : ''}</div>
              </div>
              <div className="text-6xl opacity-20 select-none shrink-0">🚗</div>
            </div>

            {/* Savings rate row */}
            <div className="mt-4 pt-4 border-t border-blue-500 grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-blue-200 text-xs mb-0.5">You're saving</div>
                <div className="text-lg font-semibold">
                  <button
                    onClick={() => {
                      const raw = prompt('Monthly savings amount ($):', String(household.monthlySavings));
                      if (raw !== null && !isNaN(Number(raw))) updateHousehold({ ...household, monthlySavings: Number(raw) });
                    }}
                    className="hover:underline"
                  >
                    {formatMonthlyCurrency(household.monthlySavings)}/mo
                  </button>
                </div>
              </div>
              <div>
                <div className="text-blue-200 text-xs mb-0.5">Total saved</div>
                <div className="text-lg font-semibold">
                  <button
                    onClick={() => {
                      const raw = prompt('Total saved ($):', String(household.totalSaved));
                      if (raw !== null && !isNaN(Number(raw))) updateHousehold({ ...household, totalSaved: Number(raw) });
                    }}
                    className="hover:underline"
                  >
                    {formatCurrency(household.totalSaved)}
                  </button>
                </div>
              </div>
              <div>
                <div className="text-blue-200 text-xs mb-0.5">{onTrack ? 'Monthly surplus' : 'Monthly gap'}</div>
                <div className={`text-lg font-semibold ${onTrack ? 'text-green-300' : 'text-red-300'}`}>
                  {onTrack ? '+' : '-'}{formatMonthlyCurrency(Math.abs(gap))}/mo
                </div>
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
