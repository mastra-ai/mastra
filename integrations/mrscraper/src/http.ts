import { UNAUTHORIZED_APP } from './constants.js';

export type MrScraperApiResult = {
  status_code?: number;
  data?: unknown;
  headers?: Record<string, string>;
  error?: string;
};

function headersToRecord(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return text;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

export async function mrScraperGet(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<MrScraperApiResult> {
  const { timeoutMs = 600_000, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...requestInit, signal: controller.signal });
    if (response.status === 401) {
      return { error: UNAUTHORIZED_APP, status_code: 401 };
    }
    if (!response.ok) {
      return {
        error: `HTTP ${response.status}: ${response.statusText}`,
        status_code: response.status,
      };
    }
    const data = await parseBody(response);
    return {
      status_code: response.status,
      data,
      headers: headersToRecord(response.headers),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message, status_code: undefined };
  } finally {
    clearTimeout(id);
  }
}

export async function mrScraperPostJson(
  url: string,
  body: unknown,
  init?: Omit<RequestInit, 'body'> & { timeoutMs?: number },
): Promise<MrScraperApiResult> {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json');
  }

  const { timeoutMs = 600_000, ...rest } = init ?? {};
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...rest,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 401) {
      const errText =
        url.includes('google/serp') || url.includes('sync.scraper')
          ? 'Unauthorized or invalid access token. Use a valid sync API bearer token from MrScraper.'
          : UNAUTHORIZED_APP;
      return { error: errText, status_code: 401 };
    }

    if (!response.ok) {
      return {
        error: `HTTP ${response.status}: ${response.statusText}`,
        status_code: response.status,
      };
    }

    const data = await parseBody(response);
    return {
      status_code: response.status,
      data,
      headers: headersToRecord(response.headers),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: message, status_code: undefined };
  } finally {
    clearTimeout(id);
  }
}
