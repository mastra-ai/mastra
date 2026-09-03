export type FetchLike = typeof fetch;
export type Sleep = (milliseconds: number, signal?: AbortSignal) => Promise<void>;

export const defaultSleep: Sleep = async (milliseconds, signal) => {
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener('abort', abort);
      resolve();
    };
    const timeout = setTimeout(finish, milliseconds);
    const abort = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      reject(signal?.reason ?? new Error('Operation aborted'));
    };
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
  });
};

export function validateHttpOrigin(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch (cause) {
    throw new Error(`${label} must be a valid HTTP(S) URL.`, { cause });
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${label} must not contain credentials, a query, or a fragment.`);
  }
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new Error(`${label} must use HTTPS (HTTP is only allowed for localhost).`);
  }
  return url;
}

export function parseRetryAfter(response: Response, fallbackMilliseconds: number): number {
  const raw = response.headers.get('retry-after');
  if (!raw) return fallbackMilliseconds;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : fallbackMilliseconds;
}

export async function readResponseText(response: Response, maxBytes: number): Promise<string> {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`HTTP response exceeds the ${maxBytes}-byte safety limit.`);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let result = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw new Error(`HTTP response exceeds the ${maxBytes}-byte safety limit.`);
    }
    result += decoder.decode(chunk.value, { stream: true });
  }
  return result + decoder.decode();
}

export function backoffMilliseconds(attempt: number): number {
  const base = Math.min(30_000, 500 * 2 ** attempt);
  return Math.round(base * (0.75 + Math.random() * 0.5));
}
