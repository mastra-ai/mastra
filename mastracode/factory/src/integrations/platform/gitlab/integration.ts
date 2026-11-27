import { MastraConnectError } from '@mastra/connect';

import type { MastraWorker } from '@mastra/core/worker';
import type { IntegrationConnection } from '../../../capabilities/connection.js';
import type { IntegrationContext } from '../../base.js';
import { GitLabApiClient, GitLabApiError } from '../../gitlab/api.js';
import type { GitLabRuleOverrides } from '../../gitlab/default-rules.js';
import { gitlabConnection, GitLabIntegrationBase, normalizeGitLabHost } from '../../gitlab/integration.js';
import type { GitLabStatusConnection } from '../../gitlab/integration.js';
import { attachGitLabRules } from '../../gitlab/rules.js';
import { IssueReconcileWorker } from '../../issue-reconcile-worker.js';
import type { PlatformConnectProviderRegistration, PlatformConnectProviderSource } from '../connect/routes.js';
import { PlatformConnectBinding } from '../foundation/connect-binding.js';
import type { PlatformConnection } from '../foundation/connect-binding.js';
import type { PlatformConnectEventRoute, PlatformConnectEventSource } from '../foundation/connect-events.js';
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

/** The Platform's gitlab.com (OAuth) integration. */
const GITLAB_INTEGRATION_ID = 'gitlab';
/**
 * The Platform's self-managed GitLab integration: an access token plus the
 * instance hostname, which the connection context carries.
 */
