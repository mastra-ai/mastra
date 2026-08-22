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
import { createDiscordAdapter } from '@chat-adapter/discord';
import type { DiscordAdapter } from '@chat-adapter/discord';
import {
  buildInviteUrl,
  guildHealthCheck,
  registerGlobalCommands,
  registerGuildCommands,
  validateApp,
} from './discord-client';
import { DEFAULT_COMMANDS, hashCommands, normalizeCommands } from './commands';
import { DiscordInstallStore, PLATFORM, toInstallationInfo } from './install-store';
import { DEFAULT_INVITE_PERMISSIONS, DEFAULT_INVITE_SCOPES, DISCORD_API_BASE_URL } from './types';
import type { DiscordAppConfig, DiscordConnectOptions, DiscordInstallation, DiscordProviderConfig } from './types';

/**
 * Resolve the per-adapter config the provider applies to the Discord entry in
 * `AgentChannels.adapters`. Discord has native embeds + action-row buttons, so
 * `toolDisplay` defaults to `'cards'` (unlike Telegram's `'text'`); `streaming`
 * post-and-edits the interaction followup; `gateway` (default `true`) makes core
 * own the DM/mention Gateway reconnection loop.
 */
export function resolveDiscordAdapterConfig(
  config: Pick<DiscordProviderConfig, 'streaming' | 'typingStatus' | 'toolDisplay' | 'gateway'>,
): {
  streaming: StreamingConfig;
  typingStatus: boolean;
  toolDisplay: ChannelAdapterConfig['toolDisplay'];
  gateway: boolean;
} {
  return {
    streaming: config.streaming ?? true,
    typingStatus: config.typingStatus ?? true,
    toolDisplay: config.toolDisplay ?? 'cards',
    gateway: config.gateway ?? true,
  };
}

/**
 * Discord channel provider for Mastra — a {@link ChannelProvider} over
 * `@chat-adapter/discord`. The adapter handles the protocol (Ed25519 request
 * verification, PING/PONG, deferrals, embeds/buttons, the Gateway bridge,
 * post-and-edit streaming); this provider adds the lifecycle layer.
 *
 * **One app, many guilds.** Discord has no programmatic app creation, so a
 * single application's credentials (bot token / public key / application id) are
 * stored **once** and reused across every guild. "Installing" is a bot invite —
 * an OAuth2 authorize URL — not a token exchange, so `connect()` returns the
 * `oauth` variant. A guild is confirmed either eagerly (the bot is already a
 * member) or lazily off the first inbound interaction's authoritative `guild_id`
 * (see {@link activateGuild}).
 *
 * **Gateway is core's job.** The mounted interactions route only ever receives
 * HTTP Interactions (PING, slash commands, buttons). DMs / @mentions / reactions
 * arrive over the Gateway WebSocket, whose reconnection loop core owns: setting
 * `gateway: true` (default) on the adapter entry is enough — the wrapper never
 * calls `startGatewayListener` or runs a reconnect loop.
 *
 * Implemented (issues `mastra-discord-13x.2` + `.3`): the app-config +
 * guild-keyed install store, `connect()`/`disconnect()`, OAuth2 invite-URL
 * generation, the interactions route (raw-body delegation), and adapter/Gateway
 * wiring. Command registration lands in `mastra-discord-13x.4`.
 */
export class DiscordProvider implements ChannelProvider {
  readonly id = PLATFORM;

