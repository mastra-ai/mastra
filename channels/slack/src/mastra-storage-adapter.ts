import type { ChannelsStorage, ChannelInstallation } from '@mastra/core/storage';
import type { SlackStorage, SlackInstallation, PendingInstallation, StoredConfigTokens } from './types';

const PLATFORM = 'slack';

/**
 * Adapter that bridges Mastra's generic ChannelsStorage to SlackStorage interface.
 * This allows SlackChannel to use Mastra's built-in storage infrastructure.
 */
export class MastraSlackStorageAdapter implements SlackStorage {
  #storage: ChannelsStorage;

  constructor(storage: ChannelsStorage) {
    this.#storage = storage;
  }

  async saveConfigTokens(tokens: StoredConfigTokens): Promise<void> {
    await this.#storage.saveConfig({
      platform: PLATFORM,
      data: {
        configToken: tokens.configToken,
        refreshToken: tokens.refreshToken,
      },
      updatedAt: tokens.updatedAt,
    });
  }

  async getConfigTokens(): Promise<StoredConfigTokens | null> {
    const config = await this.#storage.getConfig(PLATFORM);
    if (!config) return null;
    const data = config.data as { configToken: string; refreshToken: string };
    return {
      configToken: data.configToken,
      refreshToken: data.refreshToken,
      updatedAt: config.updatedAt,
    };
  }

  async saveInstallation(installation: SlackInstallation): Promise<void> {
    const record = {
      id: installation.id,
      platform: PLATFORM,
      agentId: installation.agentId,
      status: 'active' as const,
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
    };
    await this.#storage.saveInstallation(record);
  }

  async getInstallation(agentId: string): Promise<SlackInstallation | null> {
    const record = await this.#storage.getInstallationByAgent(PLATFORM, agentId);
    if (!record || record.status !== 'active') return null;
    return this.#toSlackInstallation(record);
  }

  async getInstallationByWebhookId(webhookId: string): Promise<SlackInstallation | null> {
    const record = await this.#storage.getInstallationByWebhookId(webhookId);
    if (!record || record.platform !== PLATFORM || record.status !== 'active') return null;
    return this.#toSlackInstallation(record);
  }

  async listInstallations(): Promise<SlackInstallation[]> {
    const records = await this.#storage.listInstallations(PLATFORM);
    return records
      .filter((r) => r.status === 'active')
      .map((r) => this.#toSlackInstallation(r));
  }

  async deleteInstallation(id: string): Promise<void> {
    await this.#storage.deleteInstallation(id);
  }

  // Pending installations - stored with status: 'pending'
  async savePendingInstallation(pending: PendingInstallation): Promise<void> {
    await this.#storage.saveInstallation({
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
        createdAt: pending.createdAt.toISOString(),
      },
      createdAt: pending.createdAt,
      updatedAt: new Date(),
    });
  }

  async getPendingInstallation(id: string): Promise<PendingInstallation | null> {
    const record = await this.#storage.getInstallation(id);
    if (!record || record.status !== 'pending') return null;
    return this.#toPendingInstallation(record);
  }

  async getPendingInstallationByAgentId(agentId: string): Promise<PendingInstallation | null> {
    const record = await this.#storage.getInstallationByAgent(PLATFORM, agentId);
    if (!record || record.status !== 'pending') return null;
    return this.#toPendingInstallation(record);
  }

  async listPendingInstallations(): Promise<PendingInstallation[]> {
    const records = await this.#storage.listInstallations(PLATFORM);
    return records.filter((r) => r.status === 'pending').map((r) => this.#toPendingInstallation(r));
  }

  async deletePendingInstallation(id: string): Promise<void> {
    await this.#storage.deleteInstallation(id);
  }

  #toSlackInstallation(record: ChannelInstallation): SlackInstallation {
    const data = record.data as {
      appId: string;
      clientId: string;
      clientSecret: string;
      signingSecret: string;
      teamId: string;
      teamName?: string;
      botToken: string;
      botUserId: string;
    };
    return {
      id: record.id,
      agentId: record.agentId,
      webhookId: record.webhookId ?? '',
      appId: data.appId,
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      signingSecret: data.signingSecret,
      teamId: data.teamId,
      teamName: data.teamName,
      botToken: data.botToken,
      botUserId: data.botUserId,
      installedAt: record.createdAt,
      configHash: record.configHash ?? '',
    };
  }

  #toPendingInstallation(record: ChannelInstallation): PendingInstallation {
    const data = record.data as {
      appId: string;
      clientId: string;
      clientSecret: string;
      signingSecret: string;
      authorizationUrl: string;
      createdAt: string;
    };
    return {
      id: record.id,
      agentId: record.agentId,
      webhookId: record.webhookId ?? '',
      appId: data.appId,
      clientId: data.clientId,
      clientSecret: data.clientSecret,
      signingSecret: data.signingSecret,
      authorizationUrl: data.authorizationUrl,
      configHash: record.configHash ?? '',
      createdAt: new Date(data.createdAt),
    };
  }
}