const GITLAB_SELF_HOSTED_INTEGRATION_ID = 'gitlab-self-hosted';
const GITLAB_INTEGRATION_IDS = [GITLAB_INTEGRATION_ID, GITLAB_SELF_HOSTED_INTEGRATION_ID];

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
  /** Defaults to `MASTRA_PLATFORM_GITLAB_POLLING_INTERVAL_MS`, and to the poller's 20 s when unset. */
  pollingIntervalMs?: number;
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
  readonly #pollingEnabled: boolean;
  readonly #pollingIntervalMs: number | undefined;
  #reconcileWorker: IssueReconcileWorker | undefined;
  // Keyed by the connection record, so a self-hosted instance is re-read
  // whenever the binding re-reads the connection list, e.g. after a reconnect.
  readonly #hosts = new WeakMap<PlatformConnection, Promise<string>>();
  // The first instance each self-hosted connection was seen on. A connection
  // stays on that instance: anything already built from it (source ids, linked
  // repositories, cached contexts) would otherwise reach a different server.
  readonly #instances = new Map<string, string>();

  constructor(config: PlatformGitLabIntegrationConfig = {}) {
    super(config.rules);
    const connectionId = config.connectionId?.trim() || process.env.MASTRA_GITLAB_CONNECTION_ID?.trim() || undefined;
    this.binding = new PlatformConnectBinding({
      integrationId: 'gitlab',
      providerKeys: GITLAB_INTEGRATION_IDS,
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
        connectionIntegrationIds: GITLAB_INTEGRATION_IDS,
        binding: this.binding,
      },
      {
        provider: GITLAB_SELF_HOSTED_INTEGRATION_ID,
        integrationId: GITLAB_SELF_HOSTED_INTEGRATION_ID,
        connectionIntegrationIds: [GITLAB_SELF_HOSTED_INTEGRATION_ID],
        binding: this.binding,
        // A reconnect only renews the token; the instance stays the one the
        // connection is on, so the form submits that hostname unchanged.
        reconnectParams: async connectionId => ({ hostname: await this.#reconnectHostname(connectionId) }),
      },
    ];
  }

  /** The instance this process pinned the connection to, else the one Platform has recorded for it. */
  async #reconnectHostname(connectionId: string): Promise<string> {
    const pinned = this.#instances.get(connectionId);
    if (pinned) return pinned;
    const context = await this.binding.connect.getContext(connectionId);
    const hostname = selfHostedHostname(context.connection_config?.hostname);
    if (!hostname) {
      throw new GitLabApiError(`Self-hosted GitLab connection ${connectionId} has no valid instance hostname.`, 502);
    }
    return hostname;
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
    const results = await Promise.allSettled(
      (await this.#activeConnections()).map(connection => this.#context(connection)),
    );
    // A self-hosted connection whose instance can't be read must not hide the
    // others; contextById still reports its error for anything that names it.
    const contexts = results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : []));
    const failure = results.find(result => result.status === 'rejected');
    if (contexts.length === 0 && failure) throw failure.reason;
    return contexts;
  }

  protected async contextById(connectionId: string): Promise<PlatformGitLabContext> {
    return this.#context(await this.#activeConnection(connectionId));
  }

  /**
   * A stored repository link records the instance the connection was linked
   * on, which outlasts this process: it replaces whatever instance this
   * process happened to see first, so a connection moved back to its linked
   * instance works again without a restart.
   */
  protected override async contextByIdForLinkedHost(
    connectionId: string,
    host: string,
  ): Promise<PlatformGitLabContext> {
    const connection = await this.#activeConnection(connectionId);
    const linked = selfHostedHostname(host);
    if (connection.integrationId === GITLAB_SELF_HOSTED_INTEGRATION_ID && linked) {
      if (this.#instances.get(connection.id) !== linked) {
        this.#instances.set(connection.id, linked);
        this.#hosts.delete(connection);
      }
    }
    return this.#context(connection);
  }

  async #activeConnection(connectionId: string): Promise<PlatformConnection> {
    const connection = (await this.#activeConnections()).find(candidate => candidate.id === connectionId);
    if (!connection) throw new GitLabApiError('GitLab connection is unavailable or requires reauthentication.', 401);
    return connection;
  }

  /**
   * The reconcile sweeps from the base class. Events come through the
   * deployment's Platform Connect event poller (`connectEventRoute`), which
   * replaces the direct project webhook: the webhook route stays mounted for
   * deployments that also configured a secret, but nothing in Platform mode
   * requires one.
   */
  override workers(ctx: IntegrationContext): MastraWorker[] {
    void this.binding.ensureBootLinked(ctx.storage.generic);
    const workers = super.workers(ctx);
    this.#reconcileWorker = workers.find(worker => worker instanceof IssueReconcileWorker);
    return workers;
  }

  /** The route the Platform Connect event poller reads GitLab events through, unless polling is off. */
  connectEventRoute(ctx: IntegrationContext): PlatformConnectEventRoute | null {
    if (!this.#pollingEnabled) return null;
    const controller = ctx.controller;
    if (!controller) {
      throw new Error('Platform GitLab event polling requires the mounted Mastra Code controller.');
    }
    const ingestFactoryEvent = attachGitLabRules(this, ctx);
    return {
      binding: this.binding,
      handle: event =>
        handleGitLabConnectEvent(event, {
          controller,
          gitlab: this,
          ingestFactoryEvent,
        }),
      reconcile: () => this.#reconcileWorker?.requestRun(),
      ...(this.#pollingIntervalMs === undefined ? {} : { pollIntervalMs: this.#pollingIntervalMs }),
    };
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
      ...(this.binding.detached.length > 0 ? { detached: this.binding.detached } : {}),
    };
  }

  async #activeConnections(): Promise<PlatformConnection[]> {
    return (await this.listConnections()).filter(connection => connection.status === 'active');
  }

  async #context(connection: PlatformConnection): Promise<PlatformGitLabContext> {
    const host = await this.#host(connection);
    const selfHosted = connection.integrationId === GITLAB_SELF_HOSTED_INTEGRATION_ID;
    // The pin can move after this context is built (a stored link re-pins the
    // connection), so check against the instance this context is for, not the pin.
    const confirmInstance = async () => {
      const fresh = await this.#freshHost(connection);
      if (fresh !== host) {
        throw new GitLabApiError(
          `Self-hosted GitLab connection ${connection.id} now points at ${fresh}, not ${host}, the instance this request was made for.`,
          409,
        );
      }
    };
    return {
      id: connection.id,
      label: connection.accountLabel,
      api: new GitLabApiClient({
        client: this.binding,
        connectionId: connection.id,
        // The proxy reaches whichever instance the connection names now, so a
        // write first confirms that is still the instance this context is for,
        // and a read confirms it before its results are used under this host.
        ...(selfHosted ? { confirmInstance } : {}),
      }),
      connection: gitlabConnection(connection.id),
      host,
      repositoryAccessToken: async () => {
        // Fetch for each git operation so an expiring OAuth token is refreshed by Platform.
        // Never persist or log the returned credential.
        // Read the instance fresh on both sides of the credential fetch; either
        // read refuses if the connection has left this context's instance.
        if (selfHosted) await confirmInstance();
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
        if (selfHosted) await confirmInstance();
        return token;
      },
    };
  }

  #freshHost(connection: PlatformConnection): Promise<string> {
    this.#hosts.delete(connection);
    return this.#host(connection);
  }

  /**
   * gitlab.com for OAuth connections; a self-hosted connection's instance comes
   * from its context, re-read for each fresh connection listing and around every
   * credential fetch. Once seen, a connection's instance is fixed: a later read
   * that names another instance is refused instead of followed.
   */
  #host(connection: PlatformConnection): Promise<string> {
    if (connection.integrationId !== GITLAB_SELF_HOSTED_INTEGRATION_ID) return Promise.resolve('gitlab.com');
    let host = this.#hosts.get(connection);
    if (!host) {
      host = this.binding.connect.getContext(connection.id).then(context => {
        const hostname = selfHostedHostname(context.connection_config?.hostname);
        if (!hostname) {
          throw new GitLabApiError(
            `Self-hosted GitLab connection ${connection.id} has no valid instance hostname.`,
            502,
          );
        }
        const first = this.#instances.get(connection.id);
        if (first && first !== hostname) {
          throw new GitLabApiError(
            `Self-hosted GitLab connection ${connection.id} now points at ${hostname}, but it was first used for ${first}. A connection stays on one instance: connect ${hostname} as a new connection in Mastra Platform.`,
            409,
          );
        }
        this.#instances.set(connection.id, hostname);
        return hostname;
      });
      host.catch(() => this.#hosts.delete(connection));
      this.#hosts.set(connection, host);
    }
    return host;
  }
}

/** The hostname alone: the host goes into API and clone URLs, so a scheme, path, or credentials are refused. */
function selfHostedHostname(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const host = normalizeGitLabHost(value);
  if (!host) return undefined;
  try {
    return new URL(`https://${host}`).host === host ? host : undefined;
  } catch {
    return undefined;
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
