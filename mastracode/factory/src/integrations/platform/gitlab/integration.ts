import { MastraConnectError } from '@mastra/connect';

import type { MastraWorker } from '@mastra/core/worker';
import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type { IntegrationContext } from '../../base.js';
import { GitLabApiClient, GitLabApiError } from '../../gitlab/api.js';
import type { GitLabRuleOverrides } from '../../gitlab/default-rules.js';
import { gitlabConnection, GitLabIntegrationBase } from '../../gitlab/integration.js';
import type { GitLabStatusConnection } from '../../gitlab/integration.js';
import { attachGitLabReconciler } from '../../gitlab/reconciler.js';
import { gitlabReconciliationEnabled, gitlabReconciliationInterval } from '../../gitlab/reconciliation-config.js';
import { attachGitLabRules } from '../../gitlab/rules.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import type { PlatformConnectProviderRegistration, PlatformConnectProviderSource } from '../connect/routes.js';
import { PlatformConnectBinding } from '../foundation/connect-binding.js';
import type { PlatformConnection } from '../foundation/connect-binding.js';
import type { PlatformConnectEventRoute, PlatformConnectEventSource } from '../foundation/events-worker.js';
import { DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS } from '../foundation/integration.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import { handleGitLabConnectEvent } from './connect-events.js';

interface PlatformGitLabContext {
  id: string;
  label: string | null;
  api: GitLabApiClient;
  connection: IntegrationConnection;
  host: string;
  repositoryAccessToken: () => Promise<string>;
}

/** The Platform's GitLab (OAuth) integration. It is the only GitLab credential flow Factory discovers. */
const GITLAB_INTEGRATION_ID = 'gitlab';

export interface PlatformGitLabIntegrationConfig {
  rules?: GitLabRuleOverrides;
  /** The Connect client, or options to build one; defaults to the platform environment. */
  connect?: PlatformConnectOption;
  connectionId?: string;
  /**
   * Optional. Only a direct project webhook to `/web/gitlab/webhook` needs it;
   * a Platform-connected deployment receives events from the platform events
   * service instead.
   */
  webhookSecret?: string;
}

/**
 * GitLab through Mastra Connect. It keeps `GitLabIntegrationBase`, which the
 * self-hosted integration shares, and composes the Connect plumbing through a
 * `PlatformConnectBinding`.
 */
