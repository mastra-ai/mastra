export interface PlatformApiClientConfig {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export function platformApiClientConfigFromEnv(): PlatformApiClientConfig {
  const sharedApiUrl = process.env.MASTRA_SHARED_API_URL?.trim() || 'https://platform.mastra.ai/v1';
  const accessToken = process.env.MASTRA_PLATFORM_SECRET_KEY?.trim();
  if (!accessToken) {
    throw new Error('Platform integration: missing required environment variable MASTRA_PLATFORM_SECRET_KEY.');
  }
  return { baseUrl: normalizeSharedApiUrl(sharedApiUrl), accessToken };
}

function normalizeSharedApiUrl(sharedApiUrl: string): string {
  return sharedApiUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
}

export class PlatformApiError extends Error {
  readonly status: number;
  readonly retryAfterSeconds: number | null;

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'PlatformApiError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface PlatformApiRequestOptions {
  signal?: AbortSignal;
  logErrorDetail?: boolean;
}

export class PlatformApiClient {
  readonly #baseUrl: string;
  readonly #accessToken: string;
  readonly #fetch: typeof fetch;

  constructor(config: PlatformApiClientConfig) {
    const missing = ['baseUrl', 'accessToken'].filter(field => !config[field as keyof PlatformApiClientConfig]);
    if (missing.length > 0) {
      throw new Error(`Platform integration: missing required config field(s): ${missing.join(', ')}.`);
    }
    this.#baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.#accessToken = config.accessToken;
    this.#fetch = config.fetchImpl ?? globalThis.fetch;
  }

  async request<T>(method: string, path: string, body?: unknown, options?: PlatformApiRequestOptions): Promise<T> {
    const response = await this.#send(method, path, body, options);
    if (!response.ok) {
      const message = redact(await extractError(response), this.#accessToken);
      const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
      logPlatformError('Platform API request failed', {
        method,
        path,
        status: response.status,
        retryAfterSeconds,
        ...(options?.logErrorDetail === false ? {} : { message }),
      });
      throw new PlatformApiError(message, response.status, retryAfterSeconds);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async requestRedirect(method: string, path: string, options?: { signal?: AbortSignal }): Promise<string> {
    const response = await this.#send(method, path, undefined, options, 'manual');
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) return location;
    }
    if (!response.ok) {
      const message = redact(await extractError(response), this.#accessToken);
      const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
      logPlatformError('Platform API redirect request failed', {
        method,
        path,
        status: response.status,
        retryAfterSeconds,
        message,
      });
      throw new PlatformApiError(message, response.status, retryAfterSeconds);
    }
    logPlatformError('Platform API request did not return a redirect', { method, path, status: response.status });
    throw new PlatformApiError('Platform API request did not return a redirect.', response.status);
  }

  async #send(
    method: string,
    path: string,
    body?: unknown,
    options?: PlatformApiRequestOptions,
    redirect?: RequestInit['redirect'],
  ): Promise<Response> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${this.#accessToken}`,
    };
    const timeoutSignal = AbortSignal.timeout(15_000);
    const init: RequestInit = {
      method,
      headers,
      redirect,
      signal: options?.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal,
    };
    if (body !== undefined) {
      headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    try {
      return await this.#fetch(`${this.#baseUrl}${path}`, init);
    } catch (error) {
      if (options?.logErrorDetail === false) {
        logPlatformError('Platform API transport error', { method, path });
        throw error;
      }
      if (error instanceof Error) {
        const rawName = error.name;
        const rawMessage = error.message;
        const name = redact(rawName, this.#accessToken);
        const message = redact(rawMessage, this.#accessToken);
        logPlatformError('Platform API transport error', { method, path, name, message });
        if (message !== rawMessage || name !== rawName) {
          const redacted = new Error(message);
          redacted.name = name;
          throw redacted;
        }
        throw error;
      }
      logPlatformError('Platform API transport error', { method, path, message: String(error) });
      throw error;
    }
  }
}

async function extractError(response: Response): Promise<string> {
  try {
    const data = (await response.clone().json()) as Record<string, unknown>;
    for (const field of ['detail', 'error', 'title']) {
      if (typeof data[field] === 'string' && data[field]) return data[field];
    }
  } catch {
    // Fall through to the status-based message.
  }
  return `Platform API request failed (${response.status})`;
}

function redact(message: string, accessToken: string): string {
  return message.split(accessToken).join('[REDACTED]');
}

export function logPlatformInfo(message: string, fields?: Record<string, unknown>): void {
  writePlatformLog('info', message, fields);
}

export function logPlatformError(message: string, fields?: Record<string, unknown>): void {
  writePlatformLog('error', message, fields);
}

function writePlatformLog(level: 'info' | 'error', message: string, fields?: Record<string, unknown>): void {
  const metadata = fields ? ` ${JSON.stringify(stripUndefined(fields))}` : '';
  process.stderr.write(`[MastraCode Web] ${level.toUpperCase()} ${message}${metadata}\n`);
}

function stripUndefined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
}