  #config: DiscordProviderConfig;
  #mastra?: Mastra;
  #store?: DiscordInstallStore;
  /** Live adapters, keyed by installation id (one per agent; all share the app's bot token). */
  #adapters = new Map<string, DiscordAdapter>();
  /** Cached sync view of whether the app is configured (for {@link getInfo}). */
  #configured = false;
  #initPromise: Promise<void> | null = null;
  /**
   * Whether {@link #store} was built on the in-memory fallback rather than real
   * storage — i.e. it was resolved before a `Mastra` instance was available.
   */
  #storeIsFallback = false;
  /**
   * A fallback store dropped by {@link __attach}, held until the next store
   * access so its contents can be carried into the real storage. See
   * {@link #migrateFallback}.
   */
  #pendingMigration?: DiscordInstallStore;
  /**
   * The single in-flight store resolution. Concurrent callers share it rather
   * than each running {@link #resolveStore}, so the fallback migration can't be
   * raced: without this, a second caller reads the already-claimed
   * {@link #pendingMigration} as absent, skips the migration, and caches a store
   * over storage the first caller has not finished populating.
   */
  #storeResolution?: Promise<DiscordInstallStore | undefined>;
  /**
   * Bumped by every {@link __attach}. A resolution that started before an attach
   * was built against the previous storage target, so it must not cache its
   * result; it reports itself superseded and the caller resolves again.
   */
  #storeGeneration = 0;

  constructor(config: DiscordProviderConfig = {}) {
    this.#config = config;
    // The app is "configured" as soon as credentials are resolvable (config/env),
    // even before the first connect persists them.
    this.#configured = this.#suppliedAppConfig() != null;
  }

