import { MastraConnectError } from '@mastra/connect';
import type { ConnectClient, ProjectConnection, ProxyRequestOptions } from '@mastra/connect';

import { logPlatformInfo, logPlatformWarn } from '../logging.js';
import {
  connectProxyFetch,
  createPlatformConnectClient,
  platformErrorMessage,
  platformErrorStatus,
} from '../platform-connect.js';
import type { PlatformConnectOption } from '../platform-connect.js';

/** A provider connection linked to the Factory's platform project. */
export interface PlatformConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
  /** End-user resource the connection is scoped to; null for a global connection. */
  resourceId: string | null;
  connectedAt: string | null;
}

/** An org connection the Factory could not link to its project, and why. */
export interface NeedsLinkingEntry {
  connectionId: string;
  reason: string;
}

export interface LinkOrgConnectionsResult {
  /** Connections that were not in the project listing and are now linked. */
  linked: string[];
  needsLinking: NeedsLinkingEntry[];
}

export interface PlatformConnectBindingOptions {
  /** The owning integration's id, for logs. */
  integrationId: string;
  /** Connect integration ids (provider keys) the integration owns. */
  providerKeys: readonly string[];
  connect?: PlatformConnectOption;
  /** Link the org's global connections for `providerKeys` to the project before the first read. */
  linkOrgConnectionsAtBoot?: boolean;
  /** Narrows the provider's connections further, e.g. to one configured connection id. */
  filter?: (connection: PlatformConnection) => boolean;
  /** How long a connection listing is reused. Defaults to 30 seconds. */
  cacheTtlMs?: number;
  now?: () => number;
}

export const DEFAULT_CONNECTION_CACHE_TTL_MS = 30_000;

/**
 * Thrown by {@link PlatformConnectBinding.proxy} when the platform reports
 * the connection needs to be reconnected. `status` is 401 so callers that map
 * HTTP-ish errors treat it as "not connected".
 */
export class PlatformConnectionNotConnectedError extends Error {
  readonly status = 401;
  readonly connectionId: string;

  constructor(connectionId: string, options?: { cause?: unknown }) {
    super(`Connection ${connectionId} needs to be reconnected in Mastra Platform.`, options);
    this.name = 'PlatformConnectionNotConnectedError';
    this.connectionId = connectionId;
  }
}

/** Whether an error is the platform (not the provider) saying the connection needs reauthentication. */
export function isPlatformNeedsReauth(error: unknown): boolean {
  return (
    error instanceof MastraConnectError &&
    error.source === 'platform' &&
    error.problemCode === 'connection_needs_reauth'
  );
}

const PERMISSION_REMEDY =
  "The Factory's platform credential cannot link this connection to the project. Grant it the integrations:write permission, or link the connection to the project in Mastra Platform.";

/**
 * The Connect plumbing a Platform integration needs: project-scoped
 * connection listing, the connection proxy, and linking the org's existing
 * connections to the Factory project. `PlatformConnectIntegration` wraps it;
 * integrations with another base class (GitLab) compose it directly.
 */
export class PlatformConnectBinding {
  readonly connect: ConnectClient;
  readonly integrationId: string;
  readonly providerKeys: readonly string[];
  readonly linkOrgConnectionsAtBoot: boolean;

  readonly #filter: ((connection: PlatformConnection) => boolean) | undefined;
  readonly #cacheTtlMs: number;
  readonly #now: () => number;
  readonly #linkedListeners = new Set<() => void>();

  #cache: { at: number; connections: Promise<PlatformConnection[]> } | undefined;
  #generation = 0;
  #bootLinking: Promise<void> | undefined;
  #needsLinking = new Map<string, NeedsLinkingEntry & { permanent: boolean }>();

  constructor(options: PlatformConnectBindingOptions) {
    this.integrationId = options.integrationId;
    this.providerKeys = [...options.providerKeys];
    this.connect = createPlatformConnectClient(options.connect);
    this.linkOrgConnectionsAtBoot = options.linkOrgConnectionsAtBoot ?? false;
    this.#filter = options.filter;
    this.#cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CONNECTION_CACHE_TTL_MS;
    this.#now = options.now ?? Date.now;
  }

