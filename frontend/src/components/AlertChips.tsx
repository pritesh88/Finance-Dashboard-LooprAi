import { Alert, Stack } from '@mui/material';
import { useAlerts } from '../context/AlertContext';

/**
 * Reusable dismissible "alert chip" stack (per the spec). Fixed to the top of
 * the viewport so errors/warnings/success feedback from any action are always visible.
 */
export function AlertChips() {
  const { alerts, dismissAlert } = useAlerts();
  if (alerts.length === 0) return null;

  return (
    <Stack
      spacing={1}
      role="status"
      aria-live="polite"
      sx={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: (t) => t.zIndex.snackbar,
        width: { xs: 'calc(100% - 32px)', sm: 'auto' },
        minWidth: { sm: 360 },
        maxWidth: 560,
      }}
    >
      {alerts.map((alert) => (
        <Alert
          key={alert.id}
          severity={alert.severity}
          variant="filled"
          onClose={() => dismissAlert(alert.id)}
          sx={{ boxShadow: 3 }}
        >
          {alert.message}
        </Alert>
      ))}
    </Stack>
  );
}
