import { randomUUID } from 'node:crypto';
import { AgentChannels, resolveWaitUntil } from '@mastra/core/channels';
import type {
  ChannelAdapterConfig,
  ChannelConnectResult,
  ChannelInstallationInfo,
  ChannelPlatformInfo,
  ChannelProvider,
  StreamingConfig,
} from '@mastra/core/channels';
import type { Agent } from '@mastra/core/agent';
import type { Mastra } from '@mastra/core/mastra';
import type { ApiRoute, ApiRouteHandler } from '@mastra/core/server';
import { InMemoryChannelsStorage } from '@mastra/core/storage';
import type { ChannelsStorage } from '@mastra/core/storage';
import { createTeamsAdapter } from '@chat-adapter/teams';
import type { TeamsAdapter } from '@chat-adapter/teams';
import {
  addApplicationPassword,
  createApplication,
  createBotRegistration,
  deleteApplication,
  deleteBotRegistration,
  validateBotCredentials,
} from './microsoft-clients';
import { PLATFORM, TeamsInstallStore, toInstallationInfo } from './install-store';
import { DEV_PORTAL_BOTS_URL, TEAMS_DEV_PORTAL_SCOPE, TEAMS_GRAPH_SCOPE } from './types';
import type { TeamsConnectOptions, TeamsInstallation, TeamsProviderConfig } from './types';

/**
 * Resolve the per-adapter streaming/typing config the provider applies to the
 * Teams entry in `AgentChannels.adapters` — both default on.
 */
export function resolveTeamsAdapterConfig(config: Pick<TeamsProviderConfig, 'streaming' | 'typingStatus'>): {
  streaming: StreamingConfig;
  typingStatus: boolean;
} {
  return {
    streaming: config.streaming ?? true,
    typingStatus: config.typingStatus ?? true,
  };
}

/**
 * Microsoft Teams channel provider for Mastra — a {@link ChannelProvider} over
 * `@chat-adapter/teams`. The adapter handles the Bot Framework transport
 * (activity parse, JWT webhook verification, send/stream, typing, adaptive
 * cards); this provider adds the install/lifecycle layer.
 *
 * Credential modes (mutually exclusive, enforced at the type level):
 *
 * - **Self-managed** — bring your own Azure Bot registration: pass
 *   `appId`/`appPassword` (provider-level or per-`connect()`). Point the bot's
 *   messaging endpoint at `{baseUrl}/teams/events/{webhookId}`.
 * - **Delegated** — pass a scope-aware `tokenResolver` for a *manager*
 *   credential; `connect(agentId)` then provisions a bot per agent: an Entra
 *   application (Microsoft Graph), a fresh client secret, and a Teams
 *   Developer Portal bot registration pointing at this server. The per-agent
 *   secret is stored (encrypted) and used by the runtime — the manager
 *   credential is never needed on the message path.
 *
 * @example
 * ```ts
 * const teams = new TeamsProvider({ baseUrl: 'https://my-app.example.com', tokenResolver });
 * const mastra = new Mastra({ agents: { myAgent }, channels: { teams } });
 * await teams.connect('my-agent'); // → { type: 'deep_link', url: 'https://dev.teams.microsoft.com/bots' }
 * ```
 */
export class TeamsProvider implements ChannelProvider {
  readonly id = PLATFORM;

  #config: TeamsProviderConfig;
  #mastra?: Mastra;
  #store?: TeamsInstallStore;
  /** Live adapters, keyed by installation id. */
  #adapters = new Map<string, TeamsAdapter>();
  /** Cached sync view of whether any active bot is registered (for {@link getInfo}). */
  #configured = false;
  #initPromise: Promise<void> | null = null;

  constructor(config: TeamsProviderConfig = {}) {
    this.#config = config;
  }

  /**
   * Called by Mastra when this channel is registered.
   * @internal
   */
  __attach(mastra: Mastra): void {
    if (this.#mastra && this.#mastra !== mastra) {
      this.#initPromise = null;
      this.#store = undefined;
      this.#adapters.clear();
      this.#configured = false;
    }
    this.#mastra = mastra;
  }

