import { ChannelsStorage, TABLE_CHANNEL_CONFIG, TABLE_CHANNEL_INSTALLATIONS } from '@mastra/core/storage';
import type { ChannelConfig, ChannelInstallation } from '@mastra/core/storage';

import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

type ChannelInstallationRecord = {
  id: string;
  platform: string;
  agentId: string;
  status: ChannelInstallation['status'];
  webhookId: string | null;
  data: string;
  configHash: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

type ChannelConfigRecord = Omit<ChannelConfig, 'updatedAt' | 'data'> & {
  id: string;
  updatedAt: string;
  data: string;
};

const statusPriority: Record<ChannelInstallation['status'], number> = {
  active: 0,
  pending: 1,
  error: 2,
};

function stringifyJson(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

function parseJson(value: string, context: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Invalid channel data JSON for ${context}`, { cause: error });
  }
}

function installationToRecord(
  installation: ChannelInstallation,
  existingRecord?: ChannelInstallationRecord | null,
): ChannelInstallationRecord {
  const now = new Date().toISOString();
  return {
    id: installation.id,
    platform: installation.platform,
    agentId: installation.agentId,
    status: installation.status,
    webhookId: installation.webhookId ?? null,
    data: stringifyJson(installation.data),
    configHash: installation.configHash ?? null,
    error: installation.error ?? null,
    createdAt: existingRecord?.createdAt ?? installation.createdAt?.toISOString() ?? now,
    updatedAt: now,
  };
}

function recordToInstallation(record: ChannelInstallationRecord): ChannelInstallation {
  return {
    id: record.id,
    platform: record.platform,
    agentId: record.agentId,
    status: record.status,
    webhookId: record.webhookId ?? undefined,
    data: parseJson(record.data, `installation ${record.id}`),
    configHash: record.configHash ?? undefined,
    error: record.error ?? undefined,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function configToRecord(config: ChannelConfig): ChannelConfigRecord {
  return {
    id: config.platform,
    platform: config.platform,
    data: stringifyJson(config.data),
    updatedAt: config.updatedAt.toISOString(),
  };
}

function recordToConfig(record: ChannelConfigRecord): ChannelConfig {
  return {
    platform: record.platform,
    data: parseJson(record.data, `config ${record.platform}`),
    updatedAt: new Date(record.updatedAt),
  };
}

function sortInstallationsForAgent(a: ChannelInstallation, b: ChannelInstallation): number {
  const statusDiff = statusPriority[a.status] - statusPriority[b.status];
  if (statusDiff !== 0) return statusDiff;
  return b.updatedAt.getTime() - a.updatedAt.getTime();
}

export class ChannelsConvex extends ChannelsStorage {
  #db: ConvexDB;

  constructor(config: ConvexDomainConfig) {
    super();
    const client = resolveConvexConfig(config);
    this.#db = new ConvexDB(client);
  }

  async init(): Promise<void> {
    // No-op for Convex; schema is managed server-side.
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_CHANNEL_INSTALLATIONS });
    await this.#db.clearTable({ tableName: TABLE_CHANNEL_CONFIG });
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    const existingRecord = await this.#db.load<ChannelInstallationRecord | null>({
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      keys: { id: installation.id },
    });

    await this.#db.insert({
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      record: installationToRecord(installation, existingRecord),
    });
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    const record = await this.#db.load<ChannelInstallationRecord | null>({
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      keys: { id },
    });
    return record ? recordToInstallation(record) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const records = await this.#db.queryTable<ChannelInstallationRecord>(TABLE_CHANNEL_INSTALLATIONS, [
      { field: 'platform', value: platform },
      { field: 'agentId', value: agentId },
    ]);
    const [installation] = records.map(recordToInstallation).sort(sortInstallationsForAgent);
    return installation ?? null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const records = await this.#db.queryTable<ChannelInstallationRecord>(TABLE_CHANNEL_INSTALLATIONS, [
      { field: 'webhookId', value: webhookId },
    ]);
    const [installation] = records
      .map(recordToInstallation)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return installation ?? null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const records = await this.#db.queryTable<ChannelInstallationRecord>(TABLE_CHANNEL_INSTALLATIONS, [
      { field: 'platform', value: platform },
    ]);
    return records.map(recordToInstallation).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async deleteInstallation(id: string): Promise<void> {
    await this.#db.deleteMany(TABLE_CHANNEL_INSTALLATIONS, [id]);
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    await this.#db.insert({
      tableName: TABLE_CHANNEL_CONFIG,
      record: configToRecord(config),
    });
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const record = await this.#db.load<ChannelConfigRecord | null>({
      tableName: TABLE_CHANNEL_CONFIG,
      keys: { id: platform },
    });
    return record ? recordToConfig(record) : null;
  }

  async deleteConfig(platform: string): Promise<void> {
    await this.#db.deleteMany(TABLE_CHANNEL_CONFIG, [platform]);
  }
}
