const currency = (import.meta.env.VITE_CURRENCY as string | undefined)?.trim() || 'USD';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
  maximumFractionDigits: 2,
});

export const formatCurrency = (amount: number): string => currencyFormatter.format(amount);

/** All dates in this app are displayed in UTC (the dataset and API are UTC-only). */
export const formatDateUTC = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'UTC' });
};

export const formatDateTimeUTC = (iso: string): string => {
  const d = new Date(iso);
  return `${formatDateUTC(iso)} ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false })} UTC`;
};

export const formatMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export const formatPercent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

/** Two-letter initials from a user id like "user_003" -> "U3", or a name -> "JD". */
export const initialsFor = (label: string): string => {
  if (/^user_?\d+$/i.test(label)) {
    const digits = label.replace(/\D/g, '');
    return `U${digits.slice(-1) || digits}`.slice(0, 2).toUpperCase();
  }
  const parts = label.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : label.slice(0, 2);
  return letters.toUpperCase();
};

const AVATAR_PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#4a3aa7'];

/** Deterministic color per id, drawn from the validated categorical palette. */
export const colorFor = (label: string): string => {
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
};
