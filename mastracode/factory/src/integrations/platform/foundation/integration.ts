import type { ConnectClient, ProxyRequestOptions } from '@mastra/connect';
import type { ApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import type { FactoryIntegration, IntegrationContext } from '../../base.js';
import {
  addReconcileSummary,
  emptyIntakeRefreshSummary,
  scopeIntegrationContextToProject,
} from '../../intake-refresh.js';
import type { IntakeRefreshScope, IntakeRefreshSummary } from '../../intake-refresh.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import type { IssueReconciler } from '../../issue-reconciler.js';
import type { PlatformConnectProviderRegistration, PlatformConnectProviderSource } from '../connect/routes.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import { PlatformConnectBinding } from './connect-binding.js';
import type {
  LinkOrgConnectionsOptions,
  LinkOrgConnectionsResult,
  NeedsLinkingEntry,
  PlatformConnection,
} from './connect-binding.js';
import type {
  PlatformConnectEventDelivery,
  PlatformConnectEventRoute,
  PlatformConnectEventSource,
} from './events-worker.js';

/** Reconciles run hourly unless an integration says otherwise. */
export const DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS = 60 * 60_000;

/** The shortest gap between two reconciles requested by events for items with no card yet. */
export const PLATFORM_DISCOVERY_MIN_GAP_MS = 60_000;

/** A provider the integration registers with the platform connect routes. */
export interface PlatformConnectProvider {
  /** SPA-facing provider slug, the `:provider` path segment. */
  provider: string;
  /** Platform integration id used to mint connect sessions. */
  integrationId: string;
  /** Connection `integrationId` variants that belong to this provider. Defaults to `[integrationId]`. */
  connectionIntegrationIds?: readonly string[];
}

export interface PlatformConnectIntegrationOptions {
  /** The integration's id, also its reconcile worker's name prefix. */
  id: string;
  /** Connect integration ids (provider keys) the integration owns. */
  providerKeys: readonly string[];
  connect?: PlatformConnectOption;
  /** Link the org's global connections for `providerKeys` to the Factory project at boot. */
  linkOrgConnectionsAtBoot?: boolean;
  /** Providers the integration exposes through the platform connect routes. */
  connectProviders?: readonly PlatformConnectProvider[];
  /** Narrows the provider's connections further, e.g. to one configured connection id. */
  connectionFilter?: (connection: PlatformConnection) => boolean;
  /**
   * The reconcile interval from the integration's constructor option or
   * environment variable. Takes precedence over `reconcileDefaultIntervalMs`.
   */
  reconcileIntervalMs?: number;
  /** The integration's own default reconcile interval, in place of hourly. */
  reconcileDefaultIntervalMs?: number;
}

/**
 * Base class for a Factory integration whose provider is reached through
 * Mastra Connect. It owns the Connect client, project-scoped connection
 * listing, the connection proxy, linking existing org connections to the
 * Factory project, the provider's connect routes and the reconcile worker.
 * Capabilities (`intake`, `versionControl`) are composed in by subclasses.
 */
export abstract class PlatformConnectIntegration
  implements FactoryIntegration, PlatformConnectProviderSource, PlatformConnectEventSource
{
  readonly id: string;
  readonly binding: PlatformConnectBinding;
  readonly #connectProviders: readonly PlatformConnectProvider[];
  readonly #reconcileIntervalMs: number;
  #reconcileWorker: IssueReconcileWorker | undefined;
  #discoveryRequestedAt = Number.NEGATIVE_INFINITY;
  #discoveryTimer: ReturnType<typeof setTimeout> | undefined;
  /** The context `workers()` was given, which a board refresh runs with. */
  protected workerContext: IntegrationContext | undefined;

  constructor(options: PlatformConnectIntegrationOptions) {
    this.id = options.id;
    this.binding = new PlatformConnectBinding({
      integrationId: options.id,
      providerKeys: options.providerKeys,
      ...(options.connect ? { connect: options.connect } : {}),
      ...(options.linkOrgConnectionsAtBoot ? { linkOrgConnectionsAtBoot: true } : {}),
      ...(options.connectionFilter ? { filter: options.connectionFilter } : {}),
    });
    this.#connectProviders = options.connectProviders ?? [];
    this.#reconcileIntervalMs =
      options.reconcileIntervalMs ?? options.reconcileDefaultIntervalMs ?? DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS;
  }

  get connect(): ConnectClient {
    return this.binding.connect;
  }

  get providerKeys(): readonly string[] {
    return this.binding.providerKeys;
  }

  /** How often the reconcile worker runs. */
  get reconcileIntervalMs(): number {
    return this.#reconcileIntervalMs;
  }

  /** The project's `active` and `needs_reauth` connections for the integration's provider keys. */
  listConnections(options?: { fresh?: boolean }): Promise<PlatformConnection[]> {
    return this.binding.listConnections(options);
  }

  /** Active connections, sorted by id. */
  activeConnections(): Promise<PlatformConnection[]> {
    return this.binding.activeConnections();
  }

  connectionFor(
    providerKey: string,
    predicate?: (connection: PlatformConnection) => boolean,
  ): Promise<PlatformConnection | null> {
    return this.binding.connectionFor(providerKey, predicate);
  }

  invalidateConnections(): void {
    this.binding.invalidateConnections();
  }

  proxy(connectionId: string, request: ProxyRequestOptions): Promise<unknown> {
    return this.binding.proxy(connectionId, request);
  }

  linkOrgConnections(options?: LinkOrgConnectionsOptions): Promise<LinkOrgConnectionsResult> {
    return this.binding.linkOrgConnections(options);
  }

  get needsLinking(): NeedsLinkingEntry[] {
    return this.binding.needsLinking;
  }

  platformConnectProviders(): PlatformConnectProviderRegistration[] {
    return this.#connectProviders.map(provider => ({
      provider: provider.provider,
      integrationId: provider.integrationId,
      connectionIntegrationIds: provider.connectionIntegrationIds ?? [provider.integrationId],
      binding: this.binding,
    }));
  }

  /**
   * The reconciler the reconcile worker runs, or null when the integration
   * has nothing to reconcile in this context. Integrations without a
   * reconcile return null.
   */
  protected reconcile(_ctx: IntegrationContext): IssueReconciler | null {
    return null;
  }

  /**
   * Starts boot linking (non-blocking) and returns the reconcile worker, when
   * the integration reconciles. Linking that adds a connection triggers one
   * extra reconcile. The integration's storage remembers what was linked.
   */
  workers(ctx: IntegrationContext): MastraWorker[] {
    this.workerContext = ctx;
    void this.binding.ensureBootLinked(ctx.storage.generic);
    const reconcile = this.reconcile(ctx);
    if (!reconcile) return [];
    const worker = new IssueReconcileWorker({
      integrationId: this.id,
      reconcile,
      intervalMs: this.#reconcileIntervalMs,
    });
    this.#reconcileWorker = worker;
    this.binding.onConnectionsLinked(() => worker.requestRun());
    return [worker];
  }

  /** Runs the reconcile now, if the integration has one running. */
  requestReconcile(): void {
    this.#reconcileWorker?.requestRun();
  }

  /**
   * Runs the integration's reconcile now for one Factory project, outside the
   * worker's lease: a refresh is idempotent like any reconcile, and waits for
   * nothing but its own project.
   */
  async refreshIntake(scope: IntakeRefreshScope): Promise<IntakeRefreshSummary | null> {
    if (!this.workerContext) return null;
    const scoped = await scopeIntegrationContextToProject(this.workerContext, scope);
    return scoped ? this.refreshProject(scoped.context, this.workerContext) : null;
  }

  /**
   * One project's refresh. `scoped` lists only that project; `full` is the
   * unscoped context, for integrations whose reconcile reads every project
   * for more than walking them.
   */
  protected async refreshProject(
    scoped: IntegrationContext,
    _full: IntegrationContext,
  ): Promise<IntakeRefreshSummary | null> {
    const reconcile = this.reconcile(scoped);
    if (!reconcile) return null;
    return addReconcileSummary(emptyIntakeRefreshSummary(), await reconcile());
  }

  /**
   * Runs the reconcile so it files an item an event named that has no card
   * yet. Requests are throttled to one per `PLATFORM_DISCOVERY_MIN_GAP_MS`:
   * one inside the gap runs once at its end, so a burst of events, or events
   * for items no binding takes, costs at most one reconcile a minute.
   */
  requestDiscovery(): void {
    if (this.#discoveryTimer) return;
    const now = Date.now();
    const wait = this.#discoveryRequestedAt + PLATFORM_DISCOVERY_MIN_GAP_MS - now;
    if (wait <= 0) {
      this.#discoveryRequestedAt = now;
      this.requestReconcile();
      return;
    }
    this.#discoveryTimer = setTimeout(() => {
      this.#discoveryTimer = undefined;
      this.#discoveryRequestedAt = Date.now();
      this.requestReconcile();
    }, wait);
    this.#discoveryTimer.unref?.();
  }

  /**
   * Handles one `connect`-topic event for this integration's connections.
   * Integrations without provider events leave it undefined and get no route.
   */
  protected handleConnectEvent?(event: PlatformConnectEventDelivery, ctx: IntegrationContext): Promise<void>;

  connectEventRoute(ctx: IntegrationContext): PlatformConnectEventRoute | null {
    const handle = this.handleConnectEvent;
    if (!handle) return null;
    return {
      binding: this.binding,
      handle: event => handle.call(this, event, ctx),
      reconcile: () => this.requestReconcile(),
    };
  }

  abstract routes(ctx: IntegrationContext): ApiRoute[];

  diagnostics(): Record<string, unknown> {
    const needsLinking = this.needsLinking;
    const detached = this.binding.detached;
    return {
      configured: true,
      mode: 'platform',
      ...(needsLinking.length > 0 ? { needsLinking } : {}),
      ...(detached.length > 0 ? { detached } : {}),
    };
  }
}
