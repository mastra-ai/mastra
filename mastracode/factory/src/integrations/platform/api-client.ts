export interface PlatformApiClientConfig {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_INTEGRATIONS_URL = 'https://integrations.mastra.ai/v1';
const REGIONAL_INTEGRATIONS_URLS: Record<'us' | 'eu', string> = {
  us: 'https://integrations.us.mastra.ai/v1',
  eu: 'https://integrations.eu.mastra.ai/v1',
};

export function platformApiClientConfigFromEnv(): PlatformApiClientConfig {
  const integrationsApiUrl = process.env.MASTRA_INTEGRATIONS_API_URL?.trim() || resolveIntegrationsUrl();
  const accessToken = process.env.MASTRA_PLATFORM_SECRET_KEY?.trim();
  if (!accessToken) {
    throw new Error('Platform integration: missing required environment variable MASTRA_PLATFORM_SECRET_KEY.');
  }
  return { baseUrl: normalizeIntegrationsApiUrl(integrationsApiUrl), accessToken };
}

/**
 * Resolves the integrations API base URL from `MASTRA_PLATFORM_REGION`
 * (case-insensitive `us` or `eu`), falling back to the global default.
 * Unknown region values fall through to the global default.
 */
function resolveIntegrationsUrl(): string {
  const region = process.env.MASTRA_PLATFORM_REGION?.trim().toLowerCase();
  if (region === 'us' || region === 'eu') return REGIONAL_INTEGRATIONS_URLS[region];
  return DEFAULT_INTEGRATIONS_URL;
}

function normalizeIntegrationsApiUrl(integrationsApiUrl: string): string {
  return integrationsApiUrl.replace(/\/+$/, '');
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

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal; actingUserId?: string },
  ): Promise<T> {
    const response = await this.#send(method, path, body, options);
    if (!response.ok) {
      const message = redact(await extractError(response), this.#accessToken);
      const retryAfterSeconds = parseRetryAfter(response.headers.get('retry-after'));
      logPlatformError('Platform API request failed', {
        method,
        path,
        status: response.status,
        retryAfterSeconds,
        message,
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
    options?: { signal?: AbortSignal; actingUserId?: string },
    redirect?: RequestInit['redirect'],
  ): Promise<Response> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${this.#accessToken}`,
    };
    // Acting end-user for platform GitHub writes: the platform resolves this
    // user's GitHub OAuth connection (org-scoped) so issues/PRs are authored
    // by the human instead of the App bot. Ignored by older platforms.
    if (options?.actingUserId) {
      headers['x-acting-user-id'] = options.actingUserId;
    }
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
      if (error instanceof Error && error.message.includes(this.#accessToken)) {
        const redacted = new Error(redact(error.message, this.#accessToken));
        redacted.name = error.name;
        logPlatformError('Platform API transport error', {
          method,
          path,
          name: redacted.name,
          message: redacted.message,
        });
        throw redacted;
      }
      logPlatformError('Platform API transport error', {
        method,
        path,
        name: error instanceof Error ? error.name : undefined,
        message: error instanceof Error ? error.message : String(error),
      });
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

export function logPlatformWarn(message: string, fields?: Record<string, unknown>): void {
  writePlatformLog('warn', message, fields);
}

export function logPlatformError(message: string, fields?: Record<string, unknown>): void {
  writePlatformLog('error', message, fields);
}

function writePlatformLog(level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void {
  const metadata = fields ? ` ${JSON.stringify(stripUndefined(fields))}` : '';
  process.stderr.write(`[Mastra Factory] ${level.toUpperCase()} ${message}${metadata}\n`);
}

function stripUndefined(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
}
