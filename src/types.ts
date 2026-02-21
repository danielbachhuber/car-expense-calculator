export interface Car {
  id: string;
  name: string;
  currentValue: number;
  replacementCost: number;
  replacementYear: number;
  currentSavings: number;
}

export interface CarSavings {
  car: Car;
  monthsRemaining: number;
  savingsNeeded: number;
  monthlySavingsNeeded: number;
  yearlySavingsNeeded: number;
  isOverdue: boolean;
}
