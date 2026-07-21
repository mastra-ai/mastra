export interface PlatformApiClientConfig {
  baseUrl: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export function platformApiClientConfigFromEnv(): PlatformApiClientConfig {
  const sharedApiUrl = process.env.MASTRA_SHARED_API_URL?.trim() || 'https://platform.mastra.ai/v1';
  const accessToken = process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error('Platform integration: missing required environment variable MASTRA_PLATFORM_ACCESS_TOKEN.');
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

  async request<T>(method: string, path: string, body?: unknown, options?: { signal?: AbortSignal }): Promise<T> {
    const response = await this.#send(method, path, body, options);
    if (!response.ok) {
      throw new PlatformApiError(
        redact(await extractError(response), this.#accessToken),
        response.status,
        parseRetryAfter(response.headers.get('retry-after')),
      );
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
      throw new PlatformApiError(
        redact(await extractError(response), this.#accessToken),
        response.status,
        parseRetryAfter(response.headers.get('retry-after')),
      );
    }
    throw new PlatformApiError('Platform API request did not return a redirect.', response.status);
  }

  async #send(
    method: string,
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal },
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
      if (error instanceof Error && error.message.includes(this.#accessToken)) {
        const redacted = new Error(redact(error.message, this.#accessToken));
        redacted.name = error.name;
        throw redacted;
      }
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

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
}
