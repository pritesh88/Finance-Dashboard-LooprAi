import { Card, CardContent, Grid, Skeleton, Stack, Typography } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import type { DashboardSummary } from '../api/types';
import { formatCurrency } from '../utils/format';
import { chartColors } from '../theme';

interface KpiCardsProps {
  summary: DashboardSummary | null;
  loading: boolean;
}

function Kpi({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Stack
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: color ? `${color}1a` : 'action.hover',
              color: color ?? 'text.secondary',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Stack>
          <Stack sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" noWrap>
              {label}
            </Typography>
            <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
              {value}
            </Typography>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ summary, loading }: KpiCardsProps) {
  const cards = [
    { label: 'Revenue', icon: <TrendingUpIcon />, color: chartColors.revenue, value: summary ? formatCurrency(summary.totalRevenue) : '' },
    { label: 'Expenses', icon: <TrendingDownIcon />, color: chartColors.expenses, value: summary ? formatCurrency(summary.totalExpenses) : '' },
    { label: 'Net income', icon: <AccountBalanceWalletIcon />, color: chartColors.net, value: summary ? formatCurrency(summary.netIncome) : '' },
    { label: 'Transactions', icon: <ReceiptLongIcon />, color: '#4a3aa7', value: summary ? summary.transactionCount.toLocaleString() : '' },
    { label: 'Pending', icon: <HourglassEmptyIcon />, color: '#eda100', value: summary ? summary.pendingCount.toLocaleString() : '' },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {cards.map((c) => (
        <Grid key={c.label} size={{ xs: 12, sm: 6, md: 12 / 5 }}>
          {loading ? (
            <Card variant="outlined">
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="80%" height={32} />
              </CardContent>
            </Card>
          ) : (
            <Kpi icon={c.icon} label={c.label} value={c.value} color={c.color} />
          )}
        </Grid>
      ))}
    </Grid>
  );
}
