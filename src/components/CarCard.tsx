import { useState, useRef, useEffect } from 'react';
import type { Car, CarSavings, Household } from '../types';
import { formatCurrency, getProjectedResaleValue, getProjectedLoanBalance } from '../calculations';

// Matches the assumed terms used in the timeline model (calculations.ts)
const ASSUMED_LOAN_APR_PCT = 7;
const ASSUMED_LOAN_MONTHS  = 60;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface CarCardProps {
  savings: CarSavings;
  household: Household;
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
        className="font-semibold text-slate-800 bg-transparent border-b-2 border-blue-400 outline-none w-full"
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="font-semibold text-slate-800 hover:text-blue-600 transition group"
      title="Click to edit"
    >
      {formatCurrency(value)}
      <span className="ml-1 text-slate-300 group-hover:text-blue-400 text-xs">✎</span>
    </button>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function ageString(totalMonths: number): string {
  const years  = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years > 0 && months > 0) return `${years}yr ${months}mo`;
  if (years > 0) return `${years}yr`;
  return `${months}mo`;
}

/** Age of car right now. */
function currentCarAge(car: Car, currentYear: number, currentMonth: number): string | null {
  if (!car.purchaseDate) return null;
  const [pyStr, pmStr] = car.purchaseDate.split('-');
  const totalMonths = (currentYear - Number(pyStr)) * 12 + (currentMonth - (Number(pmStr) - 1));
  return totalMonths > 0 ? ageString(totalMonths) : null;
}

/** Age of car at a future replacement date. */
function carAgeAtReplacement(car: Car, targetYear: number, targetMonth: number): string | null {
  if (!car.purchaseDate) return null;
  const [pyStr, pmStr] = car.purchaseDate.split('-');
  const totalMonths = (targetYear - Number(pyStr)) * 12 + (targetMonth - (Number(pmStr) - 1));
  return totalMonths > 0 ? ageString(totalMonths) : null;
}

// ─── ledger row ───────────────────────────────────────────────────────────────