  /**
   * The project's `active` and `needs_reauth` connections for the provider
   * keys, from the project listing. Reused for 30 seconds; `fresh` skips the
   * cache. Once boot linking has started, reads wait for it to settle, so
   * they never see the listing from before the org's connections were
   * linked.
   */
  async listConnections(options: { fresh?: boolean } = {}): Promise<PlatformConnection[]> {
    if (this.#bootLinking) await this.#bootLinking;
    const cached = this.#cache;
    if (!options.fresh && cached && this.#now() - cached.at < this.#cacheTtlMs) return cached.connections;
    const generation = this.#generation;
    const connections = this.#readProjectConnections();
    this.#cache = { at: this.#now(), connections };
    connections.catch(() => {
      // A failed read must not be served from the cache.
      if (this.#cache?.connections === connections && this.#generation === generation) this.#cache = undefined;
    });
    return connections;
  }

  /** Active connections, sorted by id so aggregate page cursors stay valid across requests. */
  async activeConnections(): Promise<PlatformConnection[]> {
    return (await this.listConnections())
      .filter(connection => connection.status === 'active')
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  /** The first active connection for a provider key that matches `predicate`. */
  async connectionFor(
    providerKey: string,
    predicate?: (connection: PlatformConnection) => boolean,
  ): Promise<PlatformConnection | null> {
    return (
      (await this.activeConnections()).find(
        connection => connection.integrationId === providerKey && (!predicate || predicate(connection)),
      ) ?? null
    );
  }

  /** Drops the cached listing; the next read goes to the platform. */
  invalidateConnections(): void {
    this.#generation++;
    this.#cache = undefined;
  }

  /**
   * Calls the provider through the connection proxy. A platform report that
   * the connection needs reauthentication becomes
   * {@link PlatformConnectionNotConnectedError}; a provider's own 409 stays a
   * provider error.
   */
  async proxy(connectionId: string, request: ProxyRequestOptions): Promise<unknown> {
    try {
      return await this.connect.proxy(connectionId, request);
    } catch (error) {
      throw this.#mapPlatformError(connectionId, error);
    }
  }

  /**
   * The proxy URL prefix for a connection, for provider clients that speak
   * HTTP themselves and reach the platform through {@link proxyFetch}.
   */
  proxyBaseUrl(connectionId: string): string {
    return `${this.connect.baseUrl}/v2/connections/${encodeURIComponent(connectionId)}/proxy`;
  }

  /**
   * A `fetch` for provider clients that speak HTTP themselves, sent through
   * the connection proxy. Provider responses pass through unchanged. A
   * platform-sourced 401 or 409 invalidates the connection cache, and the
   * platform's `connection_needs_reauth` throws
   * {@link PlatformConnectionNotConnectedError}, as {@link proxy} does.
   */
  proxyFetch(): typeof globalThis.fetch {
    const send = connectProxyFetch(this.connect);
    return async (input, init) => {
      const response = await send(input, init);
      if (response.ok || !(response.headers.get('content-type') ?? '').includes('application/problem+json')) {
        return response;
      }
      if (response.status === 401 || response.status === 409) this.invalidateConnections();
      const problemType = await response
        .clone()
        .json()
        .then((body: unknown) => (body && typeof body === 'object' ? (body as { type?: unknown }).type : undefined))
        .catch(() => undefined);
      if (problemType !== 'connection_needs_reauth') return response;
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const connectionId = /\/v2\/connections\/([^/]+)\/proxy(?:\/|$)/.exec(new URL(url).pathname)?.[1];
      throw new PlatformConnectionNotConnectedError(connectionId ? decodeURIComponent(connectionId) : 'unknown');
    };
  }

  /** Org connections the Factory could not link to its project. */
  get needsLinking(): NeedsLinkingEntry[] {
    return [...this.#needsLinking.values()].map(({ connectionId, reason }) => ({ connectionId, reason }));
  }

  /** Runs `listener` whenever linking adds a connection to the project. */
  onConnectionsLinked(listener: () => void): () => void {
    this.#linkedListeners.add(listener);
    return () => this.#linkedListeners.delete(listener);
  }

  /**
   * Starts boot linking once and resolves when it settles, whether it linked
   * everything or not. Failures are logged and kept in `needsLinking`.
   */
  ensureBootLinked(): Promise<void> {
    if (!this.linkOrgConnectionsAtBoot) return Promise.resolve();
    this.#bootLinking ??= this.linkOrgConnections().then(
      result => {
        if (result.linked.length > 0 || result.needsLinking.length > 0) {
          logPlatformInfo('Linked org connections to the Factory project', {
            integrationId: this.integrationId,
            linked: result.linked.length,
            needsLinking: result.needsLinking.length,
          });
        }
      },
      error => {
        logPlatformWarn('Could not link org connections to the Factory project', {
          integrationId: this.integrationId,
          error: platformErrorMessage(error),
        });
      },
    );
    return this.#bootLinking;
  }

  /**
   * Links the org's global connections for the provider keys that are not
   * yet linked to the Factory project. The platform answers 204 whether a
   * link was created or already existed, so the project listing is compared
   * before and after. `retryOnly: 'transient'` skips connections whose last
   * link was refused for lack of permission.
   */
  async linkOrgConnections(options: { retryOnly?: 'transient' } = {}): Promise<LinkOrgConnectionsResult> {
    const keys = new Set(this.providerKeys);
    const org = await this.connect.request<{ connections: ProjectConnection[] }>('GET', '/v2/connections');
    const candidates = org.connections.filter(
      connection =>
        keys.has(connection.integrationId) &&
        !connection.resourceId &&
        (connection.status === 'active' || connection.status === 'needs_reauth'),
    );
    const linkedBefore = new Set((await this.connect.listConnections()).map(connection => connection.id));
    const linked: string[] = [];
    for (const connection of candidates) {
      if (linkedBefore.has(connection.id)) {
        this.#needsLinking.delete(connection.id);
        continue;
      }
      if (options.retryOnly === 'transient' && this.#needsLinking.get(connection.id)?.permanent) continue;
      try {
        await this.connect.linkConnection(connection.id);
        this.#needsLinking.delete(connection.id);
        linked.push(connection.id);
      } catch (error) {
        const status = platformErrorStatus(error);
        const permanent = status === 401 || status === 403;
        const reason = permanent ? PERMISSION_REMEDY : platformErrorMessage(error);
        this.#needsLinking.set(connection.id, { connectionId: connection.id, reason, permanent });
        logPlatformWarn('Could not link an org connection to the Factory project', {
          integrationId: this.integrationId,
          connectionId: connection.id,
          ...(status === undefined ? {} : { status }),
          error: platformErrorMessage(error),
        });
      }
    }
    if (linked.length > 0) {
      this.invalidateConnections();
      for (const listener of this.#linkedListeners) listener();
    }
    return { linked, needsLinking: this.needsLinking };
  }

  async #readProjectConnections(): Promise<PlatformConnection[]> {
    const connections = await this.connect.listConnections({ providerKeys: this.providerKeys });
    return connections.flatMap(connection => {
      if (connection.status !== 'active' && connection.status !== 'needs_reauth') return [];
      const mapped: PlatformConnection = {
        id: connection.id,
        integrationId: connection.integrationId,
        status: connection.status,
        accountLabel: connection.accountLabel ?? null,
        resourceId: connection.resourceId ?? null,
        connectedAt: connection.connectedAt ?? null,
      };
      return !this.#filter || this.#filter(mapped) ? [mapped] : [];
    });
  }

  #mapPlatformError(connectionId: string, error: unknown): unknown {
    if (!(error instanceof MastraConnectError) || error.source !== 'platform') return error;
    if (error.status === 401 || error.status === 409) this.invalidateConnections();
    return isPlatformNeedsReauth(error)
      ? new PlatformConnectionNotConnectedError(connectionId, { cause: error })
      : error;
  }
}
