import { useState, useRef, useEffect } from 'react';
import type { Car, CarSavings } from '../types';
import { formatCurrency, getProjectedResaleValue, getProjectedLoanBalance } from '../calculations';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface CarCardProps {
  savings: CarSavings;
  onDelete: (id: string) => void;
  onReplacementDateChange: (carId: string, year: number, month: number) => void;
  onReplacementCostChange: (carId: string, cost: number) => void;
  currentYear: number;
  currentMonth: number;
}

// ─── inline cost editor ──────────────────────────────────────────────────────

interface InlineCostProps {
  value: number;
  onChange: (v: number) => void;
}

function InlineCost({ value, onChange }: InlineCostProps) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    setRaw(String(value));
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  function commit() {
    const parsed = Number(raw.replace(/[^0-9.]/g, ''));
    if (!isNaN(parsed) && parsed > 0) onChange(parsed);
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="font-semibold text-slate-800 bg-transparent border-b-2 border-blue-400 outline-none text-center w-full"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="font-semibold text-slate-800 hover:text-blue-600 transition group w-full text-center"
      title="Click to edit"
    >
      {formatCurrency(value)}
      <span className="ml-1 text-slate-300 group-hover:text-blue-400 text-xs">✎</span>
    </button>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns "Xyr Ymo" or "Ymo" age string from purchaseDate to a target (year, month). */
function carAgeAtReplacement(car: Car, targetYear: number, targetMonth: number): string | null {
  if (!car.purchaseDate) return null;
  const [pyStr, pmStr] = car.purchaseDate.split('-');
  const purchaseYear  = Number(pyStr);
  const purchaseMonth = Number(pmStr) - 1; // 0-indexed
  const totalMonths = (targetYear - purchaseYear) * 12 + (targetMonth - purchaseMonth);
  if (totalMonths <= 0) return null;
  const years  = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years}yr ${months}mo`;
  if (years > 0) return `${years}yr`;
  return `${months}mo`;
}

// ─── car card ───────────────────────────────────────────────────────────────

export function CarCard({
  savings,
  onDelete,
  onReplacementDateChange,
  onReplacementCostChange,
  currentYear,
  currentMonth,
}: CarCardProps) {
  const { car, monthsRemaining, isOverdue } = savings;

  const yearsRemaining = Math.floor(monthsRemaining / 12);
  const monthsRemainder = monthsRemaining % 12;
  const timeLabel = isOverdue
    ? 'Overdue'
    : yearsRemaining > 0
    ? `${yearsRemaining}y ${monthsRemainder}m`
    : `${monthsRemaining}m`;

  const repYear  = car.replacementYear;
  const repMonth = car.replacementMonth ?? 0;

  // Min = next month
  const minYear  = currentMonth === 11 ? currentYear + 1 : currentYear;
  const minMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const maxYear  = currentYear + 25;
  const maxMonth = 11;

  const atMin = repYear === minYear && repMonth === minMonth;
  const atMax = repYear === maxYear && repMonth === maxMonth;

  function decrement() {
    let y = repYear, m = repMonth;
    if (m === 0) { y--; m = 11; } else { m--; }
    if (y < minYear || (y === minYear && m < minMonth)) return;
    onReplacementDateChange(car.id, y, m);
  }

  function increment() {
    let y = repYear, m = repMonth;
    if (m === 11) { y++; m = 0; } else { m++; }
    if (y > maxYear || (y === maxYear && m > maxMonth)) return;
    onReplacementDateChange(car.id, y, m);
  }

  const resaleValue = getProjectedResaleValue(car, repYear, repMonth, currentYear, currentMonth);
  const loanBalance = getProjectedLoanBalance(car, repYear, repMonth);
  const hasResale   = resaleValue > 0;
  const hasLoan     = !!car.loan; // show loan row whenever the car has a loan, even if paid off by replacement
  const ageLabel    = carAgeAtReplacement(car, repYear, repMonth);

  // Out-of-pocket = cost − trade-in + loan payoff
  const outOfPocket = car.replacementCost - resaleValue + loanBalance;

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 shadow-sm ${isOverdue ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-800">{car.name}</h3>
            {ageLabel && (
              <span className="text-xs text-slate-400">{ageLabel} old at replacement</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
              {timeLabel}
            </span>
            {/* Month / year stepper */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500">Replace in</span>
              <button
                onClick={decrement}
                disabled={atMin}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
                aria-label="Earlier"
              >←</button>
              <span className="text-sm font-semibold text-slate-700 tabular-nums w-16 text-center">
                {MONTHS_SHORT[repMonth]} {repYear}
              </span>
              <button
                onClick={increment}
                disabled={atMax}
                className="w-6 h-6 flex items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition text-sm"
                aria-label="Later"
              >→</button>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDelete(car.id)}
          className="text-sm px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition shrink-0"
        >
          Delete
        </button>
      </div>

      {/* Cost breakdown tiles */}
      {hasLoan ? (
        // 2×2 grid: cost | trade-in / loan payoff | out-of-pocket
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500 mb-1">Replacement cost</div>
            <InlineCost value={car.replacementCost} onChange={cost => onReplacementCostChange(car.id, cost)} />
          </div>
          {hasResale ? (
            <div className="rounded-xl bg-emerald-50 p-3">
              <div className="text-xs text-emerald-600 mb-1">Est. trade-in ({MONTHS_SHORT[repMonth]} {repYear})</div>
              <div className="font-semibold text-emerald-700">&minus;{formatCurrency(resaleValue)}</div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-xs text-slate-500 mb-1">Est. trade-in</div>
              <div className="font-semibold text-slate-400">—</div>
            </div>
          )}
          <div className="rounded-xl bg-orange-50 p-3">
            <div className="text-xs text-orange-600 mb-1">Loan payoff ({MONTHS_SHORT[repMonth]} {repYear})</div>
            <div className="font-semibold text-orange-700">+{formatCurrency(loanBalance)}</div>
          </div>
          <div className="rounded-xl bg-blue-50 p-3">
            <div className="text-xs text-blue-600 mb-1">Out-of-pocket</div>
            <div className="font-semibold text-blue-700">{formatCurrency(Math.max(0, outOfPocket))}</div>
          </div>
        </div>
      ) : hasResale ? (
        // 1×2 grid: cost | trade-in
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs text-slate-500 mb-1">Replacement cost</div>
            <InlineCost value={car.replacementCost} onChange={cost => onReplacementCostChange(car.id, cost)} />
          </div>
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="text-xs text-emerald-600 mb-1">Est. trade-in ({MONTHS_SHORT[repMonth]} {repYear})</div>
            <div className="font-semibold text-emerald-700">&minus;{formatCurrency(resaleValue)}</div>
          </div>
        </div>
      ) : (
        // Just cost
        <div className="rounded-xl bg-slate-50 p-3 text-center">
          <div className="text-xs text-slate-500 mb-1">Replacement cost</div>
          <InlineCost value={car.replacementCost} onChange={cost => onReplacementCostChange(car.id, cost)} />
        </div>
      )}
    </div>
  );
}
