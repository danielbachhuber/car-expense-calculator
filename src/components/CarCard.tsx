import type { Car, CarSavings } from '../types';
import { formatCurrency, formatMonthlyCurrency } from '../calculations';

interface CarCardProps {
  savings: CarSavings;
  onEdit: (car: Car) => void;
  onDelete: (id: string) => void;
}

export function CarCard({ savings, onEdit, onDelete }: CarCardProps) {
  const { car, monthsRemaining, savingsNeeded, monthlySavingsNeeded, isOverdue } = savings;

  const yearsRemaining = Math.floor(monthsRemaining / 12);
  const monthsRemainder = monthsRemaining % 12;

  const timeLabel = isOverdue
    ? 'Overdue'
    : yearsRemaining > 0
    ? `${yearsRemaining}y ${monthsRemainder}m remaining`
    : `${monthsRemaining}m remaining`;

  const progressPct = car.replacementCost > 0
    ? Math.min(100, Math.round((car.currentSavings / car.replacementCost) * 100))
    : 0;

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 shadow-sm ${isOverdue ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{car.name}</h3>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
            {timeLabel} &middot; {car.replacementYear}
          </span>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(car)}
            className="text-sm px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(car.id)}
            className="text-sm px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500 mb-1">Replacement cost</div>
          <div className="font-semibold text-slate-800">{formatCurrency(car.replacementCost)}</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="text-xs text-slate-500 mb-1">Saved so far</div>
          <div className="font-semibold text-slate-800">{formatCurrency(car.currentSavings)}</div>
        </div>
        <div className={`rounded-xl p-3 ${isOverdue ? 'bg-red-100' : 'bg-blue-50'}`}>
          <div className={`text-xs mb-1 ${isOverdue ? 'text-red-600' : 'text-blue-600'}`}>Still needed</div>
          <div className={`font-semibold ${isOverdue ? 'text-red-700' : 'text-blue-700'}`}>{formatCurrency(savingsNeeded)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Savings progress</span>
          <span>{progressPct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-400' : 'bg-blue-400'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className={`rounded-xl p-4 text-center ${isOverdue ? 'bg-red-100' : 'bg-green-50'}`}>
        <div className={`text-sm mb-0.5 ${isOverdue ? 'text-red-600' : 'text-green-700'}`}>Monthly savings needed</div>
        <div className={`text-2xl font-bold ${isOverdue ? 'text-red-700' : 'text-green-700'}`}>
          {formatMonthlyCurrency(monthlySavingsNeeded)}/mo
        </div>
      </div>
    </div>
  );
}
