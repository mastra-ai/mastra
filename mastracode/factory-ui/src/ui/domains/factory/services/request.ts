/** Shared JSON fetch for the Factory endpoints: cookie auth, server error message. */
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const res = await fetch(url, { ...init, headers, credentials: 'include' });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      /* ignore non-JSON */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}
