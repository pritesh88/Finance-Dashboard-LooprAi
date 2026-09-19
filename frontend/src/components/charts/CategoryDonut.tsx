import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts';
import { Card, CardContent, Typography } from '@mui/material';
import type { CategoryBreakdown } from '../../api/types';
import { formatCurrency, formatPercent } from '../../utils/format';
import { chartColors } from '../../theme';
import { ChartEmptyState } from './ChartEmptyState';

export function CategoryDonut({ data, loading }: { data: CategoryBreakdown[]; loading: boolean }) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
          Category breakdown
        </Typography>
        {!loading && data.length === 0 ? (
          <ChartEmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data}
                dataKey="amount"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={64}
                outerRadius={100}
                paddingAngle={data.length > 1 ? 2 : 0}
                isAnimationActive={false}
                label={(props: PieLabelRenderProps) => {
                  // Recharts nests the original datum under `payload`, not spread onto props.
                  const { category, share } = (props as unknown as { payload: CategoryBreakdown }).payload;
                  return `${category} ${formatPercent(share)}`;
                }}
                labelLine={false}
              >
                {data.map((entry) => (
                  <Cell key={entry.category} fill={chartColors.categories[entry.category] ?? chartColors.ink.muted} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), String(name)]} contentStyle={{ borderRadius: 8, border: `1px solid ${chartColors.ink.grid}` }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
