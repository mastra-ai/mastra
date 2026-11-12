import { AsyncLocalStorage } from 'node:async_hooks';

export interface PlatformCredentials {
  accessToken: string;
  projectId?: string;
}

/**
 * Resolves Platform credentials for one tenant (Factory org id). Lets one
 * Factory process serve many Platform projects: every Platform call uses the
 * credentials of the tenant it runs for, never a process-wide token.
 */
export type PlatformCredentialsResolver = (tenantId: string) => PlatformCredentials | null;

const tenantStorage = new AsyncLocalStorage<string>();
let credentialsResolver: PlatformCredentialsResolver | null = null;

/** Installs the per-tenant resolver; replaces the env credentials when set. */
export function setPlatformCredentialsResolver(resolver: PlatformCredentialsResolver | null): void {
  credentialsResolver = resolver;
}

export function hasPlatformCredentialsResolver(): boolean {
  return credentialsResolver !== null;
}

/** Runs `fn` with Platform calls attributed to `tenantId`. */
export function runWithPlatformTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run(tenantId, fn);
}

/** Lists the tenants background workers poll for, making their credentials resolvable. */
export type PlatformTenantLister = () => Promise<string[]>;

let tenantLister: PlatformTenantLister | null = null;

export function setPlatformTenantLister(lister: PlatformTenantLister | null): void {
  tenantLister = lister;
}

/**
 * Runs a background poll once per tenant and returns the shortest next delay.
 * Without a resolver the poll runs once on the env credentials. One tenant's
 * failure does not skip the others; the first error is rethrown after all ran.
 */
export async function pollEachPlatformTenant(poll: () => Promise<number>, idleDelayMs: number): Promise<number> {
  if (!credentialsResolver) return poll();
  const tenants = tenantLister ? await tenantLister() : [];
  let next = Number.POSITIVE_INFINITY;
  let firstError: unknown;
  for (const tenantId of tenants) {
    try {
      next = Math.min(next, await runWithPlatformTenant(tenantId, poll));
    } catch (error) {
      firstError ??= error;
    }
  }
  if (firstError !== undefined) throw firstError;
  return Number.isFinite(next) ? next : idleDelayMs;
}

/**
 * Credentials for this call. With a resolver installed, the tenant must come
 * from `runWithPlatformTenant`; without one, fail closed rather than fall back
 * to a shared token.
 */
export function resolvePlatformCredentials(config: PlatformApiClientConfig): PlatformCredentials {
  if (!credentialsResolver) {
    return { accessToken: config.accessToken, ...(config.projectId ? { projectId: config.projectId } : {}) };
  }
  const tenantId = tenantStorage.getStore();
  if (!tenantId) throw new PlatformApiError('Platform integration: no tenant in context for this call.', 401);
  const credentials = credentialsResolver(tenantId);
  if (!credentials) throw new PlatformApiError(`Platform integration: no credentials for tenant ${tenantId}.`, 401);
  return credentials;
}

export interface PlatformApiClientConfig {
  baseUrl: string;
  /** Ignored when a credentials resolver is installed. */
  accessToken: string;
  /**
   * Mastra project this deployment belongs to. Sent as `x-mastra-project-id`
   * so the platform can attribute proxied provider activity to the project;
   * the platform strips the header before forwarding anything upstream.
   */
  projectId?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_INTEGRATIONS_URL = 'https://integrations.mastra.ai';
const REGIONAL_INTEGRATIONS_URLS: Record<'us' | 'eu', string> = {
  us: 'https://integrations.us.mastra.ai',
  eu: 'https://integrations.eu.mastra.ai',
};

export function platformApiClientConfigFromEnv(): PlatformApiClientConfig {
  // MASTRA_INTEGRATIONS_API_URL is the dedicated override for the
  // integrations service and takes precedence over MASTRA_PLATFORM_REGION.
  // MASTRA_SHARED_API_URL is deliberately not consulted: it configures the
  // shared platform API, and integrations routing is independent of it.
  const integrationsApiUrl = process.env.MASTRA_INTEGRATIONS_API_URL?.trim() || resolveIntegrationsUrl();
  // MASTRA_PLATFORM_ACCESS_TOKEN is the credential Mastra Platform injects
  // into deployed projects; MASTRA_PLATFORM_SECRET_KEY is the org secret key
  // written by project scaffolding. The platform API accepts both forms.
  const accessToken =
    process.env.MASTRA_PLATFORM_ACCESS_TOKEN?.trim() ||
    process.env.MASTRA_PLATFORM_SECRET_KEY?.trim() ||
    (credentialsResolver ? 'resolved-per-tenant' : undefined);
  if (!accessToken) {
    throw new Error(
      'Platform integration: missing required environment variable MASTRA_PLATFORM_ACCESS_TOKEN (or MASTRA_PLATFORM_SECRET_KEY).',
    );
  }
  const projectId = process.env.MASTRA_PROJECT_ID?.trim();
  return {
    baseUrl: normalizeIntegrationsApiUrl(integrationsApiUrl),
    accessToken,
    ...(projectId ? { projectId } : {}),
  };
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

/**
 * Normalizes an integrations API URL to a bare origin. Callers pass fully
 * versioned paths (`/v1/server/...`, `/v2/...`), so a trailing `/v1` — as in
 * legacy platform API URLs like `https://platform.mastra.ai/v1` — is stripped
 * to avoid duplicated version segments.
 */
function normalizeIntegrationsApiUrl(integrationsApiUrl: string): string {
  return integrationsApiUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
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
  readonly #config: PlatformApiClientConfig;
  readonly #fetch: typeof fetch;

  constructor(config: PlatformApiClientConfig) {
    const missing = ['baseUrl', 'accessToken'].filter(field => !config[field as keyof PlatformApiClientConfig]);
    if (missing.length > 0) {
      throw new Error(`Platform integration: missing required config field(s): ${missing.join(', ')}.`);
    }
    this.#baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.#config = config;
    this.#fetch = config.fetchImpl ?? globalThis.fetch;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal; actingUserId?: string },
  ): Promise<T> {
    const credentials = resolvePlatformCredentials(this.#config);
    const response = await this.#send(credentials, method, path, body, options);
    if (!response.ok) {
      const message = redact(await extractError(response), credentials.accessToken);
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
    const credentials = resolvePlatformCredentials(this.#config);
    const response = await this.#send(credentials, method, path, undefined, options, 'manual');
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) return location;
    }
    if (!response.ok) {
      const message = redact(await extractError(response), credentials.accessToken);
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
    credentials: PlatformCredentials,
    method: string,
    path: string,
    body?: unknown,
    options?: { signal?: AbortSignal; actingUserId?: string },
    redirect?: RequestInit['redirect'],
  ): Promise<Response> {
    const headers: Record<string, string> = {
      accept: 'application/json',
      authorization: `Bearer ${credentials.accessToken}`,
    };
    // Project attribution for proxied provider calls. Org-scoped machine
    // tokens carry no project claim, so without this header the platform
    // records proxy activity with no project.
    const projectId = credentials.projectId?.trim();
    if (projectId) {
      headers['x-mastra-project-id'] = projectId;
    }
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
      if (error instanceof Error && error.message.includes(credentials.accessToken)) {
        const redacted = new Error(redact(error.message, credentials.accessToken));
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
