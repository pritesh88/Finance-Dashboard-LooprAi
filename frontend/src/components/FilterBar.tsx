import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Button,
  type SelectChangeEvent,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import type { FilterOptions, Filters } from '../api/types';
import { useDebounce } from '../hooks/useDebounce';

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  options: FilterOptions | null;
}

function MultiSelect({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: string[] | undefined;
  choices: string[];
  onChange: (v: string[] | undefined) => void;
}) {
  const handleChange = (e: SelectChangeEvent<string[]>) => {
    const v = e.target.value;
    const arr = typeof v === 'string' ? v.split(',') : v;
    onChange(arr.length ? arr : undefined);
  };
  return (
    <Select
      multiple
      displayEmpty
      size="small"
      value={value ?? []}
      onChange={handleChange}
      renderValue={(selected) => (selected.length ? `${label} (${selected.length})` : label)}
      sx={{ minWidth: 150 }}
      inputProps={{ 'aria-label': label }}
    >
      {choices.map((c) => (
        <MenuItem key={c} value={c}>
          {c}
        </MenuItem>
      ))}
    </Select>
  );
}

export function FilterBar({ filters, onChange, options }: FilterBarProps) {
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, 350);

  useEffect(() => {
    if (debouncedSearch !== (filters.search ?? '')) {
      onChange({ ...filters, search: debouncedSearch || undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });

  const activeChips: { key: keyof Filters; label: string; onRemove: () => void }[] = [];
  if (filters.search) activeChips.push({ key: 'search', label: `Search: "${filters.search}"`, onRemove: () => { setSearchInput(''); set('search', undefined); } });
  (filters.category ?? []).forEach((c) =>
    activeChips.push({ key: 'category', label: `Category: ${c}`, onRemove: () => set('category', filters.category?.filter((x) => x !== c)) }),
  );
  (filters.status ?? []).forEach((s) =>
    activeChips.push({ key: 'status', label: `Status: ${s}`, onRemove: () => set('status', filters.status?.filter((x) => x !== s)) }),
  );
  (filters.user_id ?? []).forEach((u) =>
    activeChips.push({ key: 'user_id', label: `User: ${u}`, onRemove: () => set('user_id', filters.user_id?.filter((x) => x !== u)) }),
  );
  if (filters.dateFrom) activeChips.push({ key: 'dateFrom', label: `From: ${filters.dateFrom}`, onRemove: () => set('dateFrom', undefined) });
  if (filters.dateTo) activeChips.push({ key: 'dateTo', label: `To: ${filters.dateTo}`, onRemove: () => set('dateTo', undefined) });
  if (filters.minAmount !== undefined) activeChips.push({ key: 'minAmount', label: `Min: ${filters.minAmount}`, onRemove: () => set('minAmount', undefined) });
  if (filters.maxAmount !== undefined) activeChips.push({ key: 'maxAmount', label: `Max: ${filters.maxAmount}`, onRemove: () => set('maxAmount', undefined) });

  const clearAll = () => {
    setSearchInput('');
    onChange({});
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search transactions…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
            htmlInput: { 'aria-label': 'Search transactions' },
          }}
          sx={{ minWidth: 220 }}
        />
        <MultiSelect label="Category" value={filters.category} choices={options?.categories ?? []} onChange={(v) => set('category', v)} />
        <MultiSelect label="Status" value={filters.status} choices={options?.statuses ?? []} onChange={(v) => set('status', v)} />
        <MultiSelect label="User" value={filters.user_id} choices={options?.userIds ?? []} onChange={(v) => set('user_id', v)} />
        <TextField
          size="small"
          label="Date from"
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(e) => set('dateFrom', e.target.value || undefined)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          label="Date to"
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(e) => set('dateTo', e.target.value || undefined)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ minWidth: 150 }}
        />
        <TextField
          size="small"
          label="Min amount"
          type="number"
          value={filters.minAmount ?? ''}
          onChange={(e) => set('minAmount', e.target.value === '' ? undefined : Number(e.target.value))}
          sx={{ minWidth: 110 }}
        />
        <TextField
          size="small"
          label="Max amount"
          type="number"
          value={filters.maxAmount ?? ''}
          onChange={(e) => set('maxAmount', e.target.value === '' ? undefined : Number(e.target.value))}
          sx={{ minWidth: 110 }}
        />
        <Button size="small" startIcon={<ClearIcon />} onClick={clearAll} disabled={activeChips.length === 0}>
          Clear all
        </Button>
      </Stack>

      {activeChips.length > 0 && (
        <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {activeChips.map((chip, i) => (
            <Chip key={`${chip.key}-${i}`} label={chip.label} onDelete={chip.onRemove} size="small" />
          ))}
        </Box>
      )}
    </Paper>
  );
}
