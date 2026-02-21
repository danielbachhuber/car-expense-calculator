export interface Loan {
  originalAmount: number;        // amount originally financed
  remainingBalance: number;      // payoff balance as of remainingBalanceAsOf
  remainingBalanceAsOf: string;  // ISO date "YYYY-MM-DD" when balance was recorded
  monthlyPayment: number;
  apr: number;                   // annual percentage rate, e.g. 5.89
  maturityDate: string;          // ISO date "YYYY-MM-DD"
}

export interface Car {
  id: string;
  name: string;
  purchaseDate?: string;     // ISO date "YYYY-MM-DD"
  purchasePrice?: number;    // total out-the-door price (down payment + amount financed)
  currentValue: number;
  replacementCost: number;
  replacementYear: number;
  currentSavings: number;
  replacementMonth?: number;     // 0-indexed month of replacement year (0 = January), defaults to 0
  estimatedResaleValue?: number; // expected trade-in / sale proceeds at replacement time
  estimatedResaleYear?: number;  // the replacementYear for which estimatedResaleValue was set — used as stable depreciation anchor
  loan?: Loan;
}

export interface Household {
  monthlySavings: number;  // amount currently being saved each month across all cars
  totalSaved: number;      // total cash already set aside for car replacement
}

export interface AppData {
  household: Household;
  cars: Car[];
}

export interface CarSavings {
  car: Car;
  monthsRemaining: number;
  savingsNeeded: number;
  monthlySavingsNeeded: number;
  yearlySavingsNeeded: number;
  isOverdue: boolean;
  projectedResaleValue: number;   // resale value at replacement date
  projectedLoanBalance: number;   // remaining loan at replacement date (0 if no loan or paid off)
}