  /**
   * Per-bot messaging endpoint. A single POST route keyed by an opaque
   * `webhookId`; inbound requests are authenticated by Microsoft's JWT
   * signature (verified by the adapter against the bot's `appId`), not by the
   * path. Auto-initializes on first hit (mirrors `@mastra/slack`).
   */
  getRoutes(): ApiRoute[] {
    const self = this;
    const withInit = (handler: ApiRouteHandler) => {
      return async ({ mastra }: { mastra: Mastra }): Promise<ApiRouteHandler> => {
        self.#mastra = mastra;
        await self.#autoInitialize();
        return handler.bind(self);
      };
    };
    return [
      {
        path: `/${PLATFORM}/events/:webhookId`,
        method: 'POST',
        requiresAuth: false,
        createHandler: withInit(this.#handleWebhook),
      },
    ];
  }

  /** Discovery metadata for the editor UI. */
  getInfo(): ChannelPlatformInfo {
    const hasCredentials = Boolean(this.#config.tokenResolver || (this.#config.appId && this.#config.appPassword));
    return {
      id: this.id,
      name: 'Microsoft Teams',
      isConfigured: this.#configured || hasCredentials,
      connectOptionsSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Display name for the bot (defaults to the agent id).',
          },
          appId: {
            type: 'string',
            description:
              'Microsoft App (client) ID of an existing bot registration (self-managed mode). Omit in delegated mode — a bot is provisioned per agent.',
          },
          appPassword: {
            type: 'string',
            description: 'Client secret for the bot (self-managed mode).',
          },
          appTenantId: {
            type: 'string',
            description: 'Entra tenant ID for single-tenant bots.',
          },
        },
      },
    };
  }

  /**
   * Restore installations from storage: rebuild an adapter per active bot and
   * inject `AgentChannels` so the agent can receive events immediately.
   * Idempotent. Does not re-register messaging endpoints (they persist in the
   * bot registration across restarts); reconnect an agent if its `baseUrl` changed.
   */
  async initialize(): Promise<void> {
    if (this.#initPromise) return this.#initPromise;
    this.#initPromise = this.#doInitialize();
    try {
      await this.#initPromise;
    } catch (err) {
      this.#initPromise = null;
      throw err;
    }
  }

  async #doInitialize(): Promise<void> {
    const store = await this.#getStore();
    const active = (await store.list()).filter(i => i.status === 'active');
    this.#configured = active.length > 0;
    for (const installation of active) {
      try {
        await this.#activateInstallation(installation);
      } catch (err) {
        console.error(`[Teams] Failed to restore installation "${installation.id}":`, err);
      }
    }
  }

  /**
   * Update runtime provider settings. Pass `appId`/`appPassword` to change the
   * default bot credentials new {@link connect} calls fall back to; pass
   * `baseUrl`/`apiUrl` to point the provider/adapter at a different host.
   * `null` clears the default credentials only — per-bot installs are managed
   * via {@link connect}/{@link disconnect}.
   */
  async configure(
    credentials: {
      appId?: string;
      appPassword?: string;
      appTenantId?: string;
      baseUrl?: string;
      apiUrl?: string;
    } | null,
  ): Promise<void> {
    if (this.#config.tokenResolver && (credentials?.appId !== undefined || credentials?.appPassword !== undefined)) {
      throw new Error(
        'TeamsProvider was constructed with a tokenResolver — bot credentials are provisioned per agent. ' +
          'Remove the tokenResolver to manage credentials manually via configure().',
      );
    }
    if (credentials === null) {
      this.#config = { ...this.#config, appId: undefined, appPassword: undefined } as TeamsProviderConfig;
      return;
    }
    const apiUrlChanged = credentials.apiUrl !== undefined && credentials.apiUrl !== this.#config.apiUrl;
    // The guard above rejects direct credentials when a tokenResolver is set,
    // so this merge cannot mix the two credential modes.
    this.#config = { ...this.#config, ...credentials } as TeamsProviderConfig;
    if (!apiUrlChanged) return;

    // Live adapters captured the previous apiUrl — drop them and, if
    // installations were already restored, rebuild against the new host.
    const wasInitialized = this.#initPromise !== null;
    this.#adapters.clear();
    this.#initPromise = null;
    if (wasInitialized) await this.initialize();
  }

  /**
   * Connect an agent to Microsoft Teams.
   *
   * - **Delegated** (`tokenResolver`): provisions a per-agent bot — Entra
   *   application + client secret via Microsoft Graph, then a Teams Developer
   *   Portal bot registration whose messaging endpoint points at this server —
   *   and returns `{ type: 'deep_link' }` to the Developer Portal where the
   *   bot is packaged into a Teams app for install.
   * - **Self-managed** with `appId`/`appPassword` (per-call or provider
   *   default): validates the credentials via a Bot Framework token mint,
   *   persists the installation, and returns `{ type: 'immediate' }`. Point
   *   the bot registration's messaging endpoint at the installation's
   *   `messagingEndpoint`.
   * - Self-managed without credentials: persists a pending installation and
   *   returns `{ type: 'deep_link' }` pointing at the Teams Developer Portal.
   */
  async connect(agentId: string, options: TeamsConnectOptions = {}): Promise<ChannelConnectResult> {
    const store = await this.#getStore();
    const existing = await store.getByAgent(agentId);
    if (existing?.status === 'active') {
      throw new Error(`Agent "${agentId}" is already connected to Microsoft Teams. Disconnect first to reconnect.`);
    }

    if (this.#config.tokenResolver) {
      // Delegated mode provisions a dedicated bot per agent — supplying an
      // existing bot's credentials here would silently bypass provisioning.
      if (options.appId !== undefined || options.appPassword !== undefined) {
        throw new Error(
          'TeamsProvider was constructed with a tokenResolver — bots are provisioned per agent ' +
            'and credentials cannot be supplied per connect() call.',
        );
      }
      return this.#connectDelegated(agentId, options, existing);
    }
    return this.#connectSelfManaged(agentId, options, existing);
  }

  async #connectSelfManaged(
    agentId: string,
    options: TeamsConnectOptions,
    existing: TeamsInstallation | null,
  ): Promise<ChannelConnectResult> {
    const store = await this.#getStore();
    const appId = options.appId ?? this.#config.appId;
    const appPassword = options.appPassword ?? this.#config.appPassword;
    if (!appId || !appPassword) {
      const installationId = existing?.id ?? randomUUID();
      await store.save({
        id: installationId,
        agentId,
        webhookId: existing?.webhookId ?? randomUUID(),
        status: 'pending',
        installedAt: existing?.installedAt ?? new Date(),
      });
      return { type: 'deep_link', url: DEV_PORTAL_BOTS_URL, installationId };
    }

    // Two agents on one bot would receive each other's activities.
    const duplicate = (await store.list()).find(
      i => i.status === 'active' && i.agentId !== agentId && i.appId === appId,
    );
    if (duplicate) {
      throw new Error(
        `This Teams bot is already connected to agent "${duplicate.agentId}". Disconnect it before connecting another agent.`,
      );
    }

    const appTenantId = options.appTenantId ?? this.#config.appTenantId;
    await validateBotCredentials({ appId, appPassword, appTenantId }, this.#config.loginBaseUrl);

    const installationId = existing?.id ?? randomUUID();
    const webhookId = existing?.webhookId ?? randomUUID();
    const baseUrl = this.#getBaseUrl();
    const installation: TeamsInstallation = {
      id: installationId,
      agentId,
      webhookId,
      status: 'active',
      appId,
      appPassword,
      appTenantId,
      appType: this.#config.appType ?? (appTenantId ? 'SingleTenant' : 'MultiTenant'),
      botName: options.name ?? agentId,
      messagingEndpoint: baseUrl ? `${baseUrl}/${PLATFORM}/events/${webhookId}` : undefined,
      installedAt: existing?.installedAt ?? new Date(),
    };
    await store.save(installation);
    await this.#activateInstallation(installation);
    this.#configured = true;
    await this.#config.onInstall?.(installation);
    return { type: 'immediate', installationId };
  }

  async #connectDelegated(
    agentId: string,
    options: TeamsConnectOptions,
    existing: TeamsInstallation | null,
  ): Promise<ChannelConnectResult> {
    const tokenResolver = this.#config.tokenResolver!;
    const store = await this.#getStore();
    if (!store.canEncrypt) {
      // Delegated provisioning creates a client secret the user never sees and
      // persists it, so refusing up front (before any Azure resources exist)
      // beats warning about a plaintext secret after the fact.
      throw new Error(
        'Delegated Teams provisioning stores a Mastra-provisioned bot client secret and requires an encryption key. ' +
          'Set `encryptionKey` on TeamsProvider or the MASTRA_ENCRYPTION_KEY environment variable.',
      );
    }
    const baseUrl = this.#getBaseUrl();
    if (!baseUrl) {
      throw new Error(
        'TeamsProvider needs a baseUrl to register a bot messaging endpoint. Set `baseUrl` or configure the Mastra server.',
      );
    }

    const botName = options.name ?? agentId;
    const appType = this.#config.appType ?? 'MultiTenant';
    const appTenantId = options.appTenantId ?? this.#config.appTenantId;
    if (appType === 'SingleTenant' && !appTenantId) {
      throw new Error(
        'TeamsProvider is configured for SingleTenant bots but no appTenantId is available. ' +
          'Set `appTenantId` on the provider or pass it to connect().',
      );
    }
    const webhookId = existing?.webhookId ?? randomUUID();
    const messagingEndpoint = `${baseUrl}/${PLATFORM}/events/${webhookId}`;

    // 1. Entra application + client secret (Microsoft Graph audience).
    const graphToken = await tokenResolver(TEAMS_GRAPH_SCOPE, appTenantId);
    const application = await createApplication(
      graphToken,
      { displayName: botName, signInAudience: appType === 'SingleTenant' ? 'AzureADMyOrg' : 'AzureADMultipleOrgs' },
      this.#config.graphBaseUrl,
    );
    let appPassword: string;
    let devPortalToken: string | undefined;
    let botRegistered = false;
    let installation: TeamsInstallation;
    try {
      appPassword = await addApplicationPassword(graphToken, application.id, 'mastra-teams', this.#config.graphBaseUrl);

      // 2. Bot registration (Teams Developer Portal audience — a Graph token
      //    is not accepted here, hence the second scope-specific resolve).
      devPortalToken = await tokenResolver(TEAMS_DEV_PORTAL_SCOPE, appTenantId);
      await createBotRegistration(
        devPortalToken,
        {
          botId: application.appId,
          name: botName,
          description: `Mastra agent "${agentId}"`,
          iconUrl: this.#config.botIconUrl ?? '',
          messagingEndpoint,
          callingEndpoint: '',
        },
        this.#config.devPortalBaseUrl,
      );
      botRegistered = true;

      // 3. Persist while still inside the rollback scope — a failed save must
      //    not strand a live bot registration + Entra app with no local record
      //    (disconnect() could never find them again, and the minted secret
      //    would be lost).
      installation = {
        id: existing?.id ?? randomUUID(),
        agentId,
        webhookId,
        status: 'active',
        appId: application.appId,
        entraObjectId: application.id,
        appPassword,
        appTenantId,
        appType,
        botName,
        messagingEndpoint,
        installedAt: existing?.installedAt ?? new Date(),
      };
      await store.save(installation);
    } catch (err) {
      // Roll back the half-provisioned resources so retries don't accumulate
      // orphaned bot registrations / Entra apps in the tenant.
      if (botRegistered && devPortalToken) {
        try {
          await deleteBotRegistration(devPortalToken, application.appId, this.#config.devPortalBaseUrl);
        } catch (cleanupErr) {
          console.warn(`[Teams] Failed to roll back bot registration "${application.appId}":`, cleanupErr);
        }
      }
      try {
        await deleteApplication(graphToken, application.id, this.#config.graphBaseUrl);
      } catch (cleanupErr) {
        console.warn(`[Teams] Failed to roll back Entra application "${application.appId}":`, cleanupErr);
      }
      throw err;
    }

    // The installation is saved and the bot is live — post-save failures are
    // non-fatal (the adapter is rebuilt lazily on the next webhook/initialize).
    try {
      await this.#activateInstallation(installation);
    } catch (err) {
      console.warn(`[Teams] Failed to activate installation for agent "${agentId}":`, err);
    }
    this.#configured = true;
    try {
      await this.#config.onInstall?.(installation);
    } catch (err) {
      console.warn(`[Teams] onInstall hook failed for agent "${agentId}":`, err);
    }
    // The bot is live; the remaining human step is packaging it into a Teams
    // app (manifest + icons) in the Developer Portal for install/distribution.
    return { type: 'deep_link', url: DEV_PORTAL_BOTS_URL, installationId: installation.id };
  }

  /**
   * Disconnect an agent from Microsoft Teams. For bots this provider
   * provisioned (delegated mode), the Developer Portal registration and the
   * Entra application are deleted best-effort — a control-plane failure never
   * blocks removal of the local installation.
   */
  async disconnect(agentId: string): Promise<void> {
    const store = await this.#getStore();
    const existing = await store.getByAgent(agentId);
    if (!existing) {
      throw new Error(`No Teams installation found for agent "${agentId}"`);
    }
    if (existing.entraObjectId && this.#config.tokenResolver) {
      if (existing.appId) {
        try {
          const devPortalToken = await this.#config.tokenResolver(TEAMS_DEV_PORTAL_SCOPE);
          await deleteBotRegistration(devPortalToken, existing.appId, this.#config.devPortalBaseUrl);
        } catch (err) {
          console.warn(`[Teams] Failed to delete bot registration for agent "${agentId}":`, err);
        }
      }
      try {
        const graphToken = await this.#config.tokenResolver(TEAMS_GRAPH_SCOPE);
        await deleteApplication(graphToken, existing.entraObjectId, this.#config.graphBaseUrl);
      } catch (err) {
        console.warn(`[Teams] Failed to delete Entra application for agent "${agentId}":`, err);
      }
    }
    this.#adapters.delete(existing.id);
    await store.deleteByAgent(agentId);
    this.#configured = (await store.list()).some(i => i.status === 'active');
  }

  /** List installations (public info only — no secrets). */
  async listInstallations(): Promise<ChannelInstallationInfo[]> {
    const store = await this.#getStore();
    const installations = await store.list();
    return installations.map(toInstallationInfo);
  }

  /**
   * Get the full installation for an agent (includes the client secret).
   * Returns `null` if the agent has no Teams installation. Mirrors
   * `SlackProvider.getInstallation`.
   */
  async getInstallation(agentId: string): Promise<TeamsInstallation | null> {
    const store = await this.#getStore();
    return (await store.getByAgent(agentId)) ?? null;
  }

  /** Whether at least one bot is actively registered. */
  isConfigured(): boolean {
    return this.#configured;
  }

  /**
   * Get the live `TeamsAdapter` for an installation id, if one is active.
   * Used for message formatting/posting. Mirrors `SlackProvider.getAdapter`.
   */
  getAdapter(installationId: string): TeamsAdapter | undefined {
    return this.#adapters.get(installationId);
  }

  // ===========================================================================
  // Webhook handling
  // ===========================================================================

  async #handleWebhook(c: {
    req: { param: (k: string) => string | undefined; raw: Request };
    json: (body: unknown, status?: number) => Response;
  }): Promise<Response> {
    const webhookId = c.req.param('webhookId');
    if (!webhookId) return c.json({ ok: false, error: 'Missing webhookId' }, 400);

    const store = await this.#getStore();
    const installation = await store.getByWebhookId(webhookId);
    if (!installation || installation.status !== 'active') {
      return c.json({ ok: false, error: 'Unknown webhook' }, 404);
    }

    const agent = this.#resolveAgent(installation.agentId);
    if (!agent || !this.#mastra) {
      // Nothing to route to — ack so Bot Framework stops retrying. The
      // request has not been JWT-verified at this point, but it carries no
      // side effects either.
      return c.json({ ok: true });
    }

    const adapter = this.#getOrCreateAdapter(installation);
    let channels = agent.getChannels();
    if (!channels || channels.adapters[PLATFORM] !== adapter) {
      channels = this.#createAgentChannels(agent, adapter);
      await channels.initialize(this.#mastra);
    }

    // Authentication happens inside the adapter's handleWebhook: Microsoft
    // signs every activity with a JWT the adapter verifies against the bot's
    // appId audience.
    const waitUntil = this.#config.waitUntil ?? resolveWaitUntil(c as never);
    try {
      return await channels.handleWebhookEvent(PLATFORM, c.req.raw, waitUntil ? { waitUntil } : undefined);
    } catch (err) {
      console.error('[Teams] Error delegating to AgentChannels:', err);
      return c.json({ ok: true });
    }
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  #getOrCreateAdapter(installation: TeamsInstallation): TeamsAdapter {
    const existing = this.#adapters.get(installation.id);
    if (existing) return existing;
    const adapter = createTeamsAdapter({
      appId: installation.appId,
      appPassword: installation.appPassword,
      ...(installation.appTenantId !== undefined ? { appTenantId: installation.appTenantId } : {}),
      ...(installation.appType !== undefined ? { appType: installation.appType } : {}),
      ...(installation.botName !== undefined ? { userName: installation.botName } : {}),
      ...(this.#config.apiUrl !== undefined ? { apiUrl: this.#config.apiUrl } : {}),
      ...(this.#config.logger !== undefined ? { logger: this.#config.logger } : {}),
    });
    this.#adapters.set(installation.id, adapter);
    return adapter;
  }

  /** Rebuild the adapter and inject AgentChannels for an active installation. */
  async #activateInstallation(installation: TeamsInstallation): Promise<void> {
    const agent = this.#resolveAgent(installation.agentId);
    const adapter = this.#getOrCreateAdapter(installation);
    if (agent && this.#mastra) {
      const channels = this.#createAgentChannels(agent, adapter);
      await channels.initialize(this.#mastra);
    }
  }

  /**
   * Create AgentChannels for an agent with the Teams adapter, preserving any
   * adapters/config the agent author already configured (mirrors `@mastra/slack`).
   */
  #createAgentChannels(agent: Agent, adapter: TeamsAdapter): AgentChannels {
    const existing = agent.getChannels();
    const existingConfig = existing?.channelConfig;
    const cfg = this.#config;
    const entry = {
      adapter,
      ...resolveTeamsAdapterConfig(cfg),
      ...(cfg.toolDisplay !== undefined ? { toolDisplay: cfg.toolDisplay } : {}),
      ...(cfg.cors !== undefined ? { cors: cfg.cors } : {}),
      ...(cfg.formatError !== undefined ? { formatError: cfg.formatError } : {}),
    } as ChannelAdapterConfig;
    const channels = new AgentChannels({
      ...existingConfig,
      adapters: { ...existingConfig?.adapters, [PLATFORM]: entry },
      userName: agent.name,
      handlers: cfg.handlers ?? existingConfig?.handlers,
      inlineMedia: cfg.inlineMedia ?? existingConfig?.inlineMedia,
      inlineLinks: cfg.inlineLinks ?? existingConfig?.inlineLinks,
      state: cfg.state ?? existingConfig?.state,
      threadContext: cfg.threadContext ?? existingConfig?.threadContext,
      chatOptions: cfg.chatOptions ?? existingConfig?.chatOptions,
      tools: cfg.tools ?? existingConfig?.tools,
      resolveResourceId: cfg.resolveResourceId ?? existingConfig?.resolveResourceId,
      waitUntil: cfg.waitUntil ?? existingConfig?.waitUntil,
      resolveWaitUntil: cfg.resolveWaitUntil ?? existingConfig?.resolveWaitUntil,
    });
    agent.setChannels(channels);
    return channels;
  }

  async #autoInitialize(): Promise<void> {
    if (!this.#mastra) return;
    await this.initialize();
  }

  #resolveAgent(agentId: string): Agent | undefined {
    try {
      return this.#mastra?.getAgentById(agentId) as Agent | undefined;
    } catch {
      return undefined;
    }
  }

  async #getStore(): Promise<TeamsInstallStore> {
    if (this.#store) return this.#store;
    const encryptionKey = this.#config.encryptionKey ?? process.env.MASTRA_ENCRYPTION_KEY;
    this.#store = new TeamsInstallStore(await this.#resolveStorage(), encryptionKey);
    return this.#store;
  }

  async #resolveStorage(): Promise<ChannelsStorage> {
    if (this.#config.storage) return this.#config.storage;
    const mastraStore = this.#mastra?.getStorage();
    if (mastraStore) {
      // A configured store that fails to initialize must surface, not silently
      // degrade to in-memory — delegated installs hold real Entra apps and
      // secrets that would be orphaned when the non-persistent store is lost.
      await mastraStore.init();
      const channels = await mastraStore.getStore('channels');
      if (channels) return channels;
    }
    // No persistent storage available — fall back to in-memory. Installations
    // won't survive a restart; pass `storage` or configure Mastra storage in prod.
    console.warn(
      '[Teams] No persistent channels storage configured — installations are stored in memory and will be lost on restart.',
    );
    return new InMemoryChannelsStorage();
  }

  #getBaseUrl(): string | undefined {
    if (this.#config.baseUrl) return stripTrailingSlash(this.#config.baseUrl);
    const server = this.#mastra?.getServer();
    if (!server) return undefined;
    const protocol = server.studioProtocol ?? 'http';
    const host = server.studioHost ?? server.host ?? 'localhost';
    const port = server.studioPort ?? server.port ?? (Number(process.env.PORT) || 4111);
    const includePort = !((protocol === 'https' && port === 443) || (protocol === 'http' && port === 80));
    return includePort ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
