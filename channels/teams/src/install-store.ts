import type { ChannelInstallationInfo } from '@mastra/core/channels';
import type { ChannelInstallation, ChannelsStorage } from '@mastra/core/storage';
import type { TeamsInstallation } from './types';
import { decrypt, encrypt, isEncrypted } from './crypto';

/** Platform identifier used for every stored record and route. */
export const PLATFORM = 'teams';

/** Per-bot fields serialized into a {@link ChannelInstallation.data} blob. */
interface TeamsInstallationData {
  appId?: string;
  entraObjectId?: string;
  appPassword?: string;
  appTenantId?: string;
  appType?: 'MultiTenant' | 'SingleTenant';
  botName?: string;
  messagingEndpoint?: string;
}

/**
 * Persistence for Teams bot installations, layered over the platform-agnostic
 * `ChannelsStorage` (the same store `@mastra/slack` / `@mastra/telegram` use).
 * Installations are keyed by agent — one bot = one agent — and the per-bot
 * fields live in the record's `data` blob. When an `encryptionKey` is
 * supplied, `appPassword` (the bot's client secret) is AES-256-GCM encrypted
 * at rest.
 */
export class TeamsInstallStore {
  #warnedPlaintext = false;

  constructor(
    private readonly storage: ChannelsStorage,
    private readonly encryptionKey?: string,
  ) {}

  /** The active or pending installation for an agent, if any. */
  async getByAgent(agentId: string): Promise<TeamsInstallation | null> {
    const record = await this.storage.getInstallationByAgent(PLATFORM, agentId);
    return record ? this.#fromRecord(record) : null;
  }

  /** Look up an installation by the routing id in its messaging endpoint path. */
  async getByWebhookId(webhookId: string): Promise<TeamsInstallation | null> {
    const record = await this.storage.getInstallationByWebhookId(webhookId);
    return record && record.platform === PLATFORM ? this.#fromRecord(record) : null;
  }

  /** Insert or replace an installation. */
  async save(installation: TeamsInstallation): Promise<void> {
    await this.storage.saveInstallation(this.#toRecord(installation));
  }

  /** All Teams installations (active and pending). */
  async list(): Promise<TeamsInstallation[]> {
    const records = await this.storage.listInstallations(PLATFORM);
    return records.map(r => this.#fromRecord(r));
  }

  /** Remove an agent's installation, if present. */
  async deleteByAgent(agentId: string): Promise<void> {
    const record = await this.storage.getInstallationByAgent(PLATFORM, agentId);
    if (record) await this.storage.deleteInstallation(record.id);
  }

  #enc(value: string | undefined): string | undefined {
    if (value && !this.encryptionKey && !this.#warnedPlaintext) {
      this.#warnedPlaintext = true;
      console.warn(
        '[Teams] Storing the bot client secret WITHOUT encryption — no encryption key is configured. ' +
          'Set `encryptionKey` on TeamsProvider or the MASTRA_ENCRYPTION_KEY environment variable to encrypt installation secrets at rest.',
      );
    }
    return value && this.encryptionKey ? encrypt(value, this.encryptionKey) : value;
  }

  #dec(value: string | undefined): string | undefined {
    if (!value) return value;
    if (!this.encryptionKey) {
      if (isEncrypted(value)) {
        throw new Error(
          'Teams installation secrets are encrypted at rest, but no encryption key is configured. Set `encryptionKey` on TeamsProvider or MASTRA_ENCRYPTION_KEY.',
        );
      }
      return value;
    }
    return decrypt(value, this.encryptionKey);
  }

  #toRecord(install: TeamsInstallation): ChannelInstallation {
    const data: TeamsInstallationData = {
      appId: install.appId,
      entraObjectId: install.entraObjectId,
      appPassword: this.#enc(install.appPassword),
      appTenantId: install.appTenantId,
      appType: install.appType,
      botName: install.botName,
      messagingEndpoint: install.messagingEndpoint,
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

  #fromRecord(record: ChannelInstallation): TeamsInstallation {
    const data = (record.data ?? {}) as TeamsInstallationData;
    return {
      id: record.id,
      agentId: record.agentId,
      webhookId: record.webhookId ?? '',
      status: record.status === 'active' ? 'active' : 'pending',
      appId: data.appId,
      entraObjectId: data.entraObjectId,
      appPassword: this.#dec(data.appPassword),
      appTenantId: data.appTenantId,
      appType: data.appType,
      botName: data.botName,
      messagingEndpoint: data.messagingEndpoint,
      installedAt: record.createdAt,
    };
  }
}

/** Project an installation to its public, secret-free info for the editor UI. */
export function toInstallationInfo(install: TeamsInstallation): ChannelInstallationInfo {
  return {
    id: install.id,
    platform: PLATFORM,
    agentId: install.agentId,
    status: install.status,
    displayName: install.botName,
    installedAt: install.installedAt,
  };
}
