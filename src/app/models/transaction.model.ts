export type TransactionType = 'income' | 'expense';
export type Currency = 'INR' | 'USD';

export interface Transaction {
  id: number;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  currency: Currency;
  description: string;
}

export interface TransactionCreate {
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  currency: Currency;
  description: string;
}

export interface Category {
  name: string;
  type: string;
}

export interface DaySummary {
  date: string;
  income: Record<string, number>;
  expense: Record<string, number>;
  transactions: Transaction[];
}

export interface MonthSummary {
  year: number;
  month: number;
  total_income: Record<string, number>;
  total_expense: Record<string, number>;
  net: Record<string, number>;
  by_category: Record<string, Record<string, number>>;
  days: DaySummary[];
}

export interface CategoryDetail {
  category: string;
  type: TransactionType;
  totals: Record<string, number>;
  count: number;
  transactions: Transaction[];
}

export interface MonthDetail {
  year: number;
  month: number;
  total_income: Record<string, number>;
  total_expense: Record<string, number>;
  net: Record<string, number>;
  by_category: CategoryDetail[];
}