export class PlatformGitLabIntegration
  extends GitLabIntegrationBase
  implements PlatformConnectProviderSource, PlatformConnectEventSource
{
  readonly binding: PlatformConnectBinding;
  readonly #connectionId: string | undefined;
  readonly #endpointHost: string;
  readonly #webhookSecret: string | undefined;
  #reconcileWorker: IssueReconcileWorker | undefined;
  #unverifiedEventsDropped = 0;

  constructor(config: PlatformGitLabIntegrationConfig = {}) {
    super(config.rules);
    const connectionId = config.connectionId?.trim() || process.env.MASTRA_GITLAB_CONNECTION_ID?.trim() || undefined;
    this.binding = new PlatformConnectBinding({
      integrationId: 'gitlab',
      providerKeys: [GITLAB_INTEGRATION_ID],
      ...(config.connect ? { connect: config.connect } : {}),
      linkOrgConnectionsAtBoot: true,
      ...(connectionId ? { filter: (connection: PlatformConnection) => connection.id === connectionId } : {}),
    });
    this.#connectionId = connectionId;
    this.#endpointHost = new URL(this.binding.connect.baseUrl).host;
    this.#webhookSecret = config.webhookSecret?.trim() || process.env.MASTRA_GITLAB_WEBHOOK_SECRET?.trim() || undefined;
  }

  listConnections(): Promise<PlatformConnection[]> {
    return this.binding.listConnections();
  }

  platformConnectProviders(): PlatformConnectProviderRegistration[] {
    return [
      {
        provider: 'gitlab',
        integrationId: GITLAB_INTEGRATION_ID,
        connectionIntegrationIds: [GITLAB_INTEGRATION_ID],
        binding: this.binding,
      },
    ];
  }

  override async statusConnections(): Promise<GitLabStatusConnection[]> {
    return this.listConnections();
  }

  async hasActiveConnections(): Promise<boolean> {
    return (await this.#activeConnections()).length > 0;
  }

  authFailureMessage(): string {
    return 'GitLab rejected the connected account. Reconnect it in Mastra Platform.';
  }

  protected override get webhookSecret(): string | undefined {
    return this.#webhookSecret;
  }

  protected async activeContexts(): Promise<PlatformGitLabContext[]> {
    return (await this.#activeConnections()).map(connection => this.#context(connection));
  }

  protected async contextById(connectionId: string): Promise<PlatformGitLabContext> {
    const connection = (await this.#activeConnections()).find(candidate => candidate.id === connectionId);
    if (!connection) throw new GitLabApiError('GitLab connection is unavailable or requires reauthentication.', 401);
    return this.#context(connection);
  }

  /**
   * The issue and merge request reconcile, hourly by default: GitLab events
   * arrive through the platform events worker (`connectEventRoute`), so the
   * reconcile only repairs what that missed. The webhook route stays mounted
   * for deployments that also configured a secret, but nothing in Platform
   * mode requires one.
   */
  override workers(ctx: IntegrationContext): MastraWorker[] {
    void this.binding.ensureBootLinked();
    if (!gitlabReconciliationEnabled()) return [];
    const reconcile = attachGitLabReconciler(this, ctx);
    if (!reconcile) return [];
    const worker = new IssueReconcileWorker({
      integrationId: this.id,
      reconcile,
      intervalMs: gitlabReconciliationInterval() ?? DEFAULT_PLATFORM_RECONCILE_INTERVAL_MS,
    });
    this.#reconcileWorker = worker;
    this.binding.onConnectionsLinked(() => worker.requestRun());
    return [worker];
  }

  connectEventRoute(ctx: IntegrationContext): PlatformConnectEventRoute {
    const ingestFactoryEvent = attachGitLabRules(this, ctx);
    return {
      binding: this.binding,
      handle: event =>
        handleGitLabConnectEvent(event, {
          ...(ctx.controller ? { controller: ctx.controller } : {}),
          gitlab: this,
          ingestFactoryEvent,
          onUnverifiedDropped: () => (this.#unverifiedEventsDropped += 1),
        }),
      reconcile: () => this.#reconcileWorker?.requestRun(),
    };
  }

  diagnostics(): Record<string, unknown> {
    return {
      configured: true,
      mode: 'platform',
      endpointHost: this.#endpointHost,
      connectionFilterConfigured: Boolean(this.#connectionId),
      webhookConfigured: Boolean(this.#webhookSecret),
      ...(this.#unverifiedEventsDropped > 0 ? { unverifiedEventsDropped: this.#unverifiedEventsDropped } : {}),
      ...(this.binding.needsLinking.length > 0 ? { needsLinking: this.binding.needsLinking } : {}),
    };
  }

  async #activeConnections(): Promise<PlatformConnection[]> {
    return (await this.listConnections()).filter(connection => connection.status === 'active');
  }

  #context(connection: PlatformConnection): PlatformGitLabContext {
    return {
      id: connection.id,
      label: connection.accountLabel,
      api: new GitLabApiClient({ client: this.binding, connectionId: connection.id }),
      connection: gitlabConnection(connection.id),
      // Platform does not currently expose the connected GitLab instance host.
      host: 'gitlab.com',
      repositoryAccessToken: async () => {
        // Fetch for each git operation so an expiring OAuth token is refreshed by Platform.
        // Never persist or log the returned credential.
        const credential = await this.binding.connect.getCredential(connection.id).catch((error: unknown) => {
          if (error instanceof MastraConnectError && error.code === 'unsupported_credential_type') return null;
          throw error;
        });
        const token =
          credential?.type === 'oauth2'
            ? credential.accessToken
            : credential?.type === 'api_key'
              ? credential.apiKey
              : undefined;
        if (typeof token !== 'string' || !token.trim()) {
          throw new GitLabApiError('GitLab connection did not provide a repository credential.', 502);
        }
        return token;
      },
    };
  }
}
