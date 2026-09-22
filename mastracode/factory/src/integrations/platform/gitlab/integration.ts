import type { MastraWorker } from '@mastra/core/worker';

import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type { IntegrationContext } from '../../base.js';
import { GitLabApiClient, GitLabApiError } from '../../gitlab/api.js';
import type { GitLabRuleOverrides } from '../../gitlab/default-rules.js';
import { gitlabConnection, GitLabIntegrationBase } from '../../gitlab/integration.js';
import type { GitLabStatusConnection } from '../../gitlab/integration.js';
import { attachGitLabRules } from '../../gitlab/rules.js';
import { PlatformApiClient, platformApiClientConfigFromEnv } from '../api-client.js';
import type { PlatformApiClientConfig } from '../api-client.js';
import { PlatformGitLabEventWorker } from './event-worker.js';
import type { PlatformGitLabEventStorage } from './event-worker.js';

interface PlatformIntegrationConnection {
  id: string;
  integrationId: string;
  status: 'active' | 'needs_reauth';
  accountLabel: string | null;
}

interface PlatformGitLabContext {
  id: string;
  label: string | null;
  api: GitLabApiClient;
  connection: IntegrationConnection;
  host: string;
  repositoryAccessToken: () => Promise<string>;
}

type PlatformGitLabCredential =
  { type: 'oauth2'; accessToken: string; expiresAt: string | null } | { type: 'api_key'; apiKey: string };

const GITLAB_INTEGRATION_IDS = new Set(['gitlab', 'gitlab-group', 'gitlab-group-token']);

export interface PlatformGitLabIntegrationConfig {
  rules?: GitLabRuleOverrides;
  clientConfig?: PlatformApiClientConfig;
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

export class PlatformGitLabIntegration extends GitLabIntegrationBase {
  readonly #client: PlatformApiClient;
  readonly #connectionId: string | undefined;
  readonly #endpointHost: string;
  readonly #webhookSecret: string | undefined;
  readonly #pollingEnabled: boolean;
  readonly #pollingIntervalMs: number | undefined;

  constructor(config: PlatformGitLabIntegrationConfig = {}) {
    super(config.rules);
    const connectionId = config.connectionId?.trim() || process.env.MASTRA_GITLAB_CONNECTION_ID?.trim() || undefined;
    const clientConfig = config.clientConfig ?? platformApiClientConfigFromEnv();
    this.#client = new PlatformApiClient(clientConfig);
    this.#connectionId = connectionId;
    this.#endpointHost = new URL(clientConfig.baseUrl).host;
    this.#webhookSecret = config.webhookSecret?.trim() || process.env.MASTRA_GITLAB_WEBHOOK_SECRET?.trim() || undefined;
    this.#pollingEnabled =
      config.pollingEnabled ?? process.env.MASTRA_PLATFORM_GITLAB_POLLING_ENABLED?.trim().toLowerCase() !== 'false';
    this.#pollingIntervalMs =
      config.pollingIntervalMs ?? optionalPositiveIntegerEnv('MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS');
  }

  async listConnections(): Promise<PlatformIntegrationConnection[]> {
    // Platform's providerKey filter matches a single integration ID, so query
    // each supported GitLab credential flow before applying the exact ID filter.
    const pages = await Promise.all(
      [...GITLAB_INTEGRATION_IDS].map(async integrationId => {
        const result = await this.#client.request<{ connections: PlatformIntegrationConnection[] }>(
          'GET',
          `/v2/connections?providerKey=${encodeURIComponent(integrationId)}`,
        );
        return result.connections;
      }),
    );
    const seen = new Set<string>();
    return pages.flat().filter(connection => {
      if (
        (this.#connectionId && connection.id !== this.#connectionId) ||
        !GITLAB_INTEGRATION_IDS.has(connection.integrationId) ||
        seen.has(connection.id)
      ) {
        return false;
      }
      seen.add(connection.id);
      return true;
    });
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
    const workers = super.workers(ctx);
    if (!this.#pollingEnabled) return workers;
    if (!ctx.controller) {
      throw new Error('Platform GitLab event polling requires the mounted Mastra Code controller.');
    }
    return [
      ...workers,
      new PlatformGitLabEventWorker({
        client: this.#client,
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
    };
  }

  async #activeConnections(): Promise<PlatformIntegrationConnection[]> {
    return (await this.listConnections()).filter(connection => connection.status === 'active');
  }

  #context(connection: PlatformIntegrationConnection): PlatformGitLabContext {
    return {
      id: connection.id,
      label: connection.accountLabel,
      api: new GitLabApiClient({ client: this.#client, connectionId: connection.id }),
      connection: gitlabConnection(connection.id),
      // Platform does not currently expose the connected GitLab instance host.
      host: 'gitlab.com',
      repositoryAccessToken: async () => {
        // Fetch for each git operation so an expiring OAuth token is refreshed by Platform.
        // Never persist or log the returned credential.
        const credential = await this.#client.request<PlatformGitLabCredential>(
          'GET',
          `/v2/connections/${encodeURIComponent(connection.id)}/credentials`,
        );
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
