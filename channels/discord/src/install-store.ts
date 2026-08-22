import type { ChannelInstallationInfo } from '@mastra/core/channels';
import type { ChannelInstallation, ChannelsStorage } from '@mastra/core/storage';
import type { DiscordAppConfig, DiscordCommand, DiscordInstallation } from './types';
import { decrypt, encrypt, isEncrypted } from './crypto';

/** Platform identifier used for every stored record, config, and route. */
export const PLATFORM = 'discord';

/** Per-agent fields serialized into a {@link ChannelInstallation.data} blob (no secrets). */
interface DiscordInstallationData {
  guildIds?: string[];
  displayName?: string;
  commands?: DiscordCommand[];
  commandVersions?: Record<string, string>;
}

/** App-config fields serialized into the platform `ChannelConfig.data` blob. */
interface DiscordAppConfigData {
  /** Bot token — the only secret; AES-256-GCM encrypted when an `encryptionKey` is set. */
  botToken?: string;
  /** Ed25519 public key (public — stored plaintext). */
  publicKey?: string;
  /** Application (client) id (public — stored plaintext). */
  applicationId?: string;
}

/**
 * Two-tier persistence for Discord, layered over the platform-agnostic
 * `ChannelsStorage` (the same store `@mastra/slack` / `@mastra/telegram` use).
 *
 * - **App tier** (`saveConfig`/`getConfig`) — the one application's
 *   `botToken` + `publicKey` + `applicationId`, stored **once** (one app, many
 *   guilds). `botToken` is AES-256-GCM encrypted at rest when an `encryptionKey`
 *   is supplied.
 * - **Install tier** (`getInstallationByAgent`/`…ByWebhookId`/`saveInstallation`)
 *   — one row per agent, keyed by agent, tracking the `guildIds` the bot is live
 *   in. Secrets are **not** duplicated per row.
 */
export class DiscordInstallStore {
  constructor(
    private readonly storage: ChannelsStorage,
    private readonly encryptionKey?: string,
  ) {}

  // --- App tier (stored once) -----------------------------------------------

  /** The stored app config, if any (bot token decrypted). */
  async getAppConfig(): Promise<DiscordAppConfig | null> {
    const config = await this.storage.getConfig(PLATFORM);
    if (!config) return null;
    const data = (config.data ?? {}) as DiscordAppConfigData;
    if (!data.botToken || !data.publicKey || !data.applicationId) return null;
    return {
      botToken: this.#dec(data.botToken)!,
      publicKey: data.publicKey,
      applicationId: data.applicationId,
    };
  }

  /** Persist the app config once (bot token encrypted at rest when keyed). */
  async saveAppConfig(app: DiscordAppConfig): Promise<void> {
    const data: DiscordAppConfigData = {
      botToken: this.#enc(app.botToken),
      publicKey: app.publicKey,
      applicationId: app.applicationId,
    };
    await this.storage.saveConfig({ platform: PLATFORM, data: data as Record<string, unknown>, updatedAt: new Date() });
  }

  /** Remove the stored app config. */
  async deleteAppConfig(): Promise<void> {
    await this.storage.deleteConfig(PLATFORM);
  }

  // --- Install tier (one row per agent) -------------------------------------

  /** The installation for an agent, if any. */
  async getByAgent(agentId: string): Promise<DiscordInstallation | null> {
    const record = await this.storage.getInstallationByAgent(PLATFORM, agentId);
    return record ? this.#fromRecord(record) : null;
  }

  /** Look up an installation by the routing id in its interactions-route path. */
  async getByWebhookId(webhookId: string): Promise<DiscordInstallation | null> {
    const record = await this.storage.getInstallationByWebhookId(webhookId);
    return record && record.platform === PLATFORM ? this.#fromRecord(record) : null;
  }

