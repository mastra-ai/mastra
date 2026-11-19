import type { ConnectClient, ProxyRequestOptions } from '@mastra/connect';
import type { ApiRoute } from '@mastra/core/server';
import type { MastraWorker } from '@mastra/core/worker';

import type { FactoryIntegration, IntegrationContext } from '../../base.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import type { IssueReconciler } from '../../issue-reconciler.js';
import type { PlatformConnectProviderRegistration, PlatformConnectProviderSource } from '../connect/routes.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import { PlatformConnectBinding } from './connect-binding.js';
import type { LinkOrgConnectionsResult, NeedsLinkingEntry, PlatformConnection } from './connect-binding.js';

/** Reconciles run hourly unless an integration says otherwise. */
export const DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS = 60 * 60_000;

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
export abstract class PlatformConnectIntegration implements FactoryIntegration, PlatformConnectProviderSource {
  readonly id: string;
  readonly binding: PlatformConnectBinding;
  readonly #connectProviders: readonly PlatformConnectProvider[];
  readonly #reconcileIntervalMs: number;

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

  linkOrgConnections(): Promise<LinkOrgConnectionsResult> {
    return this.binding.linkOrgConnections();
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
   * extra reconcile.
   */
  workers(ctx: IntegrationContext): MastraWorker[] {
    void this.binding.ensureBootLinked();
    const reconcile = this.reconcile(ctx);
    if (!reconcile) return [];
    const worker = new IssueReconcileWorker({
      integrationId: this.id,
      reconcile,
      intervalMs: this.#reconcileIntervalMs,
    });
    this.binding.onConnectionsLinked(() => worker.requestRun());
    return [worker];
  }

  abstract routes(ctx: IntegrationContext): ApiRoute[];

  diagnostics(): Record<string, unknown> {
    const needsLinking = this.needsLinking;
    return {
      configured: true,
      mode: 'platform',
      ...(needsLinking.length > 0 ? { needsLinking } : {}),
    };
  }
}
