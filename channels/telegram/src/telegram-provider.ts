import { randomUUID, timingSafeEqual } from 'node:crypto';
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
import { createTelegramAdapter } from '@chat-adapter/telegram';
import type { TelegramAdapter } from '@chat-adapter/telegram';
import { deleteWebhook, generateSecretToken, getMe, setMyCommands, setWebhook } from './telegram-client';
import { DEFAULT_COMMANDS, normalizeCommands } from './commands';
import { PLATFORM, TelegramInstallStore, toInstallationInfo } from './install-store';
import { BOTFATHER_DEEP_LINK, DEFAULT_ALLOWED_UPDATES, TELEGRAM_API_BASE_URL } from './types';
import type { TelegramConnectOptions, TelegramInstallation, TelegramMode, TelegramProviderConfig } from './types';

/**
 * Resolve the per-adapter streaming/typing config the provider applies to the
 * Telegram entry in `AgentChannels.adapters`. This is the wrapper's stream
 * binding: enabling `streaming` runs the adapter's post-and-edit
 * (`editMessageText`) chunking loop, and `typingStatus` keeps a `sendChatAction`
 * indicator alive — both default on.
 */
export function resolveTelegramAdapterConfig(config: Pick<TelegramProviderConfig, 'streaming' | 'typingStatus'>): {
  streaming: StreamingConfig;
  typingStatus: boolean;
} {
  return {
    streaming: config.streaming ?? true,
    typingStatus: config.typingStatus ?? true,
  };
}

/** Header Telegram echoes the per-bot secret on for every webhook POST. */
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

/**
 * Telegram channel provider for Mastra — a {@link ChannelProvider} over
 * `@chat-adapter/telegram`. The adapter handles the Bot API transport (webhook
 * parse, send/edit, typing, rich messages); this provider adds the
 * install/lifecycle layer.
 *
 * Implemented:
 * - **`mastra-telegram-i2g.2`** — multi-token install store (one bot = one
 *   agent), `connect()`/`disconnect()`, `getMe` token ingestion.
 * - **`mastra-telegram-i2g.3`** — per-bot `setWebhook` lifecycle,
 *   `X-Telegram-Bot-Api-Secret-Token` verification, webhook⇄polling exclusion,
 *   and a mounted POST route that delegates to `AgentChannels.handleWebhookEvent`.
 *
 * Later: `setMyCommands` + streaming (`mastra-telegram-i2g.4`).
 *
 * @example
 * ```ts
 * const telegram = new TelegramProvider({ baseUrl: 'https://my-app.example.com' })
 * const mastra = new Mastra({ agents: { myAgent }, channels: { telegram } })
 * await telegram.connect('my-agent', { botToken: '123456:ABC-...' }) // → { type: 'immediate' }
 * ```
 */
export class TelegramProvider implements ChannelProvider {
  readonly id = PLATFORM;

  #config: TelegramProviderConfig;
  #mastra?: Mastra;
  #store?: TelegramInstallStore;
  /** Live adapters, keyed by installation id. */
  #adapters = new Map<string, TelegramAdapter>();
  /** Cached sync view of whether any active bot is registered (for {@link getInfo}). */
  #configured = false;
  #initPromise: Promise<void> | null = null;

