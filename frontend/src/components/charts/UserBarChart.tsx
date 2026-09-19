import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, Typography } from '@mui/material';
import type { UserBreakdown } from '../../api/types';
import { formatCurrency } from '../../utils/format';
import { chartColors } from '../../theme';
import { ChartEmptyState } from './ChartEmptyState';

export function UserBarChart({ data, loading }: { data: UserBreakdown[]; loading: boolean }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Revenue vs. expenses by user
        </Typography>
        {!loading && data.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.ink.grid} vertical={false} />
              <XAxis dataKey="user_id" tick={{ fill: chartColors.ink.muted, fontSize: 12 }} axisLine={{ stroke: chartColors.ink.axis }} tickLine={false} />
              <YAxis
                tickFormatter={(v: number) => formatCurrency(v).replace(/\.00$/, '')}
                tick={{ fill: chartColors.ink.muted, fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={80}
              />
              <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), String(name)]} contentStyle={{ borderRadius: 8, border: `1px solid ${chartColors.ink.grid}` }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Bar dataKey="revenue" name="Revenue" fill={chartColors.revenue} radius={[3, 3, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill={chartColors.expenses} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
