/** Shared JSON fetch for the Factory endpoints: cookie auth, server error message. */

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'RequestError';
  }
}

/** Fetch a Factory endpoint and resolve the response, throwing the server's message on failure. */
export async function request(url: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  // 304 is not `ok` but carries no error: callers that sent a validator handle it.
  if (!res.ok && res.status !== 304) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new RequestError(message, res.status);
  }
  return res;
}

export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await request(url, init);
  if (res.status === 304) throw new RequestError('Unexpected 304 for an unconditional request', 304);
  return (await res.json()) as T;
}
