import { MastraConnectError } from '@mastra/connect';
import type { ConnectClient, ProjectConnection, ProxyRequestOptions } from '@mastra/connect';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
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
  /** Org connections the project had and no longer lists: removed on purpose, so left unlinked. */
  detached: string[];
  /**
   * Org connections considered that are still neither linked nor detached: links
   * that failed, or, when `requireHistory` found no history, every unlinked one.
   */
  unresolved: string[];
}

/**
 * Where a binding remembers the org connections it has linked, or seen
 * linked, to the Factory project. The integration's own storage handle fits.
 */
export type PlatformConnectLinkStore = Pick<IntegrationStorageHandle, 'settings'>;

export interface LinkOrgConnectionsOptions {
  /**
   * Also link connections the project had before and no longer has, i.e.
   * ones someone detached. Only an admin's explicit request does this.
   */
  relinkDetached?: boolean;
  /** Consider only these connections; the rest of the org is neither linked nor remembered. */
  only?: ReadonlySet<string>;
  /**
   * Link nothing unless link history is stored, so a detached connection can't
   * be mistaken for one the project never had.
   */
  requireHistory?: boolean;
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
const NOT_LISTED_AFTER_LINK =
  'The platform accepted the link, but the connection is not in the Factory project yet. Retry linking, or link it in the platform.';
const LINKS_ORG_ID = '__platform_connect_links__';

type RememberedLinks = { version: 1; connectionIds: string[] };

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
  #needsLinking = new Map<string, NeedsLinkingEntry>();
  #detached: string[] = [];
  #linkStore: PlatformConnectLinkStore | undefined;
  /** Connections known to be in the stored link history. */
  #savedLinks = new Set<string>();
  /** Connections to add to the stored link history; kept until a save succeeds. */
  #unsavedLinks = new Set<string>();
  #historyWrites: Promise<void> = Promise.resolve();

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
    return [...this.#needsLinking.values()];
  }

  /**
   * Org connections the project had and no longer lists, as of the last linking:
   * someone removed them from the project, so linking leaves them alone.
   */
  get detached(): string[] {
    return this.#detached;
  }

  /** Runs `listener` whenever linking adds a connection to the project. */
  onConnectionsLinked(listener: () => void): () => void {
    this.#linkedListeners.add(listener);
    return () => this.#linkedListeners.delete(listener);
  }