  /**
   * Called by Mastra when this channel is registered.
   * @internal
   */
  __attach(mastra: Mastra): void {
    const isNewInstance = this.#mastra != null && this.#mastra !== mastra;
    // Any attach can change the storage target, so a resolution already in
    // flight is now stale — including the first attach, where the guard below
    // can't see it: #store is still undefined and #storeIsFallback still false
    // while that resolution runs, so it would sail past and pin the provider to
    // the in-memory fallback *after* real storage became reachable.
    this.#storeGeneration++;
    // Drop the cached store when it belongs to a superseded Mastra, and when a
    // public method (connect(), initialize(), …) ran before registration and
    // pinned the provider to the in-memory fallback — otherwise installs keep
    // going to memory and are lost on restart even though real storage is
    // configured. Whatever that fallback holds was written before real storage
    // was reachable, so hand it to the next store access to carry across rather
    // than discarding it: a pre-registration connect() would otherwise return an
    // installation that no longer exists by the time its route is hit.
    if (isNewInstance || this.#storeIsFallback) {
      if (this.#storeIsFallback) this.#pendingMigration = this.#store;
      this.#initPromise = null;
      this.#store = undefined;
      this.#storeIsFallback = false;
    }
    if (isNewInstance) {
      this.#adapters.clear();
      // The store-derived half of #configured belongs to the old instance; only
      // credentials supplied via config/env survive a re-attach. Without this,
      // getInfo() can report a stale isConfigured before initialize() re-runs.
      this.#configured = this.#suppliedAppConfig() != null;
    }
    this.#mastra = mastra;
  }

  /**
   * The interactions route: a single POST endpoint keyed by an opaque
   * `webhookId`. The handler passes the **RAW** request bytes straight to
   * `adapter.handleWebhook` — Ed25519 verification + PING/PONG live in the
   * adapter, and any middleware that parsed/re-serialized the body would break
   * every signature. `requiresAuth: false` (Discord authenticates via Ed25519,
   * not a bearer token). Auto-initializes on first hit (mirrors `@mastra/slack`).
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
    return {
      id: this.id,
      name: 'Discord',
      isConfigured: this.#configured,
      connectOptionsSchema: {
        type: 'object',
        properties: {
          guildId: {
            type: 'string',
            description:
              'Guild (server) to install into. If the bot is already a member, connect binds immediately; otherwise you receive an invite URL.',
          },
          name: {
            type: 'string',
            description: "Display name for the installation (defaults to the application's name).",
          },
          commands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Slash command names to register for this agent.',
          },
        },
      },
    };
  }

  /**
   * Restore state from storage: mark the provider configured when an app config
   * or any active installation exists, and rebuild an adapter + `AgentChannels`
   * per active install so its Gateway loop (core-owned) starts. Idempotent.
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
    const hasApp = (await store.getAppConfig()) != null || this.#suppliedAppConfig() != null;
    this.#configured = hasApp || active.length > 0;
    for (const installation of active) {
      try {
        await this.#activateInstallation(installation);
      } catch (err) {
        console.error(`[Discord] Failed to restore installation "${installation.id}":`, err);
      }
    }
  }

  /**
   * Provide or clear the app credentials at runtime. An object merges/overrides
   * `botToken` / `publicKey` / `applicationId` (persisted on the next `connect`);
   * `null` clears the stored app config.
   */
  async configure(credentials: Partial<DiscordAppConfig> | null): Promise<void> {
    if (credentials === null) {
      const store = await this.#getStore();
      await store.deleteAppConfig();
      this.#config = { ...this.#config, app: undefined };
      this.#configured = false;
      // Live adapters still hold the app credentials that were just revoked.
      this.#adapters.clear();
      this.#initPromise = null;
      return;
    }
    const previous = this.#config.app;
    this.#config = { ...this.#config, app: { ...previous, ...credentials } };
    this.#configured = this.#suppliedAppConfig() != null || this.#configured;

    // An adapter captures botToken / publicKey / applicationId at construction,
    // so cached ones keep verifying Ed25519 against the *old* public key and
    // authenticating with the *old* bot token. Rebuild them when any changes.
    const changed = (['botToken', 'publicKey', 'applicationId'] as const).some(
      k => credentials[k] !== undefined && credentials[k] !== previous?.[k],
    );
    if (!changed) return;

    // Persist the rotation. Every credential consumer — #resolveAppConfig,
    // #activateInstallation, #handleWebhook — reads the *stored* app config, so
    // updating only #config.app would leave adapters rebuilding from the old
    // credentials and Ed25519 still verifying against the superseded key.
    const store = await this.#getStore();
    const stored = await store.getAppConfig();
    if (stored) {
      const merged = { ...stored, ...credentials };
      if (merged.botToken && merged.publicKey && merged.applicationId) {
        await store.saveAppConfig(merged);
      }
    }

    const wasInitialized = this.#initPromise !== null;
    this.#adapters.clear();
    this.#initPromise = null;
    if (wasInitialized) await this.initialize();
  }

  /**
   * Connect an agent to Discord.
   *
   * - Ensures the app config exists (stored, or supplied via provider config /
   *   `DISCORD_*` env and persisted once, after validation). Throws if none —
   *   Discord apps are created in the Developer Portal, not programmatically.
   * - Validates the bot token via `GET /applications/@me`.
   * - If `options.guildId` is given **and the bot is already in that guild**,
   *   binds immediately (`{ type: 'immediate' }`).
   * - Otherwise persists a pending install and returns the OAuth2 bot-invite URL
   *   (`{ type: 'oauth', authorizationUrl }`); the guild activates lazily on the
   *   first interaction.
   */
  async connect(agentId: string, options: DiscordConnectOptions = {}): Promise<ChannelConnectResult> {
    const store = await this.#getStore();
    const existing = await store.getByAgent(agentId);
    if (existing?.status === 'active') {
      throw new Error(
        `Agent "${agentId}" is already connected to Discord. Disconnect first to reconnect. ` +
          'To add another server, invite the bot with the existing URL — new guilds activate on first use.',
      );
    }

    const { app, persisted } = await this.#resolveAppConfig(store);
    // Validate the token before persisting supplied credentials — an invalid
    // token must leave no app config and no install behind.
    const identity = await validateApp(app.botToken, this.#apiBaseUrl());
    if (!persisted) await store.saveAppConfig(app);

    const installationId = existing?.id ?? randomUUID();
    const webhookId = existing?.webhookId ?? randomUUID();
    const displayName = options.name ?? identity.name;
    const installedAt = existing?.installedAt ?? new Date();
    const commands = normalizeCommands(options.commands ?? this.#config.commands ?? DEFAULT_COMMANDS);

    // Eager bind: the bot is already a member of the target guild.
    if (options.guildId && (await guildHealthCheck(app.botToken, options.guildId, this.#apiBaseUrl()))) {
      const installation: DiscordInstallation = {
        id: installationId,
        agentId,
        webhookId,
        status: 'active',
        guildIds: [options.guildId],
        displayName,
        commands: commands.length ? commands : undefined,
        commandVersions: existing?.commandVersions,
        installedAt,
      };
      await store.save(installation);
      await this.#registerCommands(app, installation, options.guildId);
      await this.#activateInstallation(installation);
      this.#configured = true;
      await this.#config.onInstall?.(installation);
      return { type: 'immediate', installationId };
    }

    // Invite flow: persist pending, hand back the OAuth2 bot-invite URL.
    const pending: DiscordInstallation = {
      id: installationId,
      agentId,
      webhookId,
      status: 'pending',
      guildIds: existing?.guildIds ?? [],
      displayName,
      commands: commands.length ? commands : undefined,
      commandVersions: existing?.commandVersions,
      installedAt,
    };
    await store.save(pending);
    // Global commands don't need a guild — register once now (best-effort).
    // Guild commands wait for the first-seen guild (lazy activation).
    await this.#registerCommands(app, pending);
    this.#configured = true;
    const authorizationUrl = buildInviteUrl({
      applicationId: app.applicationId,
      permissions: options.permissions ?? this.#config.permissions ?? DEFAULT_INVITE_PERMISSIONS,
      scopes: DEFAULT_INVITE_SCOPES,
      // Preselect the requested guild so the authorized one matches the install.
      ...(options.guildId !== undefined ? { guildId: options.guildId } : {}),
    });
    return { type: 'oauth', authorizationUrl, installationId };
  }

  /**
   * Confirm a guild off an inbound interaction's authoritative `guild_id` and
   * mark the installation active (lazy activation). Called by the interactions
   * route on first use. Returns the updated installation, or `null` if the
   * `webhookId` is unknown.
   */
  async activateGuild(webhookId: string, guildId: string): Promise<DiscordInstallation | null> {
    const store = await this.#getStore();
    const installation = await store.getByWebhookId(webhookId);
    if (!installation) return null;

    const wasActive = installation.status === 'active';
    const known = installation.guildIds.includes(guildId);
    if (wasActive && known) return installation; // nothing to persist

    if (!known) installation.guildIds.push(guildId);
    installation.status = 'active';
    await store.save(installation);
    // Register this newly-seen guild's commands (best-effort, hash-skipped).
    const app = await store.getAppConfig();
    if (app) await this.#registerCommands(app, installation, guildId);
    this.#configured = true;
    if (!wasActive) await this.#config.onInstall?.(installation);
    return installation;
  }

  /**
   * Disconnect an agent from Discord: remove its installation row and drop the
   * adapter entry.
   *
   * **Limitation:** the Gateway loop is owned by core (it calls
   * `startGatewayListener` itself; there is no `stopGatewayListener`), so
   * disconnect cannot kill an in-flight gateway window — it lapses at the next
   * duration boundary. Contrast Telegram's clean `stopPolling()`.
   */
  async disconnect(agentId: string): Promise<void> {
    const store = await this.#getStore();
    const existing = await store.getByAgent(agentId);
    if (!existing) {
      throw new Error(`No Discord installation found for agent "${agentId}"`);
    }
    this.#adapters.delete(existing.id);
    await store.deleteByAgent(agentId);
    this.#configured = (await store.getAppConfig()) != null || (await store.list()).some(i => i.status === 'active');
  }

  /** List installations (public info only — no secrets). */
  async listInstallations(): Promise<ChannelInstallationInfo[]> {
    const store = await this.#getStore();
    const installations = await store.list();
    return installations.map(toInstallationInfo);
  }

  /** The full installation for an agent (no secrets live on it), or `null`. */
  async getInstallation(agentId: string): Promise<DiscordInstallation | null> {
    const store = await this.#getStore();
    return (await store.getByAgent(agentId)) ?? null;
  }

  /** Whether the Discord app is configured (credentials resolvable). */
  isConfigured(): boolean {
    return this.#configured;
  }

  /** The live `DiscordAdapter` for an installation id, if one is active. */
  getAdapter(installationId: string): DiscordAdapter | undefined {
    return this.#adapters.get(installationId);
  }

  // ===========================================================================
  // Webhook handling
  // ===========================================================================

  async #handleWebhook(c: {
    req: { param: (k: string) => string | undefined; header: (k: string) => string | undefined; raw: Request };
    json: (body: unknown, status?: number) => Response;
  }): Promise<Response> {
    const webhookId = c.req.param('webhookId');
    if (!webhookId) return c.json({ error: 'Missing webhookId' }, 400);

    const store = await this.#getStore();
    const installation = await store.getByWebhookId(webhookId);
    if (!installation) return c.json({ error: 'Unknown webhook' }, 404);

    const app = await store.getAppConfig();
    if (!app) return c.json({ error: 'Discord app is not configured' }, 503);

    const adapter = this.#getOrCreateAdapter(installation, app);
    const waitUntil = this.#config.waitUntil ?? resolveWaitUntil(c as never);

    // Lazily confirm the guild off the interaction's authoritative `guild_id`,
    // in the background so the 3s deferred-ACK window isn't spent on storage I/O.
    // Clone FIRST so the raw bytes reach the adapter untouched (Ed25519 footgun).
    const activation = this.#activateFromInteraction(webhookId, c.req.raw.clone());
    if (waitUntil) waitUntil(activation);
    else void activation.catch(() => {});

    const agent = this.#resolveAgent(installation.agentId);
    if (!agent || !this.#mastra) {
      // No agent wired (endpoint-verification PING, or the agent was removed).
      // Delegate straight to the adapter so Ed25519 + PING/PONG still work.
      try {
        return await adapter.handleWebhook(c.req.raw, waitUntil ? { waitUntil } : undefined);
      } catch (err) {
        console.error('[Discord] adapter.handleWebhook error:', err);
        return c.json({ error: 'Internal error' }, 500);
      }
    }

    let channels = agent.getChannels();
    if (!channels || channels.adapters[PLATFORM] !== adapter) {
      channels = this.#createAgentChannels(agent, adapter);
      await channels.initialize(this.#mastra);
    }

    try {
      return await channels.handleWebhookEvent(PLATFORM, c.req.raw, waitUntil ? { waitUntil } : undefined);
    } catch (err) {
      console.error('[Discord] Error delegating to AgentChannels:', err);
      return c.json({ error: 'Internal error' }, 500);
    }
  }

  /** Extract the guild from an interaction body (a clone) and activate it. Best-effort. */
  async #activateFromInteraction(webhookId: string, request: Request): Promise<void> {
    try {
      const body = (await request.json()) as { guild_id?: string };
      // PING (type 1) and DMs have no guild_id — nothing to activate.
      if (body?.guild_id) await this.activateGuild(webhookId, body.guild_id);
    } catch {
      // Unreadable/non-JSON body, or no guild — skip.
    }
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  #apiBaseUrl(): string {
    return this.#config.apiBaseUrl ?? DISCORD_API_BASE_URL;
  }

  /**
   * Register an installation's slash commands (best-effort — a failure logs and
   * doesn't block connect). Skips the `PUT` when the command hash is unchanged
   * for the scope key, so re-activation of a known guild costs no API call
   * (200 creates/day/guild). `guildId` is required for guild scope; global scope
   * ignores it and registers once under the `'global'` key.
   */
  async #registerCommands(app: DiscordAppConfig, installation: DiscordInstallation, guildId?: string): Promise<void> {
    const commands = installation.commands ?? [];
    if (!commands.length) return;
    const scope = this.#config.commandScope ?? 'guild';
    const key = scope === 'global' ? 'global' : guildId;
    if (!key) return; // guild scope with no guild yet — defer to lazy activation

    const hash = hashCommands(commands);
    const versions = installation.commandVersions ?? {};
    if (versions[key] === hash) return; // unchanged — skip (rate-limit aware)

    try {
      if (scope === 'global') {
        await registerGlobalCommands(app.botToken, app.applicationId, commands, this.#apiBaseUrl());
      } else {
        await registerGuildCommands(app.botToken, app.applicationId, guildId!, commands, this.#apiBaseUrl());
      }
      installation.commandVersions = { ...versions, [key]: hash };
      const store = await this.#getStore();
      await store.save(installation);
    } catch (err) {
      console.warn(`[Discord] command registration failed (${scope}${guildId ? `, guild ${guildId}` : ''}):`, err);
    }
  }

  /** Build (once) the adapter for an installation from the shared app config. */
  #getOrCreateAdapter(installation: DiscordInstallation, app: DiscordAppConfig): DiscordAdapter {
    const existing = this.#adapters.get(installation.id);
    if (existing) return existing;
    const adapter = createDiscordAdapter({
      botToken: app.botToken,
      publicKey: app.publicKey,
      applicationId: app.applicationId,
      apiUrl: this.#apiBaseUrl(),
      userName: installation.displayName,
      ...(this.#config.mentionRoleIds !== undefined ? { mentionRoleIds: this.#config.mentionRoleIds } : {}),
      ...(this.#config.interactionFlags !== undefined ? { interactionFlags: this.#config.interactionFlags } : {}),
      ...(this.#config.logger !== undefined ? { logger: this.#config.logger } : {}),
    });
    this.#adapters.set(installation.id, adapter);
    return adapter;
  }

  /** Rebuild the adapter and inject AgentChannels for an active installation. */
  async #activateInstallation(installation: DiscordInstallation): Promise<void> {
    const store = await this.#getStore();
    const app = await store.getAppConfig();
    if (!app) return;
    const agent = this.#resolveAgent(installation.agentId);
    const adapter = this.#getOrCreateAdapter(installation, app);
    if (agent && this.#mastra) {
      const channels = this.#createAgentChannels(agent, adapter);
      await channels.initialize(this.#mastra);
    }
  }

  /**
   * Create AgentChannels for an agent with the Discord adapter, preserving any
   * adapters/config the agent author already configured (mirrors `@mastra/slack`
   * / `@mastra/telegram`). `gateway: true` (default) makes core start the Gateway
   * reconnection loop for DMs/mentions.
   */
  #createAgentChannels(agent: Agent, adapter: DiscordAdapter): AgentChannels {
    const existing = agent.getChannels();
    const existingConfig = existing?.channelConfig;
    const cfg = this.#config;
    const entry = {
      adapter,
      ...resolveDiscordAdapterConfig(cfg),
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

  /** App credentials from provider config or `DISCORD_*` env, or `null` if incomplete. */
  #suppliedAppConfig(): DiscordAppConfig | null {
    const a = this.#config.app ?? {};
    const botToken = a.botToken ?? process.env.DISCORD_BOT_TOKEN;
    const publicKey = a.publicKey ?? process.env.DISCORD_PUBLIC_KEY;
    const applicationId = a.applicationId ?? process.env.DISCORD_APPLICATION_ID;
    if (botToken && publicKey && applicationId) return { botToken, publicKey, applicationId };
    return null;
  }

  /**
   * Resolve the app config: prefer the stored one, else the supplied credentials
   * (config / `DISCORD_*` env). `persisted` says whether it's already in storage,
   * so the caller can persist supplied credentials **once**, after validation.
   * Throws if neither is available.
   */
  async #resolveAppConfig(store: DiscordInstallStore): Promise<{ app: DiscordAppConfig; persisted: boolean }> {
    const stored = await store.getAppConfig();
    if (stored) return { app: stored, persisted: true };
    const supplied = this.#suppliedAppConfig();
    if (supplied) return { app: supplied, persisted: false };
    throw new Error(
      'Discord app is not configured. Provide botToken, publicKey, and applicationId via the provider `app` option, ' +
        'the DISCORD_BOT_TOKEN / DISCORD_PUBLIC_KEY / DISCORD_APPLICATION_ID env vars, or configure() — ' +
        'Discord applications are created in the Developer Portal, not programmatically.',
    );
  }

  /**
   * The single entry point to the store. Every caller either gets the cached
   * store or joins the one in-flight resolution — nobody resolves in parallel,
   * so a caller that arrives mid-migration waits for it to finish instead of
   * building a second store over storage that isn't populated yet.
   */
  async #getStore(): Promise<DiscordInstallStore> {
    // Loop rather than await once: an `__attach` landing mid-resolution
    // supersedes it, and we then resolve again against the new storage target.
    for (;;) {
      if (this.#store) return this.#store;
      // Created synchronously, so two callers can't both start a resolution.
      const inFlight = (this.#storeResolution ??= this.#resolveStore(this.#storeGeneration));
      let resolved: DiscordInstallStore | undefined;
      try {
        resolved = await inFlight;
      } finally {
        // Only retract our own attempt: a superseding attempt may have replaced
        // it already, and clearing that would strand a later caller's promise.
        if (this.#storeResolution === inFlight) this.#storeResolution = undefined;
      }
      if (resolved) return resolved;
    }
  }

  /**
   * One resolution attempt, run under {@link #getStore}'s in-flight guard — so
   * the {@link #pendingMigration} claim below cannot be double-taken, and the
   * migration completes before any caller sees the store.
   *
   * Returns `undefined` when `__attach` superseded this attempt while it ran:
   * the storage target changed underneath it, so caching would pin the provider
   * to a store built for the previous one.
   */
  async #resolveStore(generation: number): Promise<DiscordInstallStore | undefined> {
    const encryptionKey = this.#config.encryptionKey ?? process.env.MASTRA_ENCRYPTION_KEY;
    const { storage, isFallback } = await this.#resolveStorage();
    // Superseded before anything was claimed — nothing to hand back.
    if (generation !== this.#storeGeneration) return undefined;
    const pending = this.#pendingMigration;
    this.#pendingMigration = undefined;
    // Storage is still unavailable, so a new fallback would be an empty one —
    // keep the store we already have instead of dropping its contents.
    if (pending && isFallback) {
      this.#storeIsFallback = true;
      this.#store = pending;
      return pending;
    }
    const store = new DiscordInstallStore(storage, encryptionKey);
    if (pending) await this.#migrateFallback(pending, store);
    if (generation !== this.#storeGeneration) {
      // Superseded while migrating. Re-queue the fallback so the next attempt
      // carries it into the new target too — #migrateFallback keeps whatever is
      // already persisted, so replaying it is harmless.
      if (pending && !this.#pendingMigration) this.#pendingMigration = pending;
      return undefined;
    }
    this.#storeIsFallback = isFallback;
    this.#store = store;
    return store;
  }

  /**
   * Copy what a pre-registration store wrote into the real storage that has
   * since become available. Anything already persisted wins — the real store is
   * the durable record, and a stale in-memory row must not overwrite it. Both
   * stores share an encryption key, so this round-trips through plaintext.
   *
   * Best-effort: a failure here must not take down `__attach`'s caller or the
   * request that triggered the resolution. The provider still works against the
   * real storage; only the pre-registration writes are missing, which is the
   * behaviour before this migration existed.
   */
  async #migrateFallback(from: DiscordInstallStore, to: DiscordInstallStore): Promise<void> {
    try {
      const app = await from.getAppConfig();
      if (app && !(await to.getAppConfig())) await to.saveAppConfig(app);
      for (const install of await from.list()) {
        if (await to.getByAgent(install.agentId)) continue;
        await to.save(install);
      }
    } catch (error) {
      console.warn(
        '[Discord] Failed to carry pre-registration installations into Mastra storage; ' +
          'connect() again to re-create them.',
        error,
      );
    }
  }

  /**
   * Resolve the backing storage, reporting whether it is the in-memory fallback
   * so {@link __attach} can re-resolve a store that was built before Mastra was
   * available, carrying its contents across.
   */
  async #resolveStorage(): Promise<{ storage: ChannelsStorage; isFallback: boolean }> {
    if (this.#config.storage) return { storage: this.#config.storage, isFallback: false };
    const mastraStore = this.#mastra?.getStorage();
    if (mastraStore) {
      try {
        await mastraStore.init();
        const channels = await mastraStore.getStore('channels');
        if (channels) return { storage: channels, isFallback: false };
      } catch {
        // Fall through to the in-memory store below.
      }
    }
    // No persistent storage available — fall back to in-memory. Installs won't
    // survive a restart; pass `storage` or configure Mastra storage in prod.
    return { storage: new InMemoryChannelsStorage(), isFallback: true };
  }
}
