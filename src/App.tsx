import { useState, useCallback } from 'react';
import type { Car } from './types';
import { calculateCarSavings, calculateTotalMonthlySavings, formatMonthlyCurrency } from './calculations';
import { CarCard } from './components/CarCard';
import { CarForm } from './components/CarForm';
import { useCars } from './useCars';

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth(); // 0-indexed

export default function App() {
  const { cars, loaded, addCar, updateCar, deleteCar } = useCars();
  const [showForm, setShowForm] = useState(false);
  const [editingCar, setEditingCar] = useState<Car | null>(null);

  const savingsResults = cars.map(car =>
    calculateCarSavings(car, CURRENT_YEAR, CURRENT_MONTH)
  );
  const totalMonthly = calculateTotalMonthlySavings(savingsResults);

  const handleSave = useCallback((data: Omit<Car, 'id'> & { id?: string }) => {
    if (data.id) {
      updateCar({ ...data, id: data.id } as Car);
    } else {
      addCar(data as Omit<Car, 'id'>);
    }
    setShowForm(false);
    setEditingCar(null);
  }, [addCar, updateCar]);

  const handleEdit = useCallback((car: Car) => {
    setEditingCar(car);
    setShowForm(true);
  }, []);

  const handleCancel = useCallback(() => {
    setShowForm(false);
    setEditingCar(null);
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
          <div className="rounded-2xl bg-blue-600 text-white p-6 mb-6 flex items-center justify-between shadow">
            <div>
              <div className="text-blue-200 text-sm font-medium">Total monthly savings target</div>
              <div className="text-4xl font-bold mt-1">{formatMonthlyCurrency(totalMonthly)}</div>
              <div className="text-blue-200 text-sm mt-1">across {cars.length} car{cars.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="text-6xl opacity-20 select-none">🚗</div>
          </div>
        )}

        {/* Car cards */}
        <div className="flex flex-col gap-4 mb-6">
          {savingsResults.map(s => (
            <CarCard
              key={s.car.id}
              savings={s}
              onEdit={handleEdit}
              onDelete={deleteCar}
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

        {/* Add / Edit form */}
        {showForm ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              {editingCar ? 'Edit car' : 'Add a car'}
            </h2>
            <CarForm
              initial={editingCar}
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
