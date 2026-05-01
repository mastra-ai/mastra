import * as crypto from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import {
  type ChannelProvider,
  type ChannelPlatformInfo,
  type ChannelInstallationInfo,
  type ChannelConnectResult,
  AgentChannels,
} from '@mastra/core/channels';
import type { ApiRoute, ContextWithMastra } from '@mastra/core/server';
import { type ChannelsStorage, type ChannelInstallation } from '@mastra/core/storage';
import { createSlackAdapter, type SlackAdapter } from '@chat-adapter/slack';

import { SlackManifestClient } from './client';
import { verifySlackRequest, parseSlackFormBody, encrypt, decrypt } from './crypto';
import { buildManifest } from './manifest';
import {
  SlackInstallationDataSchema,
  SlackPendingDataSchema,
  SlackConfigDataSchema,
  type SlackInstallation,
  type SlackPendingInstallation,
  type SlackConfigTokens,
  type StoredSlashCommand,
} from './schemas';
import type { SlackProviderConfig, SlashCommandConfig, SlackConnectOptions } from './types';

const PLATFORM = 'slack';

/**
 * Create a hash of the agent config for change detection.
 * Uses the resolved app name (config.name ?? agentName) to detect renames.
 */
function hashConfig(
  opts: { description?: string; slashCommands?: SlackConnectOptions['slashCommands'] },
  baseUrl: string,
  resolvedAppName: string,
  resolvedDescription: string,
): string {
  const normalized = JSON.stringify({
    name: resolvedAppName,
    description: resolvedDescription,
    slashCommands: opts.slashCommands,
    baseUrl,
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Slack channel integration for Mastra.
 *
 * Handles:
 * - Programmatic Slack app creation via manifest API
 * - OAuth flow for Slack workspace installations
 * - Webhook routing for events and slash commands
 * - Message handling via @chat-adapter/slack
 *
 * @example
 * ```ts
 * import { SlackProvider } from '@mastra/slack';
 *
 * // With credentials at construction
 * const slack = new SlackProvider({
 *   refreshToken: process.env.SLACK_APP_CONFIG_REFRESH_TOKEN,
 * });
 *
 * // Or configure later (e.g., credentials from UI or vault)
 * const slack = new SlackProvider();
 * await slack.configure({ refreshToken: 'xoxe-1-...' });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   channels: { slack },
 * });
 *
 * // Connect an agent to Slack (creates app, returns OAuth connect result)
 * const result = await slack.connect('my-agent', {
 *   name: 'My Bot',
 *   slashCommands: ['/ask', '/help'],
 * });
 * if (result.type === 'oauth') {
 *   // Redirect user to result.authorizationUrl
 * }
 * ```
 */
export class SlackProvider implements ChannelProvider {
  readonly id = 'slack';
  readonly #channelConfig: SlackProviderConfig;
  #storage!: ChannelsStorage;
  #storageResolved = false;
  #manifestClient?: SlackManifestClient;

  /** Slash command configs keyed by webhookId (restored from installation data) */
  readonly #slashCommands = new Map<string, StoredSlashCommand[]>();

  /** SlackAdapter instances keyed by installation ID */
  readonly #adapters = new Map<string, SlackAdapter>();

  #mastra?: Mastra;
  #baseUrl?: string;
  #initPromise: Promise<void> | null = null;

  constructor(config: SlackProviderConfig = {}) {
    this.#channelConfig = config;
    this.#baseUrl = config.baseUrl;

    // If refresh token is provided at construction, initialize the manifest client immediately
    if (config.refreshToken) {
      this.#initManifestClient(config.token ?? '', config.refreshToken);
    }
  }

  /**
   * Provide or clear Slack App Configuration credentials at runtime.
   *
   * Use this when credentials aren't available at construction time — for example,
   * when they're entered through the Editor UI or loaded from a vault.
   *
   * Pass `null` to clear credentials and delete stored tokens.
   *
   * @example
   * ```ts
   * const slack = new SlackProvider();
   * // Provide credentials (persists to storage immediately):
   * await slack.configure({ refreshToken: 'xoxe-1-...' });
   * // Clear credentials and stored tokens:
   * await slack.configure(null);
   * ```
   */
  async configure(credentials: { refreshToken: string; token?: string } | null): Promise<void> {
    if (credentials === null) {
      this.#manifestClient = undefined;
      return this.#deleteConfigTokens();
    }
    this.#initManifestClient(credentials.token ?? '', credentials.refreshToken);
    await this.#saveConfigTokens(
      this.#encryptConfigTokens({
        token: credentials.token ?? '',
        refreshToken: credentials.refreshToken,
        updatedAt: new Date(),
      }),
    );
  }

  /**
   * Create or replace the manifest client with new credentials.
   */
  #initManifestClient(token: string, refreshToken: string): void {
    this.#manifestClient = new SlackManifestClient({
      token,
      refreshToken,
      onTokenRotation: async tokens => {
        await this.#saveConfigTokens(
          this.#encryptConfigTokens({
            token: tokens.token,
            refreshToken: tokens.refreshToken,
            updatedAt: new Date(),
          }),
        );
      },
    });
  }

  /**
   * Normalize slash command config (string -> full config object).
   */
  #normalizeCommand(cmd: string | SlashCommandConfig): StoredSlashCommand {
    if (typeof cmd === 'string') {
      return {
        command: cmd,
        description: `Run ${cmd}`,
        prompt: '{{text}}',
      };
    }
    return {
      ...cmd,
      prompt: cmd.prompt ?? '{{text}}',
    };
  }

  /**
   * Normalize all slash commands in a config.
   */
  #normalizeCommands(commands?: (string | SlashCommandConfig)[]): StoredSlashCommand[] {
    return (commands ?? []).map(cmd => this.#normalizeCommand(cmd));
  }

  // ===========================================================================
  // Mastra Integration
  // ===========================================================================

  /**
   * Called by Mastra when this channel is registered.
   * @internal
   */
  __attach(mastra: Mastra): void {
    // If attaching to a different Mastra instance (e.g., hot reload), reset initialization
    // so we re-register adapters with the new AgentChannels instances
    if (this.#mastra && this.#mastra !== mastra) {
      this.#initPromise = null;
    }
    this.#mastra = mastra;
  }

  // ===========================================================================
  // Encryption Helpers
  // ===========================================================================

  /**
   * Get the encryption key from config or environment.
   */
  #getEncryptionKey(): string | undefined {
    return this.#channelConfig.encryptionKey ?? process.env.MASTRA_ENCRYPTION_KEY;
  }

  /**
   * Encrypt secrets in a pending installation before storage.
   */
  #encryptPendingInstallation(pending: SlackPendingInstallation): SlackPendingInstallation {
    const key = this.#getEncryptionKey();
    if (!key) return pending;

    return {
      ...pending,
      clientSecret: encrypt(pending.clientSecret, key),
      signingSecret: encrypt(pending.signingSecret, key),
    };
  }

  /**
   * Decrypt secrets from a pending installation after loading.
   */
  #decryptPendingInstallation(pending: SlackPendingInstallation): SlackPendingInstallation {
    const key = this.#getEncryptionKey();
    if (!key) return pending;

    return {
      ...pending,
      clientSecret: decrypt(pending.clientSecret, key),
      signingSecret: decrypt(pending.signingSecret, key),
    };
  }

  /**
   * Encrypt secrets in an installation before storage.
   */
  #encryptInstallation(installation: SlackInstallation): SlackInstallation {
    const key = this.#getEncryptionKey();
    if (!key) return installation;

    return {
      ...installation,
      clientSecret: encrypt(installation.clientSecret, key),
      signingSecret: encrypt(installation.signingSecret, key),
      botToken: encrypt(installation.botToken, key),
    };
  }

  /**
   * Decrypt secrets from an installation after loading.
   */
  #decryptInstallation(installation: SlackInstallation): SlackInstallation {
    const key = this.#getEncryptionKey();
    if (!key) return installation;

    return {
      ...installation,
      clientSecret: decrypt(installation.clientSecret, key),
      signingSecret: decrypt(installation.signingSecret, key),
      botToken: decrypt(installation.botToken, key),
    };
  }

  /**
   * Encrypt config tokens before storage.
   */
  #encryptConfigTokens(tokens: SlackConfigTokens): SlackConfigTokens {
    const key = this.#getEncryptionKey();
    if (!key) return tokens;

    return {
      ...tokens,
      token: tokens.token ? encrypt(tokens.token, key) : undefined,
      refreshToken: encrypt(tokens.refreshToken, key),
    };
  }

  /**
   * Decrypt config tokens after loading.
   */
  #decryptConfigTokens(tokens: SlackConfigTokens): SlackConfigTokens {
    const key = this.#getEncryptionKey();
    if (!key) return tokens;

    return {
      ...tokens,
      token: tokens.token ? decrypt(tokens.token, key) : undefined,
      refreshToken: decrypt(tokens.refreshToken, key),
    };
  }

  /**
   * Get storage, resolving to Mastra's channels storage if available.
   * This is called lazily to ensure we use persistent storage when Mastra is attached.
   */
  #storagePromise: Promise<ChannelsStorage> | null = null;

  async #getStorage(): Promise<ChannelsStorage> {
    // Already resolved
    if (this.#storageResolved) {
      return this.#storage;
    }

    // Deduplicate concurrent resolution attempts
    if (this.#storagePromise) {
      return this.#storagePromise;
    }

    this.#storagePromise = this.#resolveStorage();
    try {
      return await this.#storagePromise;
    } finally {
      this.#storagePromise = null;
    }
  }

  async #resolveStorage(): Promise<ChannelsStorage> {
    // Try to get Mastra's channels storage
    if (this.#mastra) {
      try {
        const store = this.#mastra.getStorage?.();
        if (store) {
          // Ensure storage is initialized (creates tables if needed)
          await store.init();

          const channelsStorage = (await store.getStore('channels')) as ChannelsStorage | undefined;
          if (channelsStorage) {
            this.#storage = channelsStorage;
            this.#storageResolved = true;
            return this.#storage;
          }
        }
      } catch (err) {
        throw new Error(
          '[Slack] Failed to resolve Mastra storage. Ensure your Mastra instance has storage configured (e.g. LibSQLStore or PostgresStore).',
          { cause: err },
        );
      }
    }

    throw new Error(
      '[Slack] No storage available. SlackProvider requires persistent storage — configure a storage backend on your Mastra instance.',
    );
  }

  // ===========================================================================
  // Storage Helpers - Parse/serialize between ChannelInstallation and typed Slack data
  // ===========================================================================

  /**
   * Parse a ChannelInstallation record into a typed SlackInstallation.
   */
  #parseInstallation(record: ChannelInstallation): SlackInstallation {
    const data = SlackInstallationDataSchema.parse(record.data);
    return {
      id: record.id,
      agentId: record.agentId,
      webhookId: record.webhookId ?? '',
      configHash: record.configHash ?? '',
      installedAt: record.createdAt,
      ...data,
    };
  }

  /**
   * Parse a ChannelInstallation record (status='pending') into a typed SlackPendingInstallation.
   */
  #parsePendingInstallation(record: ChannelInstallation): SlackPendingInstallation {
    const data = SlackPendingDataSchema.parse(record.data);
    return {
      id: record.id,
      agentId: record.agentId,
      webhookId: record.webhookId ?? '',
      configHash: record.configHash ?? '',
      createdAt: record.createdAt,
      ...data,
    };
  }

  /**
   * Get an active installation for an agent.
   */
  async #getInstallation(agentId: string): Promise<SlackInstallation | null> {
    const storage = await this.#getStorage();
    const record = await storage.getInstallationByAgent(PLATFORM, agentId);
    if (!record || record.status !== 'active') return null;
    return this.#parseInstallation(record);
  }

  /**
   * Get an installation by webhook ID.
   */
  async #getInstallationByWebhookId(webhookId: string): Promise<SlackInstallation | null> {
    const storage = await this.#getStorage();
    const record = await storage.getInstallationByWebhookId(webhookId);
    if (!record || record.platform !== PLATFORM || record.status !== 'active') return null;
    return this.#parseInstallation(record);
  }

  /**
   * Save an active installation.
   */
  async #saveInstallation(installation: SlackInstallation): Promise<void> {
    const storage = await this.#getStorage();
    await storage.saveInstallation({
      id: installation.id,
      platform: PLATFORM,
      agentId: installation.agentId,
      status: 'active',
      webhookId: installation.webhookId,
      configHash: installation.configHash,
      data: {
        appId: installation.appId,
        clientId: installation.clientId,
        clientSecret: installation.clientSecret,
        signingSecret: installation.signingSecret,
        teamId: installation.teamId,
        teamName: installation.teamName,
        botToken: installation.botToken,
        botUserId: installation.botUserId,
        name: installation.name,
        description: installation.description,
        slashCommands: installation.slashCommands,
      },
      createdAt: installation.installedAt,
      updatedAt: new Date(),
    });
  }

  /**
   * List all active installations.
   */
  async #listInstallations(): Promise<SlackInstallation[]> {
    const storage = await this.#getStorage();
    const records = await storage.listInstallations(PLATFORM);
    return records.filter(r => r.status === 'active').map(r => this.#parseInstallation(r));
  }

  /**
   * Get a pending installation by ID (used for OAuth state lookup).
   */
  async #getPendingInstallationById(id: string): Promise<SlackPendingInstallation | null> {
    const storage = await this.#getStorage();
    const record = await storage.getInstallation(id);
    if (!record || record.status !== 'pending') return null;
    return this.#parsePendingInstallation(record);
  }

  /**
   * Save a pending installation.
   */
  async #savePendingInstallation(pending: SlackPendingInstallation): Promise<void> {
    const storage = await this.#getStorage();
    await storage.saveInstallation({
      id: pending.id,
      platform: PLATFORM,
      agentId: pending.agentId,
      status: 'pending',
      webhookId: pending.webhookId,
      configHash: pending.configHash,
      data: {
        appId: pending.appId,
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
        signingSecret: pending.signingSecret,
        authorizationUrl: pending.authorizationUrl,
        name: pending.name,
        description: pending.description,
        slashCommands: pending.slashCommands,
        redirectUrl: pending.redirectUrl,
      },
      createdAt: pending.createdAt,
      updatedAt: new Date(),
    });
  }

  /**
   * Save config tokens.
   */
  async #saveConfigTokens(tokens: SlackConfigTokens): Promise<void> {
    const storage = await this.#getStorage();
    await storage.saveConfig({
      platform: PLATFORM,
      data: {
        token: tokens.token,
        refreshToken: tokens.refreshToken,
      },
      updatedAt: tokens.updatedAt,
    });
  }

  /**
   * Delete stored config tokens.
   */
  async #deleteConfigTokens(): Promise<void> {
    const storage = await this.#getStorage();
    await storage.deleteConfig(PLATFORM);
  }

  /**
   * Get config tokens.
   */
  async #getConfigTokens(): Promise<SlackConfigTokens | null> {
    const storage = await this.#getStorage();
    const config = await storage.getConfig(PLATFORM);
    if (!config) return null;
    const data = SlackConfigDataSchema.parse(config.data);
    return {
      ...data,
      updatedAt: config.updatedAt,
    };
  }

  /**
   * Delete an installation by ID.
   */
  async #deleteInstallation(id: string): Promise<void> {
    const storage = await this.#getStorage();
    await storage.deleteInstallation(id);
  }

  // ===========================================================================
  // Base URL
  // ===========================================================================

  /**
   * Get the base URL for webhook callbacks.
   * Prefers explicit config, then derives from Mastra server config.
   */
  #getBaseUrl(): string | undefined {
    // Explicit config takes precedence
    if (this.#baseUrl) {
      return this.#baseUrl;
    }

    // Derive from Mastra server config + environment
    // process.env.PORT is set by the CLI with the actual resolved port
    // (e.g. 4112 if 4111 was taken), so it's more reliable than server config
    const server = this.#mastra?.getServer();
    const protocol = server?.studioProtocol ?? 'http';
    const host = server?.studioHost ?? server?.host ?? process.env.MASTRA_HOST ?? 'localhost';
    const port = server?.studioPort ?? server?.port ?? (Number(process.env.PORT) || 4111);

    // Don't include port for standard ports
    const includePort = !((protocol === 'https' && port === 443) || (protocol === 'http' && port === 80));

    return includePort ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
  }

  /**
   * Set the base URL for webhook callbacks.
   * Only needed if not using Mastra server config.
   */
  setBaseUrl(baseUrl: string): void {
    this.#baseUrl = baseUrl;
  }

  /**
   * Restore active Slack installations from storage.
   *
   * For each active installation in the database, this creates a SlackAdapter
   * and injects AgentChannels into the corresponding Agent so it can receive
   * Slack events immediately on startup.
   *
   * Does NOT auto-provision new apps. Use `connect(agentId, options)` to
   * create a new Slack app for an agent.
   */
  async initialize(): Promise<void> {
    if (!this.#mastra) {
      throw new Error('SlackProvider not attached to Mastra. Call __attach() first.');
    }

    // Concurrent callers share the same in-flight initialization
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = this.#doInitialize();

    try {
      await this.#initPromise;
    } catch (err) {
      // Allow retry on failure
      this.#initPromise = null;
      throw err;
    }
  }

  async #doInitialize(): Promise<void> {
    // Load stored tokens if available (these are fresher than constructor tokens)
    const storedTokensEncrypted = await this.#getConfigTokens();
    if (storedTokensEncrypted) {
      const storedTokens = this.#decryptConfigTokens(storedTokensEncrypted);
      console.log(`[Slack] Using stored config tokens (updated ${storedTokens.updatedAt.toISOString()})`);
      if (this.#manifestClient) {
        this.#manifestClient.setTokens({
          token: storedTokens.token ?? '',
          refreshToken: storedTokens.refreshToken,
        });
      } else {
        // No constructor credentials — bootstrap from storage
        this.#initManifestClient(storedTokens.token ?? '', storedTokens.refreshToken);
      }
    }

    // Restore all active installations from storage
    const baseUrl = this.#getBaseUrl();
    const allInstallations = await this.#listInstallations();
    for (const installationEncrypted of allInstallations) {
      try {
        const installation = this.#decryptInstallation(installationEncrypted);
        await this.#activateAdapter(installation);

        // Check if the agent config has changed since last connect
        if (baseUrl) {
          await this.#checkConfigDrift(installation, baseUrl);
        }

        console.log(
          `[Slack] ✓ Agent "${installation.agentId}" connected to workspace "${installation.teamName ?? installation.teamId}"`,
        );
      } catch (err) {
        console.error(`[Slack] Failed to restore installation "${installationEncrypted.id}":`, err);
      }
    }
  }

  /**
   * Activate a SlackAdapter for an installation.
   * Creates and injects AgentChannels into the Agent if needed.
   */
  async #activateAdapter(installation: SlackInstallation): Promise<void> {
    // Resolve display name: override > agent name > agentId
    const agent = this.#mastra?.getAgentById(installation.agentId);
    const displayName = installation.name || agent?.name || installation.agentId;

    const adapter = createSlackAdapter({
      botToken: installation.botToken,
      botUserId: installation.botUserId,
      signingSecret: installation.signingSecret,
      userName: displayName,
    });

    this.#adapters.set(installation.id, adapter);

    // Restore slash commands from installation data
    if (installation.slashCommands?.length) {
      this.#slashCommands.set(installation.webhookId, installation.slashCommands);
    }

    // Create/get AgentChannels and register the adapter
    if (agent && this.#mastra) {
      const agentChannels = this.#createAgentChannels(agent, adapter);
      await agentChannels.initialize(this.#mastra);
    }
  }

  /**
   * Check if the agent's config has drifted from the stored installation hash.
   * If it has, update the Slack app manifest to match the current agent state.
   */
  async #checkConfigDrift(installation: SlackInstallation, baseUrl: string): Promise<void> {
    const agent = this.#mastra?.getAgentById(installation.agentId);
    if (!agent) return;

    // Resolve current values: stored overrides (from connect()) > code-defined > defaults
    const resolvedAppName = installation.name ?? agent.name ?? installation.agentId;
    const resolvedDescription = installation.description || agent.getDescription() || 'AI assistant powered by Mastra';
    const currentHash = hashConfig(
      { slashCommands: installation.slashCommands },
      baseUrl,
      resolvedAppName,
      resolvedDescription,
    );

    if (currentHash === installation.configHash) return;

    console.log(`[Slack] Config drift detected for "${installation.agentId}" — updating manifest...`);

    try {
      const manifest = buildManifest({
        name: resolvedAppName,
        description: resolvedDescription,
        webhookUrl: `${baseUrl}/slack/events/${installation.webhookId}`,
        oauthRedirectUrl: `${baseUrl}/slack/oauth/callback`,
        commandsUrl: `${baseUrl}/slack/commands/${installation.webhookId}`,
        slashCommands: installation.slashCommands?.map(cmd => ({
          command: cmd.command,
          description: cmd.description ?? `Run ${cmd.command}`,
          usageHint: cmd.usageHint,
        })),
      });

      await this.#requireManifestClient().updateApp(installation.appId, manifest);

      // Persist the new hash (keep stored overrides unchanged)
      const updated: SlackInstallation = { ...installation, configHash: currentHash };
      await this.#saveInstallation(this.#encryptInstallation(updated));

      console.log(`[Slack] ✓ Manifest updated for "${installation.agentId}" (app: ${installation.appId})`);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const isAppGone = errMsg.includes('app_not_found') || errMsg.includes('no_permission');

      if (isAppGone) {
        console.warn(
          `[Slack] App ${installation.appId} for "${installation.agentId}" appears deleted from Slack — removing stale installation`,
        );
        // Clean up local state
        this.#adapters.delete(installation.id);
        this.#slashCommands.delete(installation.webhookId);
        await this.#deleteInstallation(installation.id);
      } else {
        console.error(`[Slack] Failed to update manifest for "${installation.agentId}":`, err);
      }
    }
  }

  /**
   * Create AgentChannels for an agent with the Slack adapter.
   * SlackProvider owns the AgentChannels lifecycle for platform-managed agents.
   */
  #createAgentChannels(agent: any, adapter: SlackAdapter): AgentChannels {
    const agentChannels = new AgentChannels({
      adapters: { slack: adapter },
      userName: agent.name,
    });
    agent.setChannels(agentChannels);
    return agentChannels;
  }

  /**
   * Auto-initialize on first route hit.
   * Delegates to initialize() which handles idempotency.
   */
  async #autoInitialize(): Promise<void> {
    if (!this.#mastra) return;
    await this.initialize();
  }

  /**
   * Get API routes for the Mastra server.
   * Add these to your Mastra config via `server.apiRoutes`.
   *
   * The mastra instance is automatically injected via createHandler.
   * On first request, auto-initializes any agents with slack configs.
   */
  getRoutes(): ApiRoute[] {
    const self = this;

    // Helper that sets mastra and runs auto-init once
    const withInit = (handler: (c: ContextWithMastra) => Promise<Response>) => {
      return async ({ mastra }: { mastra: Mastra }) => {
        self.#mastra = mastra;
        await self.#autoInitialize();
        return handler.bind(self);
      };
    };

    return [
      {
        path: '/slack/oauth/callback',
        method: 'GET',
        requiresAuth: false,
        createHandler: withInit(this.#handleOAuthCallback),
      },
      {
        path: '/slack/events/:webhookId',
        method: 'POST',
        requiresAuth: false,
        createHandler: withInit(this.#handleEvent),
      },
      {
        path: '/slack/commands/:webhookId',
        method: 'POST',
        requiresAuth: false,
        createHandler: withInit(this.#handleSlashCommand),
      },
      {
        path: '/slack/connect',
        method: 'POST',
        requiresAuth: true,
        createHandler: withInit(this.#handleConnectRequest),
      },
      {
        path: '/slack/disconnect',
        method: 'POST',
        requiresAuth: true,
        createHandler: withInit(this.#handleDisconnectRequest),
      },
      {
        path: '/slack/installations',
        method: 'GET',
        requiresAuth: true,
        createHandler: withInit(this.#handleListInstallations),
      },
    ];
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Connect an agent to Slack by creating a new Slack app.
   *
   * @returns OAuth connect result with authorization URL for user redirect
   */
  async connect(agentId: string, options?: SlackConnectOptions): Promise<ChannelConnectResult> {
    const client = this.#requireManifestClient();

    const baseUrl = this.#getBaseUrl();
    if (!baseUrl) {
      throw new Error(
        'SlackProvider baseUrl not set. Configure studioHost/studioProtocol/studioPort in Mastra server config, or call setBaseUrl().',
      );
    }

    const agent = this.#resolveAgent(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    // If there's already a pending installation, return its authorization URL
    // instead of creating a duplicate Slack app
    const storage = await this.#getStorage();
    const existingRecord = await storage.getInstallationByAgent(PLATFORM, agentId);
    if (existingRecord?.status === 'pending') {
      try {
        const pending = this.#parsePendingInstallation(existingRecord);
        const decrypted = this.#decryptPendingInstallation(pending);
        // Update redirectUrl if the caller provided one (e.g., different browser tab)
        if (options?.redirectUrl && decrypted.redirectUrl !== options.redirectUrl) {
          await this.#savePendingInstallation(
            this.#encryptPendingInstallation({ ...decrypted, redirectUrl: options.redirectUrl }),
          );
        }
        console.log(`[Slack] Reusing existing pending installation for "${agentId}"`);
        return {
          type: 'oauth' as const,
          installationId: decrypted.id,
          authorizationUrl: decrypted.authorizationUrl,
        };
      } catch {
        // Corrupt pending record — delete it and create a fresh one
        console.warn(`[Slack] Corrupt pending installation for "${agentId}", replacing it`);
        await storage.deleteInstallation(existingRecord.id);
      }
    }

    // If already connected, throw rather than creating a second app
    if (existingRecord?.status === 'active') {
      throw new Error(`Agent "${agentId}" is already connected to Slack. Disconnect first to reconnect.`);
    }

    const config = options ?? {};

    // Generate unique webhook ID for this installation
    const webhookId = crypto.randomUUID();

    // Build manifest using the manifest builder (includes proper default scopes)
    const appName = config.name ?? agent.name ?? agentId;
    const appDescription = config.description || agent.getDescription() || 'AI assistant powered by Mastra';
    const normalizedCommands = this.#normalizeCommands(config.slashCommands);
    let manifest = buildManifest({
      name: appName,
      description: appDescription,
      webhookUrl: `${baseUrl}/slack/events/${webhookId}`,
      oauthRedirectUrl: `${baseUrl}/slack/oauth/callback`,
      commandsUrl: `${baseUrl}/slack/commands/${webhookId}`,
      slashCommands: normalizedCommands.map(cmd => ({
        command: cmd.command,
        description: cmd.description ?? `Run ${cmd.command}`,
        usageHint: cmd.usageHint,
      })),
    });

    // Apply user's manifest transform if provided
    if (config.manifest) {
      manifest = config.manifest(manifest);
    }

    // Create the app via Slack's manifest API
    const appCredentials = await client.createApp(manifest);

    // Set app icon if provided
    if (config.iconUrl) {
      try {
        const iconResponse = await fetch(config.iconUrl, {
          signal: AbortSignal.timeout(30_000),
        });
        if (!iconResponse.ok) {
          throw new Error(`Icon fetch failed: ${iconResponse.status} ${iconResponse.statusText}`);
        }
        const iconData = await iconResponse.arrayBuffer();
        await client.setAppIcon(appCredentials.appId, iconData);
      } catch (error) {
        // Log but don't fail app creation if icon upload fails
        console.warn(`[Slack] Failed to set app icon for "${agentId}":`, error);
      }
    }

    // Generate installation ID
    const installationId = crypto.randomUUID();

    // Build authorization URL using the scopes from the manifest
    const scopes = manifest.oauth_config?.scopes?.bot?.join(',') ?? '';
    const slackBaseUrl =
      appCredentials.oauthAuthorizeUrl ??
      `https://slack.com/oauth/v2/authorize?client_id=${appCredentials.clientId}&scope=${encodeURIComponent(scopes)}`;

    // Append our redirect_uri and state to the URL
    const authUrl = new URL(slackBaseUrl);
    authUrl.searchParams.set('redirect_uri', `${baseUrl}/slack/oauth/callback`);
    authUrl.searchParams.set('state', installationId);
    const authorizationUrl = authUrl.toString();

    // Store pending installation (includes auth URL for UI to fetch later)
    const configHash = hashConfig(config, baseUrl, appName, appDescription);
    const pendingInstallation = this.#encryptPendingInstallation({
      id: installationId,
      agentId,
      webhookId,
      appId: appCredentials.appId,
      clientId: appCredentials.clientId,
      clientSecret: appCredentials.clientSecret,
      signingSecret: appCredentials.signingSecret,
      authorizationUrl,
      name: config.name,
      description: config.description,
      slashCommands: normalizedCommands.length ? normalizedCommands : undefined,
      redirectUrl: config.redirectUrl,
      configHash,
      createdAt: new Date(),
    });
    await this.#savePendingInstallation(pendingInstallation);

    // Store slash command configs for this webhook
    if (normalizedCommands.length) {
      this.#slashCommands.set(webhookId, normalizedCommands);
    }

    return {
      type: 'oauth' as const,
      installationId,
      authorizationUrl,
    };
  }

  /**
   * Disconnect an agent from Slack by deleting its app.
   */
  async disconnect(agentId: string): Promise<void> {
    const client = this.#requireManifestClient();

    const storage = await this.#getStorage();
    const allRecords = await storage.listInstallations(PLATFORM);
    const agentRecords = allRecords.filter(r => r.agentId === agentId);

    if (agentRecords.length === 0) {
      throw new Error(`No Slack installation found for agent "${agentId}"`);
    }

    for (const record of agentRecords) {
      if (record.status === 'active') {
        const installation = this.#decryptInstallation(this.#parseInstallation(record));

        // Delete the app from Slack
        try {
          await client.deleteApp(installation.appId);
        } catch (err) {
          console.warn(`[Slack] Failed to delete Slack app ${installation.appId}:`, err);
        }

        // Remove adapter and command handlers
        this.#adapters.delete(installation.id);
        this.#slashCommands.delete(installation.webhookId);
      }

      // Remove from storage (active, pending, or error)
      await this.#deleteInstallation(record.id);
    }
  }

  /**
   * Get the Slack installation for an agent.
   */
  async getInstallation(agentId: string): Promise<SlackInstallation | null> {
    const installationEncrypted = await this.#getInstallation(agentId);
    return installationEncrypted ? this.#decryptInstallation(installationEncrypted) : null;
  }

  /**
   * List all Slack installations (public info only).
   * Includes both active and pending installations.
   */
  async listInstallations(): Promise<ChannelInstallationInfo[]> {
    const storage = await this.#getStorage();
    const records = await storage.listInstallations(PLATFORM);
    const results: ChannelInstallationInfo[] = [];

    for (const record of records) {
      if (record.status === 'active') {
        const decrypted = this.#decryptInstallation(this.#parseInstallation(record));
        results.push({
          id: decrypted.id,
          platform: PLATFORM,
          agentId: decrypted.agentId,
          status: 'active',
          displayName: decrypted.teamName ?? decrypted.teamId,
          installedAt: decrypted.installedAt,
        });
      } else if (record.status === 'pending') {
        results.push({
          id: record.id,
          platform: PLATFORM,
          agentId: record.agentId,
          status: 'pending',
          installedAt: record.createdAt,
        });
      }
    }

    return results;
  }

  /**
   * Discovery metadata for the editor UI.
   */
  getInfo(): ChannelPlatformInfo {
    return {
      id: PLATFORM,
      name: 'Slack',
      isConfigured: this.isConfigured(),
    };
  }

  /**
   * Check if the provider has credentials and can create/manage Slack apps.
   * Returns false if no refresh token has been provided via constructor, `configure()`, or storage.
   */
  isConfigured(): boolean {
    return !!this.#manifestClient;
  }

  /**
   * Get the manifest client, throwing if the provider isn't configured.
   */
  #requireManifestClient(): SlackManifestClient {
    if (!this.#manifestClient) {
      throw new Error(
        'SlackProvider is not configured. Provide a refreshToken via the constructor or call configure({ refreshToken }) first.\n' +
          'Get your tokens at: https://api.slack.com/apps > "Your App Configuration Tokens"',
      );
    }
    return this.#manifestClient;
  }

  /**
   * Get the SlackAdapter for an installation.
   * Used internally for message formatting and posting.
   */
  getAdapter(installationId: string): SlackAdapter | undefined {
    return this.#adapters.get(installationId);
  }

  // ===========================================================================
  // Route Handlers
  // ===========================================================================

  async #handleConnectRequest(c: ContextWithMastra): Promise<Response> {
    const body = await c.req.json();
    const { agentId, ...options } = body;

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400);
    }

    try {
      const result = await this.connect(agentId, options);
      return c.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect';
      return c.json({ error: message }, 500);
    }
  }

  async #handleDisconnectRequest(c: ContextWithMastra): Promise<Response> {
    const body = await c.req.json();
    const { agentId } = body;

    if (!agentId) {
      return c.json({ error: 'agentId is required' }, 400);
    }

    try {
      await this.disconnect(agentId);
      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to disconnect';
      return c.json({ error: message }, 500);
    }
  }

  async #handleListInstallations(c: ContextWithMastra): Promise<Response> {
    const installations = await this.listInstallations();
    return c.json({ installations });
  }

  async #handleOAuthCallback(c: ContextWithMastra): Promise<Response> {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // installationId
    const error = url.searchParams.get('error');

    if (!state) {
      return c.json({ error: 'Missing state parameter' }, 400);
    }

    const pendingEncrypted = await this.#getPendingInstallationById(state);
    if (!pendingEncrypted) {
      return c.json({ error: 'Invalid or expired installation state' }, 400);
    }

    // Decrypt secrets for use
    const pending = this.#decryptPendingInstallation(pendingEncrypted);

    if (error) {
      const errorUrl = pending.redirectUrl ?? this.#channelConfig.redirectPath ?? '/';
      const redirect = new URL(errorUrl, c.req.url);
      redirect.searchParams.set('channel_error', error);
      redirect.searchParams.set('platform', 'slack');
      return c.redirect(redirect.toString());
    }

    if (!code) {
      return c.json({ error: 'Missing code parameter' }, 400);
    }

    const baseUrl = this.#getBaseUrl();
    if (!baseUrl) {
      throw new Error('SlackProvider baseUrl not available during OAuth callback');
    }

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: pending.clientId,
          client_secret: pending.clientSecret,
          code,
          redirect_uri: `${baseUrl}/slack/oauth/callback`,
        }),
        signal: AbortSignal.timeout(30_000),
      });

      if (!tokenResponse.ok) {
        throw new Error(`Slack OAuth HTTP error: ${tokenResponse.status} ${tokenResponse.statusText}`);
      }

      const tokenData = (await tokenResponse.json()) as {
        ok: boolean;
        error?: string;
        access_token?: string;
        bot_user_id?: string;
        team?: { id: string; name: string };
      };

      if (!tokenData.ok) {
        throw new Error(`OAuth failed: ${tokenData.error}`);
      }

      if (!tokenData.access_token || !tokenData.bot_user_id || !tokenData.team?.id) {
        throw new Error('Slack OAuth response missing required fields (access_token, bot_user_id, or team)');
      }

      // Save completed installation (encrypted)
      const installation: SlackInstallation = {
        id: pending.id,
        agentId: pending.agentId,
        webhookId: pending.webhookId,
        appId: pending.appId,
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
        signingSecret: pending.signingSecret,
        botToken: tokenData.access_token,
        botUserId: tokenData.bot_user_id,
        teamId: tokenData.team.id,
        teamName: tokenData.team.name ?? '',
        name: pending.name,
        description: pending.description,
        slashCommands: pending.slashCommands,
        installedAt: new Date(),
        configHash: pending.configHash,
      };

      const encryptedInstallation = this.#encryptInstallation(installation);
      await this.#saveInstallation(encryptedInstallation);

      // Create SlackAdapter for this installation
      const agent = this.#mastra?.getAgentById(pending.agentId);
      const displayName = installation.name || agent?.name || pending.agentId;
      const adapter = createSlackAdapter({
        botToken: installation.botToken,
        botUserId: installation.botUserId,
        signingSecret: installation.signingSecret,
        userName: displayName,
      });
      this.#adapters.set(installation.id, adapter);

      // Load slash commands into memory
      if (installation.slashCommands?.length) {
        this.#slashCommands.set(installation.webhookId, installation.slashCommands);
      }

      // Notify callback
      if (this.#channelConfig.onInstall) {
        await this.#channelConfig.onInstall(installation);
      }

      const teamName = tokenData.team?.name ?? '';
      console.log(`[Slack] ✓ Agent "${pending.agentId}" installed to team "${teamName}"`);

      // Redirect back to the page the user came from, or the configured redirect path
      const successUrl = pending.redirectUrl ?? this.#channelConfig.redirectPath ?? '/';
      const redirect = new URL(successUrl, c.req.url);
      redirect.searchParams.set('channel_connected', 'true');
      redirect.searchParams.set('platform', 'slack');
      redirect.searchParams.set('agent', pending.agentId);
      redirect.searchParams.set('team', teamName);
      return c.redirect(redirect.toString());
    } catch (error) {
      console.error('[Slack] OAuth callback error:', error);
      const message = error instanceof Error ? error.message : 'OAuth failed';
      const errorUrl = pending.redirectUrl ?? this.#channelConfig.redirectPath ?? '/';
      const redirect = new URL(errorUrl, c.req.url);
      redirect.searchParams.set('channel_error', message);
      redirect.searchParams.set('platform', 'slack');
      return c.redirect(redirect.toString());
    }
  }

  async #handleEvent(c: ContextWithMastra): Promise<Response> {
    const webhookId = c.req.param('webhookId');
    if (!webhookId) {
      return c.json({ error: 'Missing webhookId' }, 400);
    }

    const installationEncrypted = await this.#getInstallationByWebhookId(webhookId);
    if (!installationEncrypted) {
      return c.json({ error: 'Unknown webhook' }, 404);
    }
    const installation = this.#decryptInstallation(installationEncrypted);

    const rawBody = await c.req.text();

    // Verify signature
    const timestamp = c.req.header('x-slack-request-timestamp');
    const signature = c.req.header('x-slack-signature');

    if (!timestamp || !signature) {
      return c.json({ error: 'Missing signature headers' }, 401);
    }

    const isValid = verifySlackRequest({
      signingSecret: installation.signingSecret,
      timestamp,
      body: rawBody,
      signature,
    });

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    let event: Record<string, unknown>;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return c.json({ error: 'Malformed JSON body' }, 400);
    }

    // Handle URL verification challenge
    if (event.type === 'url_verification') {
      return c.json({ challenge: event.challenge });
    }

    // Resolve agent and delegate to AgentChannels
    const agent = this.#resolveAgent(installation.agentId);
    if (!agent) {
      console.error(`[Slack] Agent "${installation.agentId}" not found`);
      return c.json({ ok: true });
    }

    if (!this.#mastra) {
      console.error('[Slack] Mastra not attached');
      return c.json({ ok: true });
    }

    // Resolve the current adapter for this installation
    const displayName = installation.name || agent.name || installation.agentId;
    const currentAdapter =
      this.#adapters.get(installation.id) ??
      createSlackAdapter({
        botToken: installation.botToken,
        botUserId: installation.botUserId,
        signingSecret: installation.signingSecret,
        userName: displayName,
      });

    // Reuse existing AgentChannels if it has the same adapter (e.g., from startup activation).
    // Replace it if the adapter changed (disconnect + reconnect creates a new one).
    let agentChannels = agent.getChannels();
    if (!agentChannels || agentChannels.adapters.slack !== currentAdapter) {
      agentChannels = this.#createAgentChannels(agent, currentAdapter);
      await agentChannels.initialize(this.#mastra);
    }

    // Delegate event handling to AgentChannels
    // Reconstruct the request with the raw body we already read
    const delegateRequest = new Request(c.req.url, {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: rawBody,
    });

    try {
      return await agentChannels.handleWebhookEvent('slack', delegateRequest);
    } catch (error) {
      console.error('[Slack] Error delegating to AgentChannels:', error);
      return c.json({ ok: true });
    }
  }

  async #handleSlashCommand(c: ContextWithMastra): Promise<Response> {
    const webhookId = c.req.param('webhookId');
    if (!webhookId) {
      return c.json({ error: 'Missing webhookId' }, 400);
    }

    const installationEncrypted = await this.#getInstallationByWebhookId(webhookId);
    if (!installationEncrypted) {
      return c.json({ error: 'Unknown webhook' }, 404);
    }
    const installation = this.#decryptInstallation(installationEncrypted);

    const rawBody = await c.req.text();

    const timestamp = c.req.header('x-slack-request-timestamp');
    const signature = c.req.header('x-slack-signature');

    if (!timestamp || !signature) {
      return c.json({ error: 'Missing signature headers' }, 401);
    }

    const isValid = verifySlackRequest({
      signingSecret: installation.signingSecret,
      timestamp,
      body: rawBody,
      signature,
    });

    if (!isValid) {
      return c.json({ error: 'Invalid signature' }, 401);
    }

    const params = parseSlackFormBody(rawBody);
    const command = params.command;

    const commands = this.#slashCommands.get(webhookId);
    const commandConfig = commands?.find(cmd => cmd.command === command);

    if (!commandConfig) {
      return c.json({ response_type: 'ephemeral', text: `Unknown command: ${command}` });
    }

    const agent = this.#resolveAgent(installation.agentId);
    if (!agent) {
      return c.json({ response_type: 'ephemeral', text: 'Agent not available' });
    }

    const responseUrl = params.response_url ?? '';
    const userText = params.text ?? '';

    // Build prompt from template (replace {{text}} with user input)
    const prompt = (commandConfig.prompt ?? '{{text}}').replace(/\{\{text\}\}/g, userText);

    // Acknowledge immediately, then process async
    // Slack requires a response within 3 seconds
    const sendDelayedResponse = async (message: string) => {
      if (!responseUrl) return;
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_type: 'in_channel', text: message }),
        signal: AbortSignal.timeout(30_000),
      });
    };

    // Process in background
    (async () => {
      try {
        const result = await agent.generate(prompt);
        const text = typeof result.text === 'string' ? result.text : JSON.stringify(result.text);
        await sendDelayedResponse(text);
      } catch (error) {
        console.error('[Slack] Command error:', error);
        const message = error instanceof Error ? error.message : 'Command failed';
        await sendDelayedResponse(`Error: ${message}`);
      }
    })();

    // Return immediate acknowledgment
    return c.json({ response_type: 'ephemeral', text: 'Processing...' });
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  #resolveAgent(agentId: string) {
    try {
      return this.#mastra?.getAgentById(agentId);
    } catch {
      // Agent not found - return undefined
      return undefined;
    }
  }
}
