import * as crypto from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { type MastraChannel, AgentChannels } from '@mastra/core/channels';
import { type ChannelsStorage, type ChannelInstallation, InMemoryChannelsStorage } from '@mastra/core/storage';
import type { Context } from 'hono';
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
} from './schemas';
import type { SlackChannelConfig, SlashCommandConfig, SlackRoute, SlackAgentConfig } from './types';

const PLATFORM = 'slack';

/**
 * Create a hash of the agent config for change detection.
 * Uses the resolved app name (config.name ?? agentName) to detect renames.
 */
function hashConfig(config: SlackAgentConfig, baseUrl: string, resolvedAppName: string): string {
  const normalized = JSON.stringify({
    name: resolvedAppName,
    description: config.description,
    slashCommands: config.slashCommands,
    respondToMentions: config.respondToMentions,
    respondToDirectMessages: config.respondToDirectMessages,
    baseUrl,
  });
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

/**
 * Slack channel integration for Mastra.
 *
 * Handles:
 * - Programmatic Slack app creation via manifest API
 * - OAuth flow for workspace installations
 * - Webhook routing for events and slash commands
 * - Message handling via @chat-adapter/slack
 *
 * @example
 * ```ts
 * import { SlackChannel } from '@mastra/slack';
 *
 * const slack = new SlackChannel({
 *   configToken: process.env.SLACK_CONFIG_TOKEN,
 *   refreshToken: process.env.SLACK_CONFIG_REFRESH_TOKEN,
 *   baseUrl: process.env.SLACK_BASE_URL,
 * });
 *
 * slack.configure(myAgent, {
 *   name: 'My Bot',
 *   slashCommands: ['/ask', '/help'],
 * });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent },
 *   channels: { slack },
 * });
 * ```
 */
export class SlackChannel implements MastraChannel<SlackAgentConfig> {
  readonly id = 'slack';
  readonly #channelConfig: SlackChannelConfig;
  #storage!: ChannelsStorage;
  #storageResolved = false;
  readonly #manifestClient: SlackManifestClient;

  /** Agent-specific configurations (set via slack.config() on Agent.channels) */
  readonly #agentConfigs = new Map<string, SlackAgentConfig>();

  /** Slash command configs keyed by webhookId */
  readonly #slashCommands = new Map<string, SlashCommandConfig[]>();

  /** SlackAdapter instances keyed by installation ID */
  readonly #adapters = new Map<string, SlackAdapter>();

  #mastra?: Mastra;
  #baseUrl?: string;
  #initialized = false;

  constructor(config: SlackChannelConfig) {
    // At minimum we need a refresh token to rotate and get fresh tokens
    if (!config.refreshToken) {
      throw new Error('SlackChannel requires refreshToken. Get one at https://api.slack.com/apps');
    }

    this.#channelConfig = config;
    // Storage will be resolved lazily via #getStorage() to use Mastra's storage if available
    this.#baseUrl = config.baseUrl; // Optional at construction, required for connect()

    // Create manifest client with storage-backed token rotation
    // configToken can be empty - we'll rotate on first use to get a fresh one
    this.#manifestClient = new SlackManifestClient({
      configToken: config.configToken ?? '',
      refreshToken: config.refreshToken,
      onTokenRotation: async (tokens) => {
        // Persist rotated tokens to storage (encrypted)
        await this.#saveConfigTokens(
          this.#encryptConfigTokens({
            configToken: tokens.configToken,
            refreshToken: tokens.refreshToken,
            updatedAt: new Date(),
          }),
        );
        // Also call user's callback if provided
        if (config.onTokenRotation) {
          await config.onTokenRotation(tokens);
        }
      },
    });
  }

  /**
   * Normalize slash command config (string -> full config object).
   */
  #normalizeCommand(cmd: string | SlashCommandConfig): SlashCommandConfig {
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
  #normalizeCommands(commands?: (string | SlashCommandConfig)[]): SlashCommandConfig[] {
    return (commands ?? []).map((cmd) => this.#normalizeCommand(cmd));
  }

  // ===========================================================================
  // Agent Configuration
  // ===========================================================================

  /**
   * Register agent configuration (called by Mastra when agent is added).
   * Supports both `channels: { slack: true }` (use defaults) and full config.
   * @internal
   */
  __registerAgent(agentId: string, config: SlackAgentConfig | boolean): void {
    // Skip if explicitly disabled
    if (config === false) return;
    // Normalize `true` to an empty config (use defaults)
    const normalizedConfig: SlackAgentConfig = config === true ? {} : config;
    this.#agentConfigs.set(agentId, normalizedConfig);
  }

  /**
   * Get configuration for an agent.
   */
  getAgentConfig(agentId: string): SlackAgentConfig | undefined {
    return this.#agentConfigs.get(agentId);
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
      this.#initialized = false;
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

    // Check if already decrypted (no colons = not encrypted format)
    if (!pending.clientSecret.includes(':')) return pending;

    try {
      return {
        ...pending,
        clientSecret: decrypt(pending.clientSecret, key),
        signingSecret: decrypt(pending.signingSecret, key),
      };
    } catch {
      console.warn('[Slack] Failed to decrypt pending installation - may be stored unencrypted');
      return pending;
    }
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
      configToken: encrypt(tokens.configToken, key),
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
      configToken: decrypt(tokens.configToken, key),
      refreshToken: decrypt(tokens.refreshToken, key),
    };
  }

  /**
   * Get storage, resolving to Mastra's channels storage if available.
   * This is called lazily to ensure we use persistent storage when Mastra is attached.
   */
  async #getStorage(): Promise<ChannelsStorage> {
    // Already resolved
    if (this.#storageResolved) {
      return this.#storage;
    }

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
        console.warn('[Slack] Mastra storage not available, using in-memory (data will not persist)', err);
      }
    }

    // Fall back to in-memory
    if (!this.#storage) {
      console.warn('[Slack] No persistent storage available, using in-memory (data will not persist across restarts)');
      this.#storage = new InMemoryChannelsStorage();
    }
    this.#storageResolved = true;
    return this.#storage;
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
    return records
      .filter((r) => r.status === 'active')
      .map((r) => this.#parseInstallation(r));
  }

  /**
   * Get a pending installation for an agent.
   */
  async #getPendingInstallation(agentId: string): Promise<SlackPendingInstallation | null> {
    const storage = await this.#getStorage();
    const record = await storage.getInstallationByAgent(PLATFORM, agentId);
    if (!record || record.status !== 'pending') return null;
    return this.#parsePendingInstallation(record);
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
        configToken: tokens.configToken,
        refreshToken: tokens.refreshToken,
      },
      updatedAt: tokens.updatedAt,
    });
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

    // Try to derive from Mastra server config
    if (this.#mastra) {
      const server = this.#mastra.getServer();
      if (server) {
        const protocol = server.studioProtocol ?? 'http';
        const host = server.studioHost ?? server.host ?? 'localhost';
        const port = server.studioPort ?? server.port ?? 4111;

        // Don't include port for standard ports
        const includePort = !(
          (protocol === 'https' && port === 443) ||
          (protocol === 'http' && port === 80)
        );

        return includePort ? `${protocol}://${host}:${port}` : `${protocol}://${host}`;
      }
    }

    return undefined;
  }

  /**
   * Set the base URL for webhook callbacks.
   * Only needed if not using Mastra server config.
   */
  setBaseUrl(baseUrl: string): void {
    this.#baseUrl = baseUrl;
  }

  /**
   * Initialize all configured agents.
   * 
   * For each agent with Slack config:
   * - If already installed: activate the adapter
   * - If not installed: create the app and log the install URL
   * 
   * Call this after Mastra is fully initialized.
   */
  async initialize(): Promise<void> {

    
    if (!this.#mastra) {
      throw new Error('SlackChannel not attached to Mastra. Call setMastra() first.');
    }

    // Prevent double initialization
    if (this.#initialized) {

      return;
    }
    this.#initialized = true;

    // Load stored tokens if available (these are fresher than .env tokens)
    const storedTokensEncrypted = await this.#getConfigTokens();
    if (storedTokensEncrypted) {
      const storedTokens = this.#decryptConfigTokens(storedTokensEncrypted);
      console.log(`[Slack] Using stored config tokens (updated ${storedTokens.updatedAt.toISOString()})`);
      this.#manifestClient.setTokens({
        configToken: storedTokens.configToken,
        refreshToken: storedTokens.refreshToken,
      });
    }

    const baseUrl = this.#getBaseUrl();
    if (!baseUrl) {
      console.warn('[Slack] Cannot initialize: baseUrl not configured. Set SLACK_BASE_URL or configure server.studioHost.');
      return;
    }

    for (const [agentId, config] of this.#agentConfigs) {
      try {
        // Resolve the app name from config or agent
        const agent = this.#resolveAgent(agentId);
        const resolvedAppName = config.name ?? agent?.name ?? agentId;
        const currentHash = hashConfig(config, baseUrl, resolvedAppName);

        // Check if already installed
        const installationEncrypted = await this.#getInstallation(agentId);
        if (installationEncrypted) {
          const installation = this.#decryptInstallation(installationEncrypted);
          // Check if config changed - need to update manifest
          if (installation.configHash !== currentHash) {
            console.log(`[Slack] Config changed for "${agentId}", updating manifest...`);
            await this.#updateAppManifest(installation, config, baseUrl);
            installation.configHash = currentHash;
            await this.#saveInstallation(this.#encryptInstallation(installation));
          }
          // Activate adapter
          await this.#activateAdapter(installation);
          console.log(`[Slack] ✓ Agent "${agentId}" connected to workspace "${installation.teamName ?? installation.teamId}"`);
          continue;
        }

        // Check if there's already a pending installation
        const existingPendingEncrypted = await this.#getPendingInstallation(agentId);
        if (existingPendingEncrypted) {
          const existingPending = this.#decryptPendingInstallation(existingPendingEncrypted);
          // If config/baseUrl changed, need to recreate the app
          if (existingPending.configHash !== currentHash) {
            console.log(`[Slack] Config changed for pending "${agentId}", recreating app...`);
            try {
              await this.#manifestClient.deleteApp(existingPending.appId);
            } catch {
              // App may not exist anymore, ignore
            }
            await this.#deleteInstallation(existingPending.id);
          } else {
            // Reuse existing pending installation
            console.log(`[Slack] Agent "${agentId}" - Install to workspace by clicking this link:`);
            console.log(`        ${existingPending.authorizationUrl}`);
            continue;
          }
        }

        // Create new app
        if (!this.#manifestClient) {
          console.log(`[Slack] Agent "${agentId}" has Slack config but no configToken provided for auto-setup.`);
          continue;
        }

        const result = await this.connect(agentId);
        console.log(`[Slack] Agent "${agentId}" - Install to workspace by clicking this link:`);
        console.log(`        ${result.authorizationUrl}`);
      } catch (err) {
        console.error(`[Slack] Failed to initialize agent "${agentId}":`, err);
      }
    }
  }

  /**
   * Activate a SlackAdapter for an installation.
   * Creates and injects AgentChannels into the Agent if needed.
   */
  async #activateAdapter(installation: SlackInstallation): Promise<void> {
    const adapter = createSlackAdapter({
      botToken: installation.botToken,
      botUserId: installation.botUserId,
      signingSecret: installation.signingSecret,
    });
    
    this.#adapters.set(installation.id, adapter);
    
    // Store slash commands for this webhook
    const config = this.#agentConfigs.get(installation.agentId);
    if (config?.slashCommands?.length) {
      this.#slashCommands.set(installation.webhookId, this.#normalizeCommands(config.slashCommands));
    }

    // Create/get AgentChannels and register the adapter
    const agent = this.#mastra?.getAgentById(installation.agentId);
    if (agent && this.#mastra) {
      const agentChannels = this.#getOrCreateAgentChannels(agent, adapter);
      await agentChannels.initialize(this.#mastra);
    }
  }

  /**
   * Get or create AgentChannels for an agent.
   * SlackChannel owns the AgentChannels lifecycle for platform-managed agents.
   */
  #getOrCreateAgentChannels(agent: any, adapter: SlackAdapter): AgentChannels {
    let agentChannels = agent.agentChannels as AgentChannels | null;
    
    if (!agentChannels) {
      // Create AgentChannels with Slack adapter
      agentChannels = new AgentChannels({
        adapters: { slack: adapter },
        userName: agent.name,
      });
      // Inject into the agent
      agent.setAgentChannels(agentChannels);
    } else if (!agentChannels.hasAdapter('slack')) {
      // AgentChannels exists but doesn't have slack adapter
      agentChannels.__registerAdapter('slack', adapter, { adapter }, { managesRoutes: true });
    }
    
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
   * Update an existing app's manifest (e.g., when config changes).
   */
  async #updateAppManifest(installation: SlackInstallation, config: SlackAgentConfig, baseUrl: string): Promise<void> {
    if (!this.#manifestClient) return;

    const agent = this.#resolveAgent(installation.agentId);
    const appName = config.name ?? agent?.name ?? installation.agentId;
    const normalizedCommands = this.#normalizeCommands(config.slashCommands);

    const manifest = buildManifest({
      name: appName,
      description: config.description ?? `AI assistant powered by ${appName}`,
      webhookUrl: `${baseUrl}/slack/events/${installation.webhookId}`,
      oauthRedirectUrl: `${baseUrl}/slack/oauth/callback`,
      commandsUrl: `${baseUrl}/slack/commands/${installation.webhookId}`,
      slashCommands: normalizedCommands.map((cmd) => ({
        command: cmd.command,
        description: cmd.description ?? `Run ${cmd.command}`,
        usageHint: cmd.usageHint,
      })),
      additionalScopes: config.additionalScopes,
      additionalEvents: config.additionalEvents,
      interactivity: true,
    });

    await this.#manifestClient.updateApp(installation.appId, manifest);
  }

  /**
   * Get API routes for the Mastra server.
   * Add these to your Mastra config via `server.apiRoutes`.
   * 
   * The mastra instance is automatically injected via createHandler.
   * On first request, auto-initializes any agents with slack configs.
   */
  getRoutes(): SlackRoute[] {
    const self = this;

    // Helper that sets mastra and runs auto-init once
    const withInit = (handler: (c: Context) => Promise<Response>) => {
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
   * @returns Authorization URL for the user to install the app
   */
  async connect(
    agentId: string,
    options?: SlackAgentConfig,
  ): Promise<{ appId: string; installationId: string; authorizationUrl: string }> {
    if (!this.#manifestClient) {
      throw new Error('Slack manifest client not configured. Provide configToken and refreshToken.');
    }

    const baseUrl = this.#getBaseUrl();
    if (!baseUrl) {
      throw new Error(
        'SlackChannel baseUrl not set. Configure studioHost/studioProtocol/studioPort in Mastra server config, or call setBaseUrl().',
      );
    }

    const agent = this.#resolveAgent(agentId);
    if (!agent) {
      throw new Error(`Agent "${agentId}" not found`);
    }

    // Merge pre-configured settings with runtime options
    const preConfig = this.#agentConfigs.get(agentId);
    const config: SlackAgentConfig = {
      ...preConfig,
      ...options,
      slashCommands: [...(preConfig?.slashCommands ?? []), ...(options?.slashCommands ?? [])],
      additionalScopes: [...(preConfig?.additionalScopes ?? []), ...(options?.additionalScopes ?? [])],
      additionalEvents: [...(preConfig?.additionalEvents ?? []), ...(options?.additionalEvents ?? [])],
    };

    // Generate unique webhook ID for this installation
    const webhookId = crypto.randomUUID();

    // Build manifest using the manifest builder (includes proper default scopes)
    const appName = config.name ?? agent.name ?? agentId;
    const normalizedCommands = this.#normalizeCommands(config.slashCommands);
    const manifest = buildManifest({
      name: appName,
      description: config.description ?? `AI assistant powered by ${agent.name ?? agentId}`,
      webhookUrl: `${baseUrl}/slack/events/${webhookId}`,
      oauthRedirectUrl: `${baseUrl}/slack/oauth/callback`,
      commandsUrl: `${baseUrl}/slack/commands/${webhookId}`,
      slashCommands: normalizedCommands.map((cmd) => ({
        command: cmd.command,
        description: cmd.description ?? `Run ${cmd.command}`,
        usageHint: cmd.usageHint,
      })),
      additionalScopes: config.additionalScopes,
      additionalEvents: config.additionalEvents,
      interactivity: true,
    });

    // Create the app via Slack's manifest API
    const appCredentials = await this.#manifestClient.createApp(manifest);

    // Set app icon if provided
    if (config.iconUrl) {
      try {
        await this.#manifestClient.setAppIcon(appCredentials.appId, config.iconUrl);
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
    const configHash = hashConfig(config, baseUrl, appName);
    const pendingInstallation = this.#encryptPendingInstallation({
      id: installationId,
      agentId,
      webhookId,
      appId: appCredentials.appId,
      clientId: appCredentials.clientId,
      clientSecret: appCredentials.clientSecret,
      signingSecret: appCredentials.signingSecret,
      authorizationUrl,
      configHash,
      createdAt: new Date(),
    });
    await this.#savePendingInstallation(pendingInstallation);

    // Store slash command configs for this webhook
    if (normalizedCommands.length) {
      this.#slashCommands.set(webhookId, normalizedCommands);
    }

    return {
      appId: appCredentials.appId,
      installationId,
      authorizationUrl,
    };
  }

  /**
   * Disconnect an agent from Slack by deleting its app.
   */
  async disconnect(agentId: string): Promise<void> {
    if (!this.#manifestClient) {
      throw new Error('Slack manifest client not configured.');
    }

    const installationEncrypted = await this.#getInstallation(agentId);
    if (!installationEncrypted) {
      throw new Error(`No Slack installation found for agent "${agentId}"`);
    }
    const installation = this.#decryptInstallation(installationEncrypted);

    // Delete the app from Slack
    await this.#manifestClient.deleteApp(installation.appId);

    // Remove adapter
    this.#adapters.delete(installation.id);

    // Remove from storage
    await this.#deleteInstallation(installation.id);

    // Clean up command handlers
    this.#slashCommands.delete(installation.webhookId);
  }

  /**
   * Get the Slack installation for an agent.
   */
  async getInstallation(agentId: string): Promise<SlackInstallation | null> {
    const installationEncrypted = await this.#getInstallation(agentId);
    return installationEncrypted ? this.#decryptInstallation(installationEncrypted) : null;
  }

  /**
   * List all Slack installations.
   */
  async listInstallations(): Promise<SlackInstallation[]> {
    const installations = await this.#listInstallations();
    return installations.map((i) => this.#decryptInstallation(i));
  }

  /**
   * Check if Slack is configured for app creation.
   */
  isConfigured(): boolean {
    return !!this.#manifestClient;
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

  async #handleConnectRequest(c: Context): Promise<Response> {
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

  async #handleDisconnectRequest(c: Context): Promise<Response> {
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

  async #handleListInstallations(c: Context): Promise<Response> {
    const installations = await this.listInstallations();
    return c.json({ installations });
  }

  async #handleOAuthCallback(c: Context): Promise<Response> {
    const url = new URL(c.req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // installationId
    const error = url.searchParams.get('error');

    if (error) {
      const redirectUrl = this.#channelConfig.redirectPath ?? '/slack/error';
      return c.redirect(`${redirectUrl}?error=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return c.json({ error: 'Missing code or state parameter' }, 400);
    }

    const pendingEncrypted = await this.#getPendingInstallationById(state);
    if (!pendingEncrypted) {
      return c.json({ error: 'Invalid or expired installation state' }, 400);
    }

    // Decrypt secrets for use
    const pending = this.#decryptPendingInstallation(pendingEncrypted);

    const baseUrl = this.#getBaseUrl();
    if (!baseUrl) {
      throw new Error('SlackChannel baseUrl not available during OAuth callback');
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
      });

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

      // Save completed installation (encrypted)
      const installation: SlackInstallation = {
        id: pending.id,
        agentId: pending.agentId,
        webhookId: pending.webhookId,
        appId: pending.appId,
        clientId: pending.clientId,
        clientSecret: pending.clientSecret,
        signingSecret: pending.signingSecret,
        botToken: tokenData.access_token!,
        botUserId: tokenData.bot_user_id!,
        teamId: tokenData.team!.id,
        teamName: tokenData.team!.name,
        installedAt: new Date(),
        configHash: pending.configHash,
      };

      const encryptedInstallation = this.#encryptInstallation(installation);
      console.log(`[Slack] Saving installation...`);
      console.log(`[Slack] Installation ID: ${encryptedInstallation.id}, agentId: ${encryptedInstallation.agentId}`);
      await this.#saveInstallation(encryptedInstallation);
      console.log(`[Slack] Installation saved (status: active)`);

      // Create SlackAdapter for this installation
      const adapter = createSlackAdapter({
        botToken: installation.botToken,
        botUserId: installation.botUserId,
        signingSecret: installation.signingSecret,
      });
      this.#adapters.set(installation.id, adapter);

      // Notify callback
      if (this.#channelConfig.onInstall) {
        await this.#channelConfig.onInstall(installation);
      }

      // Redirect to success page
      console.log(`[Slack] Installation complete for agent ${pending.agentId} in team ${tokenData.team!.name}`);

      const redirectUrl = this.#channelConfig.redirectPath ?? '/slack/success';
      return c.redirect(`${redirectUrl}?agent=${pending.agentId}&team=${tokenData.team!.name}`);
    } catch (error) {
      console.error('[Slack] OAuth callback error:', error);
      const message = error instanceof Error ? error.message : 'OAuth failed';
      const redirectUrl = this.#channelConfig.redirectPath ?? '/slack/error';
      return c.redirect(`${redirectUrl}?error=${encodeURIComponent(message)}`);
    }
  }

  async #handleEvent(c: Context): Promise<Response> {
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

    const event = JSON.parse(rawBody);

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

    // Get or create AgentChannels with Slack adapter
    const adapter = this.#adapters.get(installation.id) ?? createSlackAdapter({
      botToken: installation.botToken,
      botUserId: installation.botUserId,
      signingSecret: installation.signingSecret,
    });
    const agentChannels = this.#getOrCreateAgentChannels(agent, adapter);
    
    // Ensure initialized
    await agentChannels.initialize(this.#mastra);

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

  async #handleSlashCommand(c: Context): Promise<Response> {
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
    const commandConfig = commands?.find((cmd) => cmd.command === command);

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
