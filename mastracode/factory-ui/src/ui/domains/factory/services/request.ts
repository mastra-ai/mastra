import type { PLATFORM_KEY_REJECTED } from '@mastra/factory/integrations/platform/api-client';

/** Shared JSON fetch for the Factory endpoints: cookie auth, server error message. */

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  if (!res.ok) throw await requestError(res);
  return (await res.json()) as T;
}

export async function requestError(res: Response): Promise<RequestError> {
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    return new RequestError(body.message || body.error || `Request failed (${res.status})`, res.status, body.error);
  } catch {
    return new RequestError(`Request failed (${res.status})`, res.status);
  }
}

const platformKeyRejectedCode: typeof PLATFORM_KEY_REJECTED = 'platform_key_rejected';

export function isPlatformKeyRejected(error: unknown): boolean {
  return error instanceof RequestError && error.code === platformKeyRejectedCode;
}
