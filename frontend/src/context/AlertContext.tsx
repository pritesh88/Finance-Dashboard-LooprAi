import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type AlertSeverity = 'error' | 'warning' | 'success' | 'info';

export interface AlertChipData {
  id: string;
  severity: AlertSeverity;
  message: string;
}

interface AlertContextValue {
  alerts: AlertChipData[];
  pushAlert: (severity: AlertSeverity, message: string) => void;
  dismissAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

let counter = 0;
const nextId = () => {
  counter += 1;
  return `alert-${Date.now()}-${counter}`;
};

const AUTO_DISMISS_MS: Partial<Record<AlertSeverity, number>> = {
  success: 4000,
  info: 5000,
};

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertChipData[]>([]);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const pushAlert = useCallback(
    (severity: AlertSeverity, message: string) => {
      const id = nextId();
      setAlerts((prev) => [...prev, { id, severity, message }]);
      const timeout = AUTO_DISMISS_MS[severity];
      if (timeout) setTimeout(() => dismissAlert(id), timeout);
    },
    [dismissAlert],
  );

  const value = useMemo(() => ({ alerts, pushAlert, dismissAlert }), [alerts, pushAlert, dismissAlert]);
  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider');
  return ctx;
}
