import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DownloadIcon from '@mui/icons-material/Download';
import { ApiError, triggerBrowserDownload } from '../api/client';
import { exportApi } from '../api/endpoints';
import type { ExportPreview, Filters, SortState, TransactionField } from '../api/types';
import { useAlerts } from '../context/AlertContext';
import { useDebounce } from '../hooks/useDebounce';

const ALL_FIELDS: { field: TransactionField; label: string }[] = [
  { field: 'id', label: 'ID' },
  { field: 'date', label: 'Date' },
  { field: 'amount', label: 'Amount' },
  { field: 'category', label: 'Category' },
  { field: 'status', label: 'Status' },
  { field: 'user_id', label: 'User ID' },
  { field: 'user_profile', label: 'User Profile' },
];

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  filters: Filters;
  sort: SortState;
  currentResultCount: number;
  totalCount: number;
}

export function ExportDialog({ open, onClose, filters, sort, currentResultCount, totalCount }: ExportDialogProps) {
  const { pushAlert } = useAlerts();
  const [columns, setColumns] = useState(ALL_FIELDS.map((f) => ({ ...f, selected: true })));
  const [scope, setScope] = useState<'filtered' | 'all'>('filtered');
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (open) {
      setColumns(ALL_FIELDS.map((f) => ({ ...f, selected: true })));
      setScope('filtered');
      setPreview(null);
      setPreviewError(null);
    }
  }, [open]);

  const selectedFields = useMemo(() => columns.filter((c) => c.selected).map((c) => c.field), [columns]);
  const debouncedFields = useDebounce(selectedFields, 300);
  const debouncedScope = useDebounce(scope, 300);
  const isValid = selectedFields.length > 0;

  useEffect(() => {
    if (!open || !isValid) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    setPreviewError(null);
    exportApi
      .preview({ columns: debouncedFields, scope: debouncedScope, filters, sortBy: sort.sortBy, sortOrder: sort.sortOrder })
      .then((res) => {
        if (!cancelled) setPreview(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setPreviewError(err instanceof ApiError ? err.message : 'Could not load a preview.');
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isValid, debouncedFields, debouncedScope]);

  const toggle = (field: TransactionField) =>
    setColumns((prev) => prev.map((c) => (c.field === field ? { ...c, selected: !c.selected } : c)));

  const move = (index: number, dir: -1 | 1) => {
    setColumns((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const selectAll = () => setColumns((prev) => prev.map((c) => ({ ...c, selected: true })));
  const selectNone = () => setColumns((prev) => prev.map((c) => ({ ...c, selected: false })));

  async function handleDownload() {
    if (!isValid) return;
    setDownloading(true);
    try {
      const { blob, filename } = await exportApi.download({
        columns: selectedFields,
        scope,
        filters,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
      });
      triggerBrowserDownload(blob, filename);
      pushAlert('success', `Exported ${filename}.`);
      onClose();
    } catch (err) {
      pushAlert('error', err instanceof ApiError ? err.message : 'Export failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Export transactions to CSV
        <IconButton onClick={onClose} size="small" aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Scope
            </Typography>
            <RadioGroup value={scope} onChange={(e) => setScope(e.target.value as 'filtered' | 'all')}>
              <FormControlLabel value="filtered" control={<Radio />} label={`Current results (${currentResultCount.toLocaleString()} rows)`} />
              <FormControlLabel value="all" control={<Radio />} label={`All transactions (${totalCount.toLocaleString()} rows)`} />
            </RadioGroup>
          </Box>

          <Box>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Columns (drag order with the arrows)</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" onClick={selectAll}>
                  Select all
                </Button>
                <Button size="small" onClick={selectNone}>
                  Select none
                </Button>
              </Stack>
            </Stack>
            {!isValid && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                Select at least one column.
              </Alert>
            )}
            <List dense sx={{ bgcolor: 'background.default', borderRadius: 1, mt: 1 }}>
              {columns.map((col, i) => (
                <ListItem
                  key={col.field}
                  secondaryAction={
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${col.label} up`}>
                        <ArrowUpwardIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton size="small" onClick={() => move(i, 1)} disabled={i === columns.length - 1} aria-label={`Move ${col.label} down`}>
                        <ArrowDownwardIcon fontSize="inherit" />
                      </IconButton>
                    </Stack>
                  }
                >
                  <FormControlLabel
                    control={<Checkbox checked={col.selected} onChange={() => toggle(col.field)} />}
                    label={col.label}
                  />
                </ListItem>
              ))}
            </List>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Preview {preview && `(${preview.totalRows.toLocaleString()} total rows)`}
            </Typography>
            {previewError && <Alert severity="error">{previewError}</Alert>}
            {previewLoading && (
              <Stack sx={{ alignItems: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Stack>
            )}
            {!previewLoading && !previewError && preview && (
              <Box sx={{ overflowX: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {preview.columns.map((c) => (
                        <TableCell key={c.key}>{c.label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {preview.rows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={preview.columns.length || 1} align="center" sx={{ color: 'text.secondary' }}>
                          No rows to preview.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <Divider />
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          startIcon={downloading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={handleDownload}
          disabled={!isValid || downloading}
        >
          {downloading ? 'Preparing…' : 'Download CSV'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
