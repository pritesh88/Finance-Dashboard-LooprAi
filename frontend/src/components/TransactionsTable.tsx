import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import InboxIcon from '@mui/icons-material/Inbox';
import type { Pagination, SortState, Transaction, TransactionField } from '../api/types';
import { colorFor, formatCurrency, formatDateUTC, initialsFor } from '../utils/format';
import { chartColors } from '../theme';

interface Column {
  field: TransactionField;
  label: string;
  align?: 'left' | 'right';
}

const COLUMNS: Column[] = [
  { field: 'id', label: 'ID', align: 'right' },
  { field: 'date', label: 'Date' },
  { field: 'user_id', label: 'User' },
  { field: 'category', label: 'Category' },
  { field: 'status', label: 'Status' },
  { field: 'amount', label: 'Amount', align: 'right' },
];

interface TransactionsTableProps {
  rows: Transaction[];
  pagination: Pagination | null;
  sort: SortState;
  loading: boolean;
  error: string | null;
  hasActiveFilters: boolean;
  onSortChange: (sort: SortState) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onRetry: () => void;
  onClearFilters: () => void;
}

export function TransactionsTable({
  rows,
  pagination,
  sort,
  loading,
  error,
  hasActiveFilters,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  onRetry,
  onClearFilters,
}: TransactionsTableProps) {
  const handleSort = (field: TransactionField) => {
    if (sort.sortBy === field) {
      onSortChange({ sortBy: field, sortOrder: sort.sortOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      onSortChange({ sortBy: field, sortOrder: 'asc' });
    }
  };

  return (
    <Paper variant="outlined">
      <TableContainer sx={{ maxHeight: 560, overflowX: 'auto' }}>
        <Table stickyHeader size="small" aria-label="Transactions">
          <TableHead>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableCell key={col.field} align={col.align ?? 'left'} sortDirection={sort.sortBy === col.field ? sort.sortOrder : false}>
                  <TableSortLabel
                    active={sort.sortBy === col.field}
                    direction={sort.sortBy === col.field ? sort.sortOrder : 'asc'}
                    onClick={() => handleSort(col.field)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  {COLUMNS.map((col) => (
                    <TableCell key={col.field}>
                      <Skeleton variant="text" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!loading && error && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} sx={{ border: 0 }}>
                  <Stack spacing={1.5} sx={{ alignItems: 'center', py: 5 }}>
                    <Alert severity="error" sx={{ width: '100%', maxWidth: 480 }}>
                      {error}
                    </Alert>
                    <Button startIcon={<RefreshIcon />} onClick={onRetry} variant="outlined" size="small">
                      Retry
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            )}

            {!loading && !error && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} sx={{ border: 0 }}>
                  <Stack spacing={1.5} sx={{ alignItems: 'center', py: 5, color: 'text.secondary' }}>
                    <InboxIcon fontSize="large" />
                    <Typography variant="body2">No transactions match your filters.</Typography>
                    {hasActiveFilters && (
                      <Button size="small" onClick={onClearFilters}>
                        Clear filters
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              !error &&
              rows.map((tx) => (
                <TableRow key={tx.id} hover>
                  <TableCell align="right">{tx.id}</TableCell>
                  <TableCell>{formatDateUTC(tx.date)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <Avatar sx={{ width: 26, height: 26, fontSize: 12, bgcolor: colorFor(tx.user_id) }}>
                        {initialsFor(tx.user_id)}
                      </Avatar>
                      <Typography variant="body2">{tx.user_id}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={tx.category}
                      size="small"
                      sx={{ bgcolor: `${chartColors.categories[tx.category]}1f`, color: chartColors.categories[tx.category], fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={tx.status}
                      size="small"
                      color={tx.status === 'Paid' ? 'success' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatCurrency(tx.amount)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
        <TablePagination
          component="div"
          count={pagination?.total ?? 0}
          page={pagination ? pagination.page - 1 : 0}
          onPageChange={(_e, newPage) => onPageChange(newPage + 1)}
          rowsPerPage={pagination?.pageSize ?? 10}
          onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Box>
    </Paper>
  );
}
