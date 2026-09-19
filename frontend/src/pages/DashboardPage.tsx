import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Grid,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import InsightsIcon from '@mui/icons-material/Insights';
import LogoutIcon from '@mui/icons-material/Logout';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { ApiError } from '../api/client';
import { dashboardApi, transactionsApi } from '../api/endpoints';
import type { DashboardResponse, FilterOptions, Filters, SortState, Transaction, Pagination } from '../api/types';
import { useAuth } from '../context/AuthContext';
import { useAlerts } from '../context/AlertContext';
import { FilterBar } from '../components/FilterBar';
import { KpiCards } from '../components/KpiCards';
import { TrendChart } from '../components/charts/TrendChart';
import { CategoryDonut } from '../components/charts/CategoryDonut';
import { UserBarChart } from '../components/charts/UserBarChart';
import { TransactionsTable } from '../components/TransactionsTable';
import { ExportDialog } from '../components/ExportDialog';
import { initialsFor } from '../utils/format';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { pushAlert } = useAlerts();

  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<SortState>({ sortBy: 'date', sortOrder: 'desc' });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [rows, setRows] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [tableLoading, setTableLoading] = useState(true);
  const [tableError, setTableError] = useState<string | null>(null);

  const [exportOpen, setExportOpen] = useState(false);

  // filter options: fetched once
  useEffect(() => {
    transactionsApi
      .filterOptions()
      .then(setFilterOptions)
      .catch((err) => {
        pushAlert('error', err instanceof ApiError ? err.message : 'Could not load filter options.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  // dashboard: refetch whenever filters change
  useEffect(() => {
    let cancelled = false;
    setDashboardLoading(true);
    dashboardApi
      .get(filters)
      .then((res) => {
        if (!cancelled) setDashboard(res);
      })
      .catch((err) => {
        if (cancelled) return;
        pushAlert('error', err instanceof ApiError ? err.message : 'Could not load dashboard data.');
      })
      .finally(() => {
        if (!cancelled) setDashboardLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const fetchTransactions = useCallback(() => {
    let cancelled = false;
    setTableLoading(true);
    setTableError(null);
    transactionsApi
      .list({ ...filters, ...sort, page, pageSize })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => {
        if (cancelled) return;
        setTableError(err instanceof ApiError ? err.message : 'Could not load transactions.');
      })
      .finally(() => {
        if (!cancelled) setTableLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters, sort, page, pageSize]);

  useEffect(() => fetchTransactions(), [fetchTransactions]);

  const hasActiveFilters = useMemo(() => Object.values(filters).some((v) => v !== undefined && v !== '' && (!Array.isArray(v) || v.length > 0)), [filters]);

  async function handleLogout() {
    await logout();
    pushAlert('info', 'You have been signed out.');
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Toolbar>
          <InsightsIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" component="h1" sx={{ flexGrow: 1, fontSize: { xs: 16, sm: 20 } }}>
            Financial Analytics Dashboard
          </Typography>
          {user && (
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Avatar sx={{ width: 30, height: 30, fontSize: 12 }}>{initialsFor(user.name)}</Avatar>
              <Typography variant="body2" sx={{ display: { xs: 'none', sm: 'block' } }}>
                {user.name}
              </Typography>
              <Tooltip title="Sign out">
                <IconButton onClick={handleLogout} aria-label="Sign out">
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3 }}>
        <FilterBar filters={filters} onChange={setFilters} options={filterOptions} />

        <KpiCards summary={dashboard?.summary ?? null} loading={dashboardLoading} />

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TrendChart data={dashboard?.trend ?? []} loading={dashboardLoading} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <CategoryDonut data={dashboard?.categories ?? []} loading={dashboardLoading} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <UserBarChart data={dashboard?.users ?? []} loading={dashboardLoading} />
          </Grid>
        </Grid>

        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="h6" component="h2">
            Transactions
          </Typography>
          <Button startIcon={<FileDownloadIcon />} variant="outlined" onClick={() => setExportOpen(true)}>
            Export CSV
          </Button>
        </Stack>

        <TransactionsTable
          rows={rows}
          pagination={pagination}
          sort={sort}
          loading={tableLoading}
          error={tableError}
          hasActiveFilters={hasActiveFilters}
          onSortChange={setSort}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          onRetry={fetchTransactions}
          onClearFilters={() => setFilters({})}
        />
      </Container>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        filters={filters}
        sort={sort}
        currentResultCount={pagination?.total ?? 0}
        totalCount={filterOptions?.totalCount ?? pagination?.total ?? 0}
      />
    </Box>
  );
}
