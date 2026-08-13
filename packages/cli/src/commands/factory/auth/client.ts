export const MASTRA_PLATFORM_API_URL = process.env.MASTRA_PLATFORM_API_URL || 'https://platform.mastra.ai';

export function extractApiErrorDetail(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as Record<string, unknown>;
  const detail =
    (typeof value.detail === 'string' && value.detail.trim()) ||
    (typeof value.message === 'string' && value.message.trim()) ||
    (typeof value.error === 'string' && value.error.trim()) ||
    undefined;
  const fieldErrors = Array.isArray(value.errors)
    ? value.errors
        .map(error => {
          if (!error || typeof error !== 'object') return '';
          const fieldError = error as Record<string, unknown>;
          return [fieldError.field, fieldError.message].filter(item => typeof item === 'string' && item).join(' — ');
        })
        .filter(Boolean)
        .join('; ')
    : '';
  if (detail && fieldErrors) return `${detail}: ${fieldErrors}`;
  return detail ?? (fieldErrors || undefined);
}

export function authHeaders(token: string, orgId?: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    ...(orgId ? { 'x-mastra-org-id': orgId } : {}),
  };
}

export async function platformFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  const { loadCredentials, tryRefreshToken } = await import('./credentials.js');
  const credentials = await loadCredentials();
  if (!credentials) return response;
  const token = await tryRefreshToken(credentials);
  if (!token) return response;

  const request = input instanceof Request ? input.clone() : input;
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(request, { ...init, headers });
}