  constructor(config: TelegramProviderConfig = {}) {
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
   * Per-bot webhook route. A single POST endpoint keyed by an opaque
   * `webhookId`; the per-bot secret is verified from the request header, never
   * carried in the URL. Auto-initializes on first hit (mirrors `@mastra/slack`).
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
      name: 'Telegram',
      isConfigured: this.#configured,
      connectOptionsSchema: {
        type: 'object',
        properties: {
          botToken: {
            type: 'string',
            description: 'BotFather bot token. Omit to receive a BotFather deep link instead.',
          },
          name: {
            type: 'string',
            description: "Display name for the bot (defaults to the bot's @username).",
          },
        },
      },
    };
  }

  /**
   * Restore installations from storage: rebuild an adapter per active bot and
   * inject `AgentChannels` so the agent can receive events immediately.
   * Idempotent. Does not re-register webhooks (they persist server-side across
   * restarts); reconnect an agent if its `baseUrl` changed.
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
        console.error(`[Telegram] Failed to restore installation "${installation.id}":`, err);
      }
    }
  }

  /**
   * Update runtime provider settings. Telegram has no global auth credential to
   * clear (per-bot tokens are managed via {@link connect}/{@link disconnect}),
   * so `null` is a no-op; an object merges `apiBaseUrl`/`baseUrl` overrides.
   */
  async configure(credentials: { apiBaseUrl?: string; baseUrl?: string } | null): Promise<void> {
    if (credentials === null) return;
    this.#config = { ...this.#config, ...credentials };
  }

  /**
   * Connect an agent to a Telegram bot.
   *
   * - With `options.botToken`: validate via `getMe`, mint a per-bot webhook
   *   secret, persist the installation, register the transport (webhook or
   *   polling), and return `{ type: 'immediate' }`.
   * - Without a token: persist a pending installation and return
   *   `{ type: 'deep_link' }` pointing at BotFather.
   */
  async connect(agentId: string, options: TelegramConnectOptions = {}): Promise<ChannelConnectResult> {
    const store = await this.#getStore();
    const existing = await store.getByAgent(agentId);
    if (existing?.status === 'active') {
      throw new Error(`Agent "${agentId}" is already connected to Telegram. Disconnect first to reconnect.`);
    }

    if (!options.botToken) {
      const installationId = existing?.id ?? randomUUID();
      await store.save({
        id: installationId,
        agentId,
        webhookId: existing?.webhookId ?? randomUUID(),
        status: 'pending',
        installedAt: existing?.installedAt ?? new Date(),
      });
      return { type: 'deep_link', url: BOTFATHER_DEEP_LINK, installationId };
    }

    const me = await getMe(options.botToken, this.#apiBaseUrl());
    const installationId = existing?.id ?? randomUUID();
    const webhookId = existing?.webhookId ?? randomUUID();
    const baseUrl = this.#getBaseUrl();
    const mode = this.#resolveMode(baseUrl);
    if (mode === 'webhook' && !baseUrl) {
      throw new Error(
        'TelegramProvider needs a baseUrl to register a webhook. Set `baseUrl`, configure the Mastra server, or use `mode: "polling"`.',
      );
    }
    const webhookUrl = mode === 'webhook' ? `${baseUrl}/${PLATFORM}/events/${webhookId}` : undefined;
    const commands = normalizeCommands(options.commands ?? this.#config.commands ?? DEFAULT_COMMANDS);
    const installation: TelegramInstallation = {
      id: installationId,
      agentId,
      webhookId,
      status: 'active',
      botToken: options.botToken,
      secretToken: generateSecretToken(),
      username: options.name ?? me.username ?? me.first_name,
      webhookUrl,
      commands: commands.length ? commands : undefined,
      installedAt: existing?.installedAt ?? new Date(),
    };

    // Register the transport before persisting so a Bot API failure surfaces to
    // the caller instead of leaving a half-connected install.
    await this.#registerTransport(installation, mode);
    await this.#registerCommands(installation);
    await store.save(installation);
    await this.#activateInstallation(installation);
    this.#configured = true;
    await this.#config.onInstall?.(installation);
    return { type: 'immediate', installationId };
  }

  /** Disconnect an agent from Telegram, removing its webhook and installation. */
  async disconnect(agentId: string): Promise<void> {
    const store = await this.#getStore();
    const existing = await store.getByAgent(agentId);
    if (!existing) {
      throw new Error(`No Telegram installation found for agent "${agentId}"`);
    }
    // Stop the polling loop (no-op in webhook mode) so it isn't orphaned.
    const adapter = this.#adapters.get(existing.id);
    if (adapter) {
      try {
        await adapter.stopPolling();
      } catch (err) {
        console.warn(`[Telegram] Failed to stop polling for agent "${agentId}":`, err);
      }
    }
    if (existing.botToken) {
      try {
        await deleteWebhook(existing.botToken, true, this.#apiBaseUrl());
      } catch (err) {
        console.warn(`[Telegram] Failed to delete webhook for agent "${agentId}":`, err);
      }
    }
    this.#adapters.delete(existing.id);
    await store.deleteByAgent(agentId);
    this.#configured = (await store.list()).some(i => i.status === 'active');
  }

  /** List installations (public info only — no tokens or secrets). */
  async listInstallations(): Promise<ChannelInstallationInfo[]> {
    const store = await this.#getStore();
    const installations = await store.list();
    return installations.map(toInstallationInfo);
  }

  /**
   * Get the full installation for an agent (includes the bot token / secret).
   * Returns `null` if the agent has no Telegram installation. Mirrors
   * `SlackProvider.getInstallation`.
   */
  async getInstallation(agentId: string): Promise<TelegramInstallation | null> {
    const store = await this.#getStore();
    return (await store.getByAgent(agentId)) ?? null;
  }

  /**
   * Whether at least one bot is actively registered. Mirrors
   * `SlackProvider.isConfigured` (Telegram has no global credential to check —
   * "configured" means an active installation exists).
   */
  isConfigured(): boolean {
    return this.#configured;
  }

  /**
   * Get the live `TelegramAdapter` for an installation id, if one is active.
   * Used for message formatting/posting. Mirrors `SlackProvider.getAdapter`.
   */
  getAdapter(installationId: string): TelegramAdapter | undefined {
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
    if (!webhookId) return c.json({ ok: false, error: 'Missing webhookId' }, 400);

    const store = await this.#getStore();
    const installation = await store.getByWebhookId(webhookId);
    if (!installation || installation.status !== 'active') {
      return c.json({ ok: false, error: 'Unknown webhook' }, 404);
    }

    // Verify the shared secret on every POST (constant-time), before any work.
    const provided = c.req.header(SECRET_HEADER);
    if (!secretMatches(provided, installation.secretToken)) {
      return c.json({ ok: false, error: 'Invalid secret token' }, 401);
    }

    const agent = this.#resolveAgent(installation.agentId);
    if (!agent || !this.#mastra) {
      // Verified but nothing to route to — ack so Telegram stops retrying.
      return c.json({ ok: true });
    }

    const adapter = this.#getOrCreateAdapter(installation);
    let channels = agent.getChannels();
    if (!channels || channels.adapters[PLATFORM] !== adapter) {
      channels = this.#createAgentChannels(agent, adapter);
      await channels.initialize(this.#mastra);
    }

    const waitUntil = this.#config.waitUntil ?? resolveWaitUntil(c as never);
    try {
      return await channels.handleWebhookEvent(PLATFORM, c.req.raw, waitUntil ? { waitUntil } : undefined);
    } catch (err) {
      console.error('[Telegram] Error delegating to AgentChannels:', err);
      return c.json({ ok: true });
    }
  }

  // ===========================================================================
  // Internals
  // ===========================================================================

  #apiBaseUrl(): string {
    return this.#config.apiBaseUrl ?? TELEGRAM_API_BASE_URL;
  }

  #resolveMode(baseUrl: string | undefined): Exclude<TelegramMode, 'auto'> {
    const mode = this.#config.mode ?? 'auto';
    if (mode === 'auto') return baseUrl ? 'webhook' : 'polling';
    return mode;
  }

  /** Register (or clear) the receive transport for a bot, enforcing the exclusion. */
  async #registerTransport(installation: TelegramInstallation, mode: Exclude<TelegramMode, 'auto'>): Promise<void> {
    if (!installation.botToken) return;
    if (mode === 'webhook' && installation.webhookUrl && installation.secretToken) {
      await setWebhook(
        installation.botToken,
        {
          url: installation.webhookUrl,
          secretToken: installation.secretToken,
          allowedUpdates: this.#config.allowedUpdates ?? [...DEFAULT_ALLOWED_UPDATES],
          dropPendingUpdates: true,
        },
        this.#apiBaseUrl(),
      );
    } else {
      // Polling: clear any existing webhook so `getUpdates` can run (exclusion).
      await deleteWebhook(installation.botToken, true, this.#apiBaseUrl());
    }
  }

  /** Publish the bot's command list (best-effort — a failure won't block connect). */
  async #registerCommands(installation: TelegramInstallation): Promise<void> {
    if (!installation.botToken || !installation.commands?.length) return;
    try {
      await setMyCommands(
        installation.botToken,
        { commands: installation.commands, scope: this.#config.commandScope },
        this.#apiBaseUrl(),
      );
    } catch (err) {
      console.warn(`[Telegram] Failed to register commands for agent "${installation.agentId}":`, err);
    }
  }

  #getOrCreateAdapter(installation: TelegramInstallation): TelegramAdapter {
    const existing = this.#adapters.get(installation.id);
    if (existing) return existing;
    const adapter = createTelegramAdapter({
      botToken: installation.botToken,
      secretToken: installation.secretToken,
      userName: installation.username,
      apiBaseUrl: this.#apiBaseUrl(),
      mode: installation.webhookUrl ? 'webhook' : (this.#config.mode ?? 'auto'),
      ...(this.#config.logger !== undefined ? { logger: this.#config.logger } : {}),
      ...(this.#config.longPolling !== undefined ? { longPolling: this.#config.longPolling } : {}),
    });
    this.#adapters.set(installation.id, adapter);
    return adapter;
  }

  /** Rebuild the adapter and inject AgentChannels for an active installation. */
  async #activateInstallation(installation: TelegramInstallation): Promise<void> {
    const agent = this.#resolveAgent(installation.agentId);
    const adapter = this.#getOrCreateAdapter(installation);
    if (agent && this.#mastra) {
      const channels = this.#createAgentChannels(agent, adapter);
      await channels.initialize(this.#mastra);
    }
  }

  /**
   * Create AgentChannels for an agent with the Telegram adapter, preserving any
   * adapters/config the agent author already configured (mirrors `@mastra/slack`).
   */
  #createAgentChannels(agent: Agent, adapter: TelegramAdapter): AgentChannels {
    const existing = agent.getChannels();
    const existingConfig = existing?.channelConfig;
    const cfg = this.#config;
    // Adapter-level (per-Telegram-entry) overrides: streaming binding + webhook
    // route CORS + error formatting.
    const entry = {
      adapter,
      ...resolveTelegramAdapterConfig(cfg),
      // Telegram has no Block Kit; default tool rendering to plain text so
      // 'cards'/'grouped'/'timeline' don't degrade to fallback text unexpectedly.
      toolDisplay: cfg.toolDisplay ?? 'text',
      ...(cfg.cors !== undefined ? { cors: cfg.cors } : {}),
      ...(cfg.formatError !== undefined ? { formatError: cfg.formatError } : {}),
    } as ChannelAdapterConfig;
    // Channel-level options forwarded to AgentChannels for every connected agent.
    // Prefer this provider's config, falling back to anything the agent author
    // already set so we never clobber an explicit choice with `undefined`.
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

  async #getStore(): Promise<TelegramInstallStore> {
    if (this.#store) return this.#store;
    const encryptionKey = this.#config.encryptionKey ?? process.env.MASTRA_ENCRYPTION_KEY;
    this.#store = new TelegramInstallStore(await this.#resolveStorage(), encryptionKey);
    return this.#store;
  }

  async #resolveStorage(): Promise<ChannelsStorage> {
    if (this.#config.storage) return this.#config.storage;
    const mastraStore = this.#mastra?.getStorage();
    if (mastraStore) {
      try {
        await mastraStore.init();
        const channels = await mastraStore.getStore('channels');
        if (channels) return channels;
      } catch {
        // Fall through to the in-memory store below.
      }
    }
    // No persistent storage available — fall back to in-memory. Installations
    // won't survive a restart; pass `storage` or configure Mastra storage in prod.
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

/** Constant-time comparison of the webhook secret header. */
function secretMatches(provided: string | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}
