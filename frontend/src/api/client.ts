import type { ApiErrorBody } from './types';

const TOKEN_KEY = 'fd_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: { field?: string; message: string }[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Dispatched whenever an authenticated request comes back 401 (expired/revoked session). */
export const SESSION_EXPIRED_EVENT = 'fd:session-expired';

async function parseError(res: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;
  try {
    body = await res.json();
  } catch {
    // non-JSON error body (rare) — fall through to a generic message
  }
  const message = body?.error?.message ?? `Request failed with status ${res.status}`;
  return new ApiError(res.status, message, body?.error?.code, body?.error?.details);
}

/** JSON fetch wrapper: adds the bearer token, throws ApiError on non-2xx, and
 * signals a global "session expired" event when an authenticated call is rejected. */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...init, headers });

  if (!res.ok) {
    const err = await parseError(res);
    // Check the store (not the captured `token`) so that when several authenticated
    // requests are in flight and all come back 401, only the first one signals expiry.
    if (res.status === 401 && token && tokenStore.get()) {
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Downloads a binary/CSV response as a file, using the server's Content-Disposition filename. */
export async function apiDownload(path: string, init: RequestInit = {}): Promise<{ blob: Blob; filename: string }> {
  const token = tokenStore.get();
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`/api${path}`, { ...init, headers });
  if (!res.ok) {
    const err = await parseError(res);
    if (res.status === 401 && token && tokenStore.get()) window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    throw err;
  }
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const filename = match?.[1] ?? 'export.csv';
  const blob = await res.blob();
  return { blob, filename };
}

export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
