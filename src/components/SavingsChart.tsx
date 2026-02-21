import {
  ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Label,
} from 'recharts';
import type { Car, Household } from '../types';
import { generateSavingsTimeline, type TimelinePoint } from '../calculations';
import { formatCurrency } from '../calculations';

interface SavingsChartProps {
  household: Household;
  cars: Car[];
  currentYear: number;
  currentMonth: number;
}

// ─── custom tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: TimelinePoint }[] }) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  const title = pt.monthYear || pt.label;
  if (!title) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3 text-sm pointer-events-none min-w-[160px]">
      <div className="font-semibold text-slate-700 mb-2">{title}</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-blue-500">Savings</span>
          <span className="font-medium text-slate-700">{formatCurrency(pt.balance)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-red-400">Loans</span>
          <span className="font-medium text-slate-700">{formatCurrency(pt.totalLoanBalance)}</span>
        </div>
      </div>
      {pt.replacements.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-100 text-slate-500 text-xs space-y-0.5">
          {pt.replacements.map(name => <div key={name}>🚗 {name} replaced</div>)}
        </div>
      )}
    </div>
  );
}

// ─── custom legend ─────────────────────────────────────────────────────────────

function ChartLegend() {
  return (
    <div className="flex gap-5 justify-end text-xs text-slate-500 mb-1">
      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-blue-500 inline-block rounded" />Savings</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" />Loans</span>
    </div>
  );
}

// ─── main chart ────────────────────────────────────────────────────────────────

const MARGIN = { top: 16, right: 24, left: 68, bottom: 16 };

export function SavingsChart({ household, cars, currentYear, currentMonth }: SavingsChartProps) {
  const data = generateSavingsTimeline(household, cars, currentYear, currentMonth);

  if (data.length === 0) return null;

  // Loans plotted as negative so they appear below the $0 line
  const chartData = data.map(pt => ({ ...pt, loansNeg: -pt.totalLoanBalance }));

  const chartXMin = data[0].x;
  const chartXMax = data[data.length - 1].x;
  const yearTicks  = data.filter(d => d.label).map(d => d.x);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-600">Balances over time</h2>
        <ChartLegend />
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={MARGIN}>
          <defs>
            <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.30} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.04} />
            </linearGradient>
            <linearGradient id="loansFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#f87171" stopOpacity={0.04} />
              <stop offset="100%" stopColor="#f87171" stopOpacity={0.30} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />

          <XAxis
            dataKey="x"
            type="number"
            domain={[chartXMin, chartXMax]}
            tickFormatter={(v) => {
              const match = data.find(d => d.label && Math.abs(d.x - v) < 0.0001);
              return match?.label ?? '';
            }}
            ticks={yearTicks}
            tick={{ fontSize: 12, fill: '#64748b' }}
          />

          <YAxis
            tickFormatter={(v) => {
              const abs = Math.abs(v);
              const fmt = abs >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v);
              return `$${fmt}`;
            }}
            tick={{ fontSize: 12, fill: '#64748b' }}
            width={60}
          />

          <Tooltip content={<ChartTooltip />} />

          <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4">
            <Label value="$0" position="insideRight" fontSize={11} fill="#94a3b8" />
          </ReferenceLine>

          {cars.map(car => (
            <ReferenceLine
              key={car.id}
              x={car.replacementYear + ((car.replacementMonth ?? 0) + 0.5) / 12}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="3 3"
            />
          ))}

          {/* Loans — plotted as negative, filled area below $0 */}
          <Area
            type="monotone"
            dataKey="loansNeg"
            stroke="#f87171"
            strokeWidth={1.5}
            fill="url(#loansFill)"
            dot={false}
            activeDot={{ r: 3, fill: '#f87171' }}
            isAnimationActive={false}
          />

          {/* Savings — filled area above $0 */}
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#savingsFill)"
            dot={false}
            activeDot={{ r: 4, fill: '#3b82f6' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
