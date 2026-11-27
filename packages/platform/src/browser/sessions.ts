import type { PlatformClient, PlatformRequestOptions } from '@mastra/platform-workspace';

export type PlatformBrowserSessionStatus = 'starting' | 'running' | 'ended' | 'failed';

/** A hosted browser session, as the Platform records it. */
export interface PlatformBrowserSession {
  id: string;
  environmentId: string;
  platformProjectId: string;
  /** The vendor running the browser. */
  provider: 'browserbase' | 'kernel' | 'sandbox';
  region: string;
  status: PlatformBrowserSessionStatus;
  /** Why it ended: `user` when someone ended it, `provider` when the vendor did (for example after the idle timeout). */
  endReason: 'user' | 'provider' | 'max_duration' | 'orphaned' | null;
  error: string | null;
  idleTimeoutSeconds: number;
  maxDurationSeconds: number | null;
  viewport: { width: number; height: number } | null;
  stealth: boolean;
  recording: boolean;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlatformBrowserSessionInput {
  environmentId: string;
  /** How long the browser survives with nothing connected to it. Defaults to 300. */
  idleTimeoutSeconds?: number;
  /** Total lifetime cap. Defaults to the vendor's own limit. */
  maxDurationSeconds?: number;
  viewport?: { width: number; height: number };
  stealth?: boolean;
  /** Defaults to on when the vendor can record. */
  recording?: boolean;
}

/** What hosted browsers can do in the project's region. */
export interface PlatformBrowserCapabilities {
  region: string;
  stealth: boolean;
  liveView: { readOnly: boolean } | null;
  recording: { formats: ('mp4' | 'rrweb')[] } | null;
  activityLog: boolean;
  maxIdleTimeoutSeconds: number;
  maxDurationSeconds: number | null;
}

/** A URL that expires. Anyone holding it can use the session until then. */
export interface PlatformBrowserUrl {
  url: string;
  expiresAt: string | null;
}

export interface PlatformBrowserActivity {
  /** Oldest first. URLs drop their query string, and credentials and typed input are redacted. */
  entries: {
    at: string;
    kind: 'navigation' | 'console' | 'network' | 'protocol';
    level: 'info' | 'warning' | 'error';
    message: string;
    url: string | null;
    details: Record<string, unknown> | null;
  }[];
  nextCursor: string | null;
}

export interface PlatformBrowserRecording {
  recordingId: string;
  format: 'mp4' | 'rrweb';
  status: 'recording' | 'ready' | 'failed';
  startedAt: string | null;
  endedAt: string | null;
}

export interface PlatformBrowserUsage {
  since: string;
  until: string;
  sessions: number;
  failed: number;
  live: number;
  browserSeconds: number;
}

/**
 * The project's hosted browser sessions. Use `createBrowser` or `getBrowser` on the project to
 * drive one from an agent.
 */
export class PlatformBrowserSessions {
  constructor(private readonly client: PlatformClient) {}

  async #request<T>(path: string, options: PlatformRequestOptions = {}): Promise<T> {
    const { body, ...rest } = options;
    const response = await this.client.requestProject(`/browsers${path}`, {
      ...rest,
      ...(body !== undefined && { body, headers: { 'content-type': 'application/json' } }),
    });
    return (await response.json()) as T;
  }

  #session(sessionId: string, suffix = '') {
    return `/${encodeURIComponent(sessionId)}${suffix}`;
  }

  /** Which features the project's browser vendor supports, and its limits. */
  capabilities(): Promise<PlatformBrowserCapabilities> {
    return this.#request('/capabilities');
  }

  /** Starts a browser session. It is running when this resolves. */
  create(input: CreatePlatformBrowserSessionInput): Promise<PlatformBrowserSession> {
    return this.#request('', { method: 'POST', body: JSON.stringify(input) });
  }

  /** Browser sessions in an environment, newest first. */
  async list(environmentId: string): Promise<PlatformBrowserSession[]> {
    const sessions: PlatformBrowserSession[] = [];
    for (let page = 1; ; page++) {
      const result = await this.#request<{ browserSessions: PlatformBrowserSession[]; hasMore: boolean }>('', {
        query: { environmentId, page },
      });
      sessions.push(...result.browserSessions);
      if (!result.hasMore) return sessions;
    }
  }

  get(sessionId: string): Promise<PlatformBrowserSession> {
    return this.#request(this.#session(sessionId));
  }

  /** Ends a session and releases its browser. */
  end(sessionId: string): Promise<PlatformBrowserSession> {
    return this.#request(this.#session(sessionId), { method: 'DELETE' });
  }

  /**
   * A `wss://` URL for Playwright `connectOverCDP` or any CDP client. It accepts new connections for
   * `ttlSeconds` (default 300); a connection opened before then stays open.
   */
  cdpUrl(sessionId: string, options: { ttlSeconds?: number } = {}): Promise<PlatformBrowserUrl> {
    return this.#request(this.#session(sessionId, '/cdp-url'), { method: 'POST', body: JSON.stringify(options) });
  }

  /** A URL to watch the running session, read-only unless `readOnly` is false. */
  liveView(sessionId: string, options: { readOnly?: boolean } = {}): Promise<PlatformBrowserUrl> {
    return this.#request(this.#session(sessionId, '/live-view'), { method: 'POST', body: JSON.stringify(options) });
  }

  /** One page of the session's navigation, console and network activity. */
  activity(sessionId: string, options: { cursor?: string; limit?: number } = {}): Promise<PlatformBrowserActivity> {
    return this.#request(this.#session(sessionId, '/activity'), { query: options });
  }

  async recordings(sessionId: string): Promise<PlatformBrowserRecording[]> {
    return (await this.#request<{ recordings: PlatformBrowserRecording[] }>(this.#session(sessionId, '/recordings')))
      .recordings;
  }

  /** Sessions and browser time in an environment over the last `days` (default 30). */
  usage(environmentId: string, options: { days?: number } = {}): Promise<PlatformBrowserUsage> {
    return this.#request('/usage', { query: { environmentId, days: options.days } });
  }
}
