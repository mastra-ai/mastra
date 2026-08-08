import type { ChannelInstallationInfo } from '@mastra/core/channels';
import type { ChannelInstallation, ChannelsStorage } from '@mastra/core/storage';
import type { BotCommand, TelegramInstallation } from './types';
import { decrypt, encrypt } from './crypto';

/** Platform identifier used for every stored record and route. */
export const PLATFORM = 'telegram';

/** Per-bot secret fields serialized into a {@link ChannelInstallation.data} blob. */
interface TelegramInstallationData {
  botToken?: string;
  secretToken?: string;
  username?: string;
  webhookUrl?: string;
  commands?: BotCommand[];
}

/**
 * Persistence for Telegram bot installations, layered over the platform-agnostic
 * `ChannelsStorage` (the same store `@mastra/slack` uses). Installations are
 * keyed by agent — one bot = one agent — and the per-bot secret fields live in
 * the record's `data` blob. When an `encryptionKey` is supplied, `botToken` and
 * `secretToken` are AES-256-GCM encrypted at rest.
 */
export class TelegramInstallStore {
  constructor(
    private readonly storage: ChannelsStorage,
    private readonly encryptionKey?: string,
  ) {}

  /** The active or pending installation for an agent, if any. */
  async getByAgent(agentId: string): Promise<TelegramInstallation | null> {
    const record = await this.storage.getInstallationByAgent(PLATFORM, agentId);
    return record ? this.#fromRecord(record) : null;
  }

  /** Look up an installation by the routing id in its webhook path (M1 dispatch). */
  async getByWebhookId(webhookId: string): Promise<TelegramInstallation | null> {
    const record = await this.storage.getInstallationByWebhookId(webhookId);
    return record && record.platform === PLATFORM ? this.#fromRecord(record) : null;
  }

  /** Insert or replace an installation. */
  async save(installation: TelegramInstallation): Promise<void> {
    await this.storage.saveInstallation(this.#toRecord(installation));
  }

  /** All Telegram installations (active and pending). */
  async list(): Promise<TelegramInstallation[]> {
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
    return value && this.encryptionKey ? decrypt(value, this.encryptionKey) : value;
  }

  #toRecord(install: TelegramInstallation): ChannelInstallation {
    const data: TelegramInstallationData = {
      botToken: this.#enc(install.botToken),
      secretToken: this.#enc(install.secretToken),
      username: install.username,
      webhookUrl: install.webhookUrl,
      commands: install.commands,
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

  #fromRecord(record: ChannelInstallation): TelegramInstallation {
    const data = (record.data ?? {}) as TelegramInstallationData;
    return {
      id: record.id,
      agentId: record.agentId,
      webhookId: record.webhookId ?? '',
      status: record.status === 'active' ? 'active' : 'pending',
      botToken: this.#dec(data.botToken),
      secretToken: this.#dec(data.secretToken),
      username: data.username,
      webhookUrl: data.webhookUrl,
      commands: data.commands,
      installedAt: record.createdAt,
    };
  }
}

/** Project an installation to its public, secret-free info for the editor UI. */
export function toInstallationInfo(install: TelegramInstallation): ChannelInstallationInfo {
  return {
    id: install.id,
    platform: PLATFORM,
    agentId: install.agentId,
    status: install.status,
    displayName: install.username,
    installedAt: install.installedAt,
  };
}
