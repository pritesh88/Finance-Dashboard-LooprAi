export type Category = 'Revenue' | 'Expense';

export interface Transaction {
  id: number;
  date: string;
  amount: number;
  category: Category;
  status: string;
  user_id: string;
  user_profile: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface TransactionsResponse {
  data: Transaction[];
  pagination: Pagination;
}

export interface FilterOptions {
  categories: string[];
  statuses: string[];
  userIds: string[];
  totalCount: number;
  dateRange: { min: string | null; max: string | null };
  amountRange: { min: number | null; max: number | null };
}

export interface DashboardSummary {
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  transactionCount: number;
  revenueCount: number;
  expenseCount: number;
  averageAmount: number;
  pendingRevenue: number;
  pendingExpenses: number;
  pendingCount: number;
}

export interface TrendPoint {
  month: string;
  revenue: number;
  expenses: number;
  net: number;
}

export interface CategoryBreakdown {
  category: string;
  amount: number;
  count: number;
  share: number;
}

export interface StatusBreakdown {
  status: string;
  amount: number;
  count: number;
}

export interface UserBreakdown {
  user_id: string;
  revenue: number;
  expenses: number;
  count: number;
}

export interface DashboardResponse {
  summary: DashboardSummary;
  trend: TrendPoint[];
  categories: CategoryBreakdown[];
  statuses: StatusBreakdown[];
  users: UserBreakdown[];
}

export type TransactionField = 'id' | 'date' | 'amount' | 'category' | 'status' | 'user_id' | 'user_profile';

export interface Filters {
  search?: string;
  category?: string[];
  status?: string[];
  user_id?: string[];
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface SortState {
  sortBy: TransactionField;
  sortOrder: 'asc' | 'desc';
}

export interface ExportPreview {
  columns: { key: TransactionField; label: string }[];
  rows: string[][];
  totalRows: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface LoginResponse {
  token: string;
  tokenType: string;
  expiresAt: string;
  user: AuthUser;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field?: string; message: string }[];
  };
}