  /**
   * Starts boot linking once and resolves when it settles, whether it linked
   * everything or not. Failures are logged and kept in `needsLinking`.
   * `store` remembers the connections linked to the project, so a connection
   * someone later detaches is not linked again on the next boot.
   */
  ensureBootLinked(store?: PlatformConnectLinkStore): Promise<void> {
    if (store) this.#linkStore ??= store;
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
   * before and after.
   *
   * Each connection is linked at most once: one the project has had before
   * and no longer lists was detached on purpose and is left alone, unless
   * `relinkDetached` is set.
   */
  async linkOrgConnections(options: LinkOrgConnectionsOptions = {}): Promise<LinkOrgConnectionsResult> {
    if (options.requireHistory && !this.#linkStore) {
      const linkedNow = new Set((await this.connect.listConnections()).map(connection => connection.id));
      const unresolved = (await this.#orgCandidates())
        .map(connection => connection.id)
        .filter(id => (!options.only || options.only.has(id)) && !linkedNow.has(id));
      return { linked: [], needsLinking: this.needsLinking, detached: this.detached, unresolved };
    }
    const candidates = (await this.#orgCandidates()).filter(
      connection => !options.only || options.only.has(connection.id),
    );
    const linkedBefore = new Set((await this.connect.listConnections()).map(connection => connection.id));
    const remembered = await this.#rememberedLinks();
    const attempted: string[] = [];
    const detached: string[] = [];
    for (const connection of candidates) {
      if (linkedBefore.has(connection.id)) {
        this.#needsLinking.delete(connection.id);
        continue;
      }
      if (remembered.has(connection.id) && !options.relinkDetached) {
        this.#needsLinking.delete(connection.id);
        detached.push(connection.id);
        continue;
      }
      try {
        await this.connect.linkConnection(connection.id);
        attempted.push(connection.id);
      } catch (error) {
        const status = platformErrorStatus(error);
        const reason = status === 401 || status === 403 ? PERMISSION_REMEDY : platformErrorMessage(error);
        this.#needsLinking.set(connection.id, { connectionId: connection.id, reason });
        logPlatformWarn('Could not link an org connection to the Factory project', {
          integrationId: this.integrationId,
          connectionId: connection.id,
          ...(status === undefined ? {} : { status }),
          error: platformErrorMessage(error),
        });
      }
    }
    const linked: string[] = [];
    if (attempted.length > 0) {
      // A 204 doesn't prove the link: only a connection the project listing now shows counts.
      const linkedAfter = new Set((await this.connect.listConnections()).map(connection => connection.id));
      for (const connectionId of attempted) {
        if (linkedAfter.has(connectionId)) {
          this.#needsLinking.delete(connectionId);
          linked.push(connectionId);
        } else {
          this.#needsLinking.set(connectionId, { connectionId, reason: NOT_LISTED_AFTER_LINK });
        }
      }
    }
    this.#detached = detached.sort();
    if (linked.length > 0) {
      this.invalidateConnections();
      for (const listener of this.#linkedListeners) listener();
    }
    for (const id of remembered) this.#savedLinks.add(id);
    const seen = candidates.map(connection => connection.id).filter(id => linkedBefore.has(id) || linked.includes(id));
    await this.#rememberLinks(seen);
    const unresolved = candidates
      .map(connection => connection.id)
      .filter(id => !linkedBefore.has(id) && !linked.includes(id) && !detached.includes(id));
    return { linked, needsLinking: this.needsLinking, detached: this.detached, unresolved };
  }

  /**
   * Org connections for these provider keys missing from `projectConnections`:
   * links that were refused or failed, connections made outside the
   * Factory since it last linked, and connections someone detached. Pass the
   * listing the caller acts on, so a connection linked in between can't hide
   * from both.
   */
  async unlinkedOrgConnections(projectConnections: readonly PlatformConnection[]): Promise<string[]> {
    const linked = new Set(projectConnections.map(connection => connection.id));
    return (await this.#orgCandidates())
      .filter(connection => !linked.has(connection.id))
      .map(connection => connection.id);
  }

  /**
   * Connections remembered as linked to this platform project; empty without a store.
   * A failed read throws: linking without it would attach connections someone
   * removed, and saving afterwards would forget them.
   */
  async #rememberedLinks(): Promise<Set<string>> {
    if (!this.#linkStore) return new Set();
    let saved: RememberedLinks | null;
    try {
      saved = (await this.#linkStore.settings.get(LINKS_ORG_ID, this.#linkStoreKey())) as RememberedLinks | null;
    } catch (error) {
      throw new Error(
        `Could not read which connections the Factory project has had linked: ${platformErrorMessage(error)}`,
      );
    }
    return new Set(saved?.version === 1 && Array.isArray(saved.connectionIds) ? saved.connectionIds : []);
  }

  /**
   * Adds `connectionIds` to the stored link history. Writes run one at a time
   * and merge into the latest stored record, so concurrent calls don't drop
   * each other's ids. Ids a failed write didn't save are kept and saved with
   * the next write; a connection still linked is also recorded again by the
   * next project listing.
   */
  #rememberLinks(connectionIds: readonly string[]): Promise<void> {
    if (!this.#linkStore) return Promise.resolve();
    for (const id of connectionIds) if (!this.#savedLinks.has(id)) this.#unsavedLinks.add(id);
    if (this.#unsavedLinks.size === 0) return this.#historyWrites;
    this.#historyWrites = this.#historyWrites.then(() => this.#saveLinks());
    return this.#historyWrites;
  }

  async #saveLinks(): Promise<void> {
    const store = this.#linkStore;
    const pending = [...this.#unsavedLinks];
    if (!store || pending.length === 0) return;
    try {
      const latest = await this.#rememberedLinks();
      if (pending.some(id => !latest.has(id))) {
        const connectionIds = [...new Set([...latest, ...pending])].sort();
        await store.settings.save(LINKS_ORG_ID, this.#linkStoreKey(), {
          version: 1,
          connectionIds,
        } satisfies RememberedLinks);
      }
      for (const id of [...latest, ...pending]) this.#savedLinks.add(id);
      for (const id of pending) this.#unsavedLinks.delete(id);
    } catch (error) {
      logPlatformWarn('Could not remember which connections are linked to the Factory project', {
        integrationId: this.integrationId,
        error: platformErrorMessage(error),
      });
    }
  }

  /** Per platform project, so a deployment moved to another project starts fresh. */
  #linkStoreKey(): string {
    return `project:${this.connect.projectId ?? 'default'}`;
  }

  async #orgCandidates(): Promise<ProjectConnection[]> {
    const keys = new Set(this.providerKeys);
    const org = await this.connect.request<{ connections: ProjectConnection[] }>('GET', '/v2/connections');
    return org.connections.filter(
      connection =>
        keys.has(connection.integrationId) &&
        !connection.resourceId &&
        (connection.status === 'active' || connection.status === 'needs_reauth') &&
        this.#accepts(toPlatformConnection(connection)),
    );
  }

  async #readProjectConnections(): Promise<PlatformConnection[]> {
    const connections = await this.connect.listConnections({ providerKeys: this.providerKeys });
    // Org connections the project lists are linked to it, however they got there.
    void this.#rememberLinks(connections.filter(connection => !connection.resourceId).map(connection => connection.id));
    return connections.flatMap(connection => {
      if (connection.status !== 'active' && connection.status !== 'needs_reauth') return [];
      const mapped = toPlatformConnection(connection);
      return this.#accepts(mapped) ? [mapped] : [];
    });
  }

  #accepts(connection: PlatformConnection): boolean {
    return !this.#filter || this.#filter(connection);
  }

  #mapPlatformError(connectionId: string, error: unknown): unknown {
    if (!(error instanceof MastraConnectError) || error.source !== 'platform') return error;
    if (error.status === 401 || error.status === 409) this.invalidateConnections();
    return isPlatformNeedsReauth(error)
      ? new PlatformConnectionNotConnectedError(connectionId, { cause: error })
      : error;
  }
}

function toPlatformConnection(connection: ProjectConnection): PlatformConnection {
  return {
    id: connection.id,
    integrationId: connection.integrationId,
    status: connection.status as PlatformConnection['status'],
    accountLabel: connection.accountLabel ?? null,
    resourceId: connection.resourceId ?? null,
    connectedAt: connection.connectedAt ?? null,
  };
}
