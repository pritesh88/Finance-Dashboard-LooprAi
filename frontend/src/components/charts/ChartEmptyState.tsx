import { Stack, Typography } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

export function ChartEmptyState({ message = 'No data for the current filters' }: { message?: string }) {
  return (
    <Stack spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', height: 280, color: 'text.secondary' }}>
      <InboxIcon fontSize="large" />
      <Typography variant="body2">{message}</Typography>
    </Stack>
  );
}
