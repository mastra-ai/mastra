export interface PlatformClientOptions {
  accessToken?: string;
  projectId?: string;
  proxyUrl?: string;
  fetch?: typeof fetch;
}

export interface PlatformRequestOptions extends RequestInit {
  query?: Record<string, string | number | boolean | undefined>;
}

const DEFAULT_PROXY_URL = 'https://workspace-proxy.mastra.cloud';

export function requireOption(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function resolvePlatformOptions(options: PlatformClientOptions) {
  return {
    accessToken: requireOption(options.accessToken ?? process.env.MASTRA_PLATFORM_ACCESS_TOKEN, 'accessToken'),
    projectId: requireOption(options.projectId ?? process.env.MASTRA_PROJECT_ID, 'projectId'),
    proxyUrl: (options.proxyUrl ?? process.env.MASTRA_WORKSPACE_PROXY_URL ?? DEFAULT_PROXY_URL).replace(/\/$/, ''),
    fetch: options.fetch ?? fetch,
  };
}

export class PlatformApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Platform proxy request failed with ${status}${body ? `: ${body}` : ''}`);
    this.name = 'PlatformApiError';
    this.status = status;
    this.body = body;
  }
}

export class PlatformClient {
  readonly accessToken: string;
  readonly projectId: string;
  readonly proxyUrl: string;
  readonly fetch: typeof fetch;

  constructor(options: PlatformClientOptions) {
    const resolved = resolvePlatformOptions(options);
    this.accessToken = resolved.accessToken;
    this.projectId = resolved.projectId;
    this.proxyUrl = resolved.proxyUrl;
    this.fetch = resolved.fetch;
  }

  async request(path: string, options: PlatformRequestOptions = {}): Promise<Response> {
    const url = new URL(`${this.proxyUrl}/v1/projects/${encodeURIComponent(this.projectId)}${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }

    const headers = new Headers(options.headers);
    headers.set('authorization', `Bearer ${this.accessToken}`);

    const response = await this.fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new PlatformApiError(response.status, await response.text());
    }
    return response;
  }
}
