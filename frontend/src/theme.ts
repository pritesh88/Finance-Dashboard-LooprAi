import { createTheme } from '@mui/material/styles';

/**
 * A small, functional theme — the brief explicitly deprioritizes decorative UI.
 * Status colors double as the chart palette so charts, chips and KPI cards agree.
 */
export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2a78d6' },
    success: { main: '#0ca30c' },
    error: { main: '#d03b3b' },
    warning: { main: '#eb6834' },
    background: { default: '#f4f6f9', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: [
      'Inter',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      'Helvetica',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)' },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
    },
  },
});

/**
 * Chart series colors (validated categorical pair, see dataviz skill palette.md):
 * Revenue = blue (slot 1), Expense = orange (slot 2). This identity mapping is
 * used consistently everywhere a category appears — KPI cards, chips, all three
 * charts — so color never means something different from one place to another.
 * Passes CVD (ΔE 24.7) and normal-vision (ΔE 33.6) separation at --mode light.
 */
export const chartColors = {
  revenue: '#2a78d6',
  expenses: '#eb6834',
  net: '#008300',
  categories: {
    Revenue: '#2a78d6',
    Expense: '#eb6834',
  } as Record<string, string>,
  ink: { primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' },
};