function LedgerRow({
  label,
  value,
  sub,
  className = '',
  children,
}: {
  label: string;
  value?: React.ReactNode;
  sub?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${className}`}>
      <span className="text-sm text-slate-500">
        {label}
        {sub && <span className="text-xs text-slate-400 ml-1">({sub})</span>}
      </span>
      <span className="text-sm font-semibold text-slate-800 tabular-nums shrink-0">
        {children ?? value}
      </span>
    </div>
  );
}

// ─── car card ───────────────────────────────────────────────────────────────

export function CarCard({
  savings,
  household,
  onDelete,
  onReplacementDateChange,
  onReplacementCostChange,
  currentYear,
  currentMonth,
}: CarCardProps) {
  const { car, monthsRemaining, isOverdue } = savings;

  const repYear  = car.replacementYear;
  const repMonth = car.replacementMonth ?? 0;
  const repLabel = `${MONTHS_SHORT[repMonth]} ${repYear}`;

  // Stepper bounds
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

  const resaleValue  = getProjectedResaleValue(car, repYear, repMonth, currentYear, currentMonth);
  const loanBalance  = getProjectedLoanBalance(car, repYear, repMonth);
  const hasResale    = resaleValue > 0;
  const hasLoan      = !!car.loan;
  const currentAge   = currentCarAge(car, currentYear, currentMonth);
  const ageAtRep     = carAgeAtReplacement(car, repYear, repMonth);
  const outOfPocket  = Math.max(0, car.replacementCost - resaleValue + loanBalance);
  const showLedger   = hasResale || hasLoan;

  // Projected savings at replacement (simple per-car estimate; chart shows full shared picture)
  const projectedSavings  = Math.max(0, household.totalSaved + household.monthlySavings * monthsRemaining);
  const paidWithCash      = Math.min(outOfPocket, projectedSavings);
  const newLoanAmount     = Math.max(0, outOfPocket - paidWithCash);
  const newLoanR          = ASSUMED_LOAN_APR_PCT / 100 / 12;
  const newLoanPayment    = newLoanAmount > 0
    ? newLoanAmount * newLoanR / (1 - Math.pow(1 + newLoanR, -ASSUMED_LOAN_MONTHS))
    : 0;

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 shadow-sm ${isOverdue ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>

      {/* ── Header: name + current age + delete ───────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h3 className="text-lg font-semibold text-slate-800 truncate">{car.name}</h3>
          {currentAge && (
            <span className="text-sm text-slate-400 whitespace-nowrap shrink-0">{currentAge} old</span>
          )}
        </div>
        <button
          onClick={() => onDelete(car.id)}
          className="text-sm px-3 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition shrink-0"
        >
          Delete
        </button>
      </div>

      {/* ── Replacement date row ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Segmented pill: [Replacement date] [← Mon YYYY →] [Age: Xyr Ymo] */}
        <div className="flex items-stretch rounded-xl border border-slate-200 overflow-hidden divide-x divide-slate-200 text-sm">
          <div className="flex items-center px-3 py-1.5 bg-slate-50">
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Replacement date</span>
          </div>
          <div className="flex items-center gap-0.5 px-2 py-1.5 bg-white">
            <button
              onClick={decrement}
              disabled={atMin}
              className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Earlier"
            >←</button>
            <span className="font-semibold text-slate-700 tabular-nums whitespace-nowrap w-[4.5rem] text-center">
              {MONTHS_SHORT[repMonth]} {repYear}
            </span>
            <button
              onClick={increment}
              disabled={atMax}
              className="w-6 h-6 flex items-center justify-center rounded text-slate-400 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
              aria-label="Later"
            >→</button>
          </div>
          {ageAtRep && (
            <div className="flex items-center px-3 py-1.5 bg-slate-50">
              <span className="text-xs text-slate-500 whitespace-nowrap">
                Age <span className="font-semibold text-slate-700">{ageAtRep}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Cost ledger ───────────────────────────────────────────────── */}
      <div className="rounded-xl bg-slate-50 px-4 py-3 flex flex-col gap-2">
        {/* Replacement cost — always shown, inline-editable */}
        <LedgerRow label="Replacement cost">
          <InlineCost value={car.replacementCost} onChange={cost => onReplacementCostChange(car.id, cost)} />
        </LedgerRow>

        {showLedger && (
          <>
            {hasResale && (
              <LedgerRow
                label="Est. trade-in"
                sub={repLabel}
                value={`−${formatCurrency(resaleValue)}`}
                className="text-emerald-700"
              />
            )}

            {hasLoan && (
              <LedgerRow
                label="Loan to settle"
                sub={repLabel}
                value={loanBalance > 0 ? `+${formatCurrency(loanBalance)}` : formatCurrency(0)}
                className={loanBalance > 0 ? 'text-orange-600' : 'text-slate-400'}
              />
            )}

            <div className="border-t border-slate-200 mt-1 pt-2 flex flex-col gap-2">
              <LedgerRow
                label="Out-of-pocket"
                value={formatCurrency(outOfPocket)}
                className="text-slate-800 font-semibold [&>span:first-child]:text-slate-700 [&>span:first-child]:font-semibold [&>span:last-child]:text-base"
              />
              {!isOverdue && (
                <>
                  <LedgerRow label="Paid with cash" value={formatCurrency(paidWithCash)} />
                  <LedgerRow
                    label="New loan"
                    value={
                      newLoanAmount > 0
                        ? `${formatCurrency(Math.round(newLoanPayment))}/mo · ${formatCurrency(newLoanAmount)} total`
                        : 'None needed'
                    }
                    className={newLoanAmount === 0 ? 'text-emerald-600 [&>span]:text-emerald-600' : ''}
                  />
                  <div className="border-t border-slate-200 mt-1 pt-2">
                    <LedgerRow
                      label="Remaining savings"
                      value={formatCurrency(Math.max(0, projectedSavings - outOfPocket))}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

    </div>
  );
}
