import type { Car, CarSavings } from './types';

export function calculateCarSavings(car: Car, currentYear: number, currentMonth: number): CarSavings {
  const monthsRemaining =
    (car.replacementYear - currentYear) * 12 - currentMonth + 1;

  const savingsNeeded = Math.max(0, car.replacementCost - car.currentSavings);

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
