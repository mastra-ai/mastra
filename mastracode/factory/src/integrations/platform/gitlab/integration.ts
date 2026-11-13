import { MastraConnectError } from '@mastra/connect';

import type { MastraWorker } from '@mastra/core/worker';
import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type { IntegrationContext } from '../../base.js';
import { GitLabApiClient, GitLabApiError } from '../../gitlab/api.js';
import type { GitLabRuleOverrides } from '../../gitlab/default-rules.js';
import { gitlabConnection, GitLabIntegrationBase } from '../../gitlab/integration.js';
import type { GitLabStatusConnection } from '../../gitlab/integration.js';
import { attachGitLabRules } from '../../gitlab/rules.js';
import type { PlatformConnectProviderRegistration, PlatformConnectProviderSource } from '../connect/routes.js';
import { PlatformConnectBinding } from '../foundation/connect-binding.js';
import type { PlatformConnection } from '../foundation/connect-binding.js';
import type { PlatformConnectOption } from '../platform-connect.js';
import { PlatformGitLabEventWorker } from './event-worker.js';
import type { PlatformGitLabEventStorage } from './event-worker.js';

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
   * a Platform-connected deployment receives events by polling instead.
   */
  webhookSecret?: string;
  /** Defaults to `MASTRA_PLATFORM_GITLAB_POLLING_ENABLED`, and to true when that is unset. */
  pollingEnabled?: boolean;
  /** Defaults to `MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS`, and to the worker's 20 s when unset. */
  pollingIntervalMs?: number;
}

/**
 * GitLab through Mastra Connect. It keeps `GitLabIntegrationBase`, which the
 * self-hosted integration shares, and composes the Connect plumbing through a
 * `PlatformConnectBinding`.
 */
export class PlatformGitLabIntegration extends GitLabIntegrationBase implements PlatformConnectProviderSource {
  readonly binding: PlatformConnectBinding;
  readonly #connectionId: string | undefined;
  readonly #endpointHost: string;
  readonly #webhookSecret: string | undefined;
  readonly #pollingEnabled: boolean;
  readonly #pollingIntervalMs: number | undefined;

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
    this.#pollingEnabled =
      config.pollingEnabled ?? process.env.MASTRA_PLATFORM_GITLAB_POLLING_ENABLED?.trim().toLowerCase() !== 'false';
    this.#pollingIntervalMs =
      config.pollingIntervalMs ?? optionalPositiveIntegerEnv('MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS');
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
   * The reconcile sweeps from the base class plus, when polling is on, the
   * Platform event poller. Polling replaces the direct project webhook: the
   * webhook route stays mounted for deployments that also configured a secret,
   * but nothing in Platform mode requires one.
   */
  override workers(ctx: IntegrationContext): MastraWorker[] {
    void this.binding.ensureBootLinked();
    const workers = super.workers(ctx);
    if (!this.#pollingEnabled) return workers;
    if (!ctx.controller) {
      throw new Error('Platform GitLab event polling requires the mounted Mastra Code controller.');
    }
    return [
      ...workers,
      new PlatformGitLabEventWorker({
        client: this.binding.connect,
        controller: ctx.controller,
        gitlab: this,
        storage: ctx.storage.generic as unknown as PlatformGitLabEventStorage,
        listConnections: () => this.listConnections(),
        ingestFactoryEvent: attachGitLabRules(this, ctx),
        intervalMs: this.#pollingIntervalMs,
      }),
    ];
  }

  diagnostics(): Record<string, unknown> {
    return {
      configured: true,
      mode: 'platform',
      endpointHost: this.#endpointHost,
      connectionFilterConfigured: Boolean(this.#connectionId),
      webhookConfigured: Boolean(this.#webhookSecret),
      pollingEnabled: this.#pollingEnabled,
      ...(this.#pollingIntervalMs === undefined ? {} : { pollingIntervalMs: this.#pollingIntervalMs }),
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

function optionalPositiveIntegerEnv(name: 'MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS'): number | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  const parsed = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}
