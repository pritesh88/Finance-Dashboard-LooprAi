import { apiDownload, apiFetch } from './client';
import type {
  DashboardResponse,
  ExportPreview,
  Filters,
  FilterOptions,
  LoginResponse,
  SortState,
  TransactionField,
  TransactionsResponse,
} from './types';

function qs(params: object): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === '') continue;
    usp.set(key, Array.isArray(value) ? value.join(',') : String(value));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => apiFetch<void>('/auth/logout', { method: 'POST' }),
  me: () => apiFetch<{ user: LoginResponse['user'] }>('/auth/me'),
};

export interface ListParams extends Filters, SortState {
  page: number;
  pageSize: number;
}

export const transactionsApi = {
  list: (params: ListParams) => apiFetch<TransactionsResponse>(`/transactions${qs(params)}`),
  filterOptions: () => apiFetch<FilterOptions>('/transactions/filter-options'),
};

export const dashboardApi = {
  get: (filters: Filters) => apiFetch<DashboardResponse>(`/dashboard${qs(filters)}`),
};

export interface ExportBody {
  columns: TransactionField[];
  scope: 'filtered' | 'all';
  filters: Filters;
  sortBy: TransactionField;
  sortOrder: 'asc' | 'desc';
}

export const exportApi = {
  preview: (body: ExportBody) =>
    apiFetch<ExportPreview>('/exports/csv/preview', { method: 'POST', body: JSON.stringify(body) }),
  download: (body: ExportBody) => apiDownload('/exports/csv', { method: 'POST', body: JSON.stringify(body) }),
};