  /**
   * Find the installation that owns a guild (tenancy lookup by `guildId`). Used
   * when the routing key is a guild rather than a webhook id.
   *
   * `guildIds` is per-agent and nothing enforces exclusivity, so two agents can
   * legitimately be installed into the same guild. Returning the first match
   * would make routing depend on storage row order — the same interaction could
   * reach a different agent on the next lookup. Instead the **oldest** install
   * wins (ties broken by id), which is stable across restarts and storage
   * backends, and the ambiguity is logged once so an operator can see it.
   *
   * `ChannelsStorage` has no query-by-data-field, so this necessarily lists the
   * platform's installations; it is not on the interactions hot path, which
   * routes by `webhookId`.
   */
  async getByGuildId(guildId: string): Promise<DiscordInstallation | null> {
    const records = await this.storage.listInstallations(PLATFORM);
    const matches = records.filter(r => ((r.data as DiscordInstallationData)?.guildIds ?? []).includes(guildId));
    if (matches.length === 0) return null;
    if (matches.length > 1) {
      console.warn(
        `[Discord] Guild "${guildId}" is claimed by ${matches.length} installations (${matches
          .map(r => r.agentId)
          .join(', ')}). Routing to the oldest; disconnect the others to remove the ambiguity.`,
      );
    }
    const winner = matches.reduce((oldest, r) => {
      const a = r.createdAt?.getTime() ?? 0;
      const b = oldest.createdAt?.getTime() ?? 0;
      if (a !== b) return a < b ? r : oldest;
      return r.id < oldest.id ? r : oldest;
    });
    return this.#fromRecord(winner);
  }

  /** Insert or replace an installation. */
  async save(installation: DiscordInstallation): Promise<void> {
    await this.storage.saveInstallation(this.#toRecord(installation));
  }

  /** All Discord installations (active and pending). */
  async list(): Promise<DiscordInstallation[]> {
    const records = await this.storage.listInstallations(PLATFORM);
    return records.map(r => this.#fromRecord(r));
  }

  /** Remove an agent's installation, if present. */
  async deleteByAgent(agentId: string): Promise<void> {
    const record = await this.storage.getInstallationByAgent(PLATFORM, agentId);
    if (record) await this.storage.deleteInstallation(record.id);
  }

  #enc(value: string | undefined): string | undefined {
    return value && this.encryptionKey ? encrypt(value, this.encryptionKey) : value;
  }

  #dec(value: string | undefined): string | undefined {
    if (!value) return value;
    if (!this.encryptionKey) {
      // A deployment that stored an encrypted token and later lost its key would
      // otherwise hand the ciphertext to Discord as a bot token — surfacing as
      // opaque 401s instead of the configuration error it actually is.
      if (isEncrypted(value)) {
        throw new Error(
          'The stored Discord bot token is encrypted at rest, but no encryption key is configured. Set `encryptionKey` on DiscordProvider or MASTRA_ENCRYPTION_KEY.',
        );
      }
      return value;
    }
    return decrypt(value, this.encryptionKey);
  }

  #toRecord(install: DiscordInstallation): ChannelInstallation {
    const data: DiscordInstallationData = {
      guildIds: install.guildIds,
      displayName: install.displayName,
      commands: install.commands,
      commandVersions: install.commandVersions,
    };
    return {
      id: install.id,
      platform: PLATFORM,
      agentId: install.agentId,
      status: install.status,
      webhookId: install.webhookId,
      data: data as Record<string, unknown>,
      createdAt: install.installedAt,
      updatedAt: new Date(),
    };
  }

  #fromRecord(record: ChannelInstallation): DiscordInstallation {
    const data = (record.data ?? {}) as DiscordInstallationData;
    return {
      id: record.id,
      agentId: record.agentId,
      webhookId: record.webhookId ?? '',
      status: record.status === 'active' ? 'active' : 'pending',
      guildIds: data.guildIds ?? [],
      displayName: data.displayName,
      commands: data.commands,
      commandVersions: data.commandVersions,
      installedAt: record.createdAt,
    };
  }
}

/** Project an installation to its public, secret-free info for the editor UI. */
export function toInstallationInfo(install: DiscordInstallation): ChannelInstallationInfo {
  return {
    id: install.id,
    platform: PLATFORM,
    agentId: install.agentId,
    status: install.status,
    displayName: install.displayName,
    installedAt: install.installedAt,
  };
}
