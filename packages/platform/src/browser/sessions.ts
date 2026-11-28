import { PlatformApiError, PlatformClient } from '@mastra/platform-workspace';
import type { PlatformAccessToken } from '@mastra/platform-workspace';

/** Options sent when Platform starts a hosted browser. */
export interface PlatformBrowserSessionOptions {
  /** Seconds the browser survives with no CDP client connected. Platform defaults to 300. */
  idleTimeoutSeconds?: number;
  /** Total lifetime cap in seconds. Omit to use the vendor's own limit. */
  maxDurationSeconds?: number;
  /** Ask the vendor for anti-bot fingerprinting, where it offers it. */
  stealth?: boolean;
  /** Record the session so it can be replayed in the Platform console, where the vendor offers it. */
  recording?: boolean;
}

export interface PlatformBrowserSessionsConfig {
  accessToken?: PlatformAccessToken;
  projectId?: string;
  environmentId?: string;
  fetch?: typeof fetch;
  session?: PlatformBrowserSessionOptions;
  viewport?: { width: number; height: number };
}

export interface OpenedPlatformBrowserSession {
  id: string;
  cdpUrl: string;
}

/** Reasons the hosted browser routes give that a user can act on. */
function describeFailure(error: unknown): Error {
  if (!(error instanceof PlatformApiError)) return error instanceof Error ? error : new Error(String(error));
  const detail = error.proxyMessage ? `: ${error.proxyMessage}` : '';
  switch (error.status) {
    case 401:
    case 403:
      return new Error(`PlatformBrowser: the access token was refused (${error.status})${detail}`);
    case 404:
      return new Error(`PlatformBrowser: hosted browsers are not available for this project (404)${detail}`);
    case 429:
      return new Error(`PlatformBrowser: too many browsers started, wait a minute and try again (429)${detail}`);
    case 501:
      return new Error(`PlatformBrowser: hosted browsers are not configured on this Platform deployment (501)`);
    default:
      return new Error(`PlatformBrowser: request failed (${error.status})${detail}`);
  }
}

/** Starts, connects to and ends hosted browsers through the Platform workspace proxy. */
export class PlatformBrowserSessions {
  readonly #client: PlatformClient;
  readonly #environmentId: string;
  readonly #session: PlatformBrowserSessionOptions;
  readonly #viewport: { width: number; height: number } | undefined;

  constructor(config: PlatformBrowserSessionsConfig) {
    const environmentId = config.environmentId ?? process.env.MASTRA_ENVIRONMENT_ID;
    if (!environmentId) throw new Error('PlatformBrowser: environmentId is required');
    try {
      this.#client = new PlatformClient({
        accessToken: config.accessToken,
        projectId: config.projectId,
        fetch: config.fetch,
      });
    } catch (error) {
      throw new Error(`PlatformBrowser: ${error instanceof Error ? error.message : String(error)}`);
    }
    this.#environmentId = environmentId;
    this.#session = config.session ?? {};
    this.#viewport = config.viewport;
  }

  /** Starts a browser and returns a CDP URL for it. Ends the browser again if the URL can't be minted. */
  async open(): Promise<OpenedPlatformBrowserSession> {
    const id = await this.#start();
    try {
      return { id, cdpUrl: await this.#mintCdpUrl(id) };
    } catch (error) {
      await this.end(id).catch(() => {});
      throw error;
    }
  }

  /** Ends a browser. Ending one that already ended is a no-op on Platform. */
  async end(id: string): Promise<void> {
    try {
      await this.#client.requestProject(`/browsers/${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (error) {
      if (error instanceof PlatformApiError && error.status === 404) return;
      throw describeFailure(error);
    }
  }

  async #start(): Promise<string> {
    const response = await this.#call('/browsers', {
      environmentId: this.#environmentId,
      ...this.#session,
      ...(this.#viewport && { viewport: this.#viewport }),
    });
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('id' in body) || typeof body.id !== 'string') {
      throw new Error('PlatformBrowser: Platform returned no browser id');
    }
    return body.id;
  }

  async #mintCdpUrl(id: string): Promise<string> {
    const response = await this.#call(`/browsers/${encodeURIComponent(id)}/cdp-url`, {});
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || !('url' in body) || typeof body.url !== 'string') {
      throw new Error('PlatformBrowser: Platform returned no CDP URL');
    }
    return body.url;
  }

  async #call(path: string, body: Record<string, unknown>): Promise<Response> {
    try {
      return await this.#client.requestProject(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw describeFailure(error);
    }
  }
}
