import type { IntegrationConnection } from '../../../capabilities/connection.js';
import { GitLabApiClient, GitLabApiError } from '../../gitlab/api.js';
import type { GitLabRuleOverrides } from '../../gitlab/default-rules.js';
import { gitlabConnection, GitLabIntegrationBase } from '../../gitlab/integration.js';
import type { GitLabStatusConnection } from '../../gitlab/integration.js';
import { PlatformApiClient, platformApiClientConfigFromEnv } from '../api-client.js';
import type { PlatformApiClientConfig } from '../api-client.js';

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
  | { type: 'oauth2'; accessToken: string; expiresAt: string | null }
  | { type: 'api_key'; apiKey: string };

const GITLAB_INTEGRATION_IDS = new Set(['gitlab', 'gitlab-group', 'gitlab-group-token']);

export interface PlatformGitLabIntegrationConfig {
  rules?: GitLabRuleOverrides;
  clientConfig?: PlatformApiClientConfig;
  connectionId?: string;
  webhookSecret?: string;
}

export class PlatformGitLabIntegration extends GitLabIntegrationBase {
  readonly #client: PlatformApiClient;
  readonly #connectionId: string | undefined;
  readonly #endpointHost: string;
  readonly #webhookSecret: string | undefined;

  constructor(config: PlatformGitLabIntegrationConfig = {}) {
    super(config.rules);
    const connectionId = config.connectionId?.trim() || process.env.MASTRA_GITLAB_CONNECTION_ID?.trim() || undefined;
    const clientConfig = config.clientConfig ?? platformApiClientConfigFromEnv();
    this.#client = new PlatformApiClient(clientConfig);
    this.#connectionId = connectionId;
    this.#endpointHost = new URL(clientConfig.baseUrl).host;
    this.#webhookSecret = config.webhookSecret?.trim() || process.env.MASTRA_GITLAB_WEBHOOK_SECRET?.trim() || undefined;
  }

  async listConnections(): Promise<PlatformIntegrationConnection[]> {
    const result = await this.#client.request<{ connections: PlatformIntegrationConnection[] }>(
      'GET',
      '/v2/connections?providerKey=gitlab',
    );
    return result.connections.filter(
      connection =>
        (!this.#connectionId || connection.id === this.#connectionId) &&
        GITLAB_INTEGRATION_IDS.has(connection.integrationId),
    );
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

  diagnostics(): Record<string, unknown> {
    return {
      configured: true,
      mode: 'platform',
      endpointHost: this.#endpointHost,
      connectionFilterConfigured: Boolean(this.#connectionId),
      webhookConfigured: Boolean(this.#webhookSecret),
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
