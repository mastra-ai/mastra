import {
  ChannelsStorage,
  CHANNEL_THREADS_PRIMARY_KEY,
  CHANNEL_THREADS_TABLE_SCHEMA,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_CHANNEL_CONFIG,
  TABLE_CHANNEL_THREADS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  ChannelInstallation,
  ChannelConfig,
  ChannelThreadKey,
  ChannelThreadMapping,
  ChannelThreadMappingInput,
} from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client } from '../../db/client';

export class ChannelsLibSQL extends ChannelsStorage {
  #db: LibSQLDB;
  #client: Client;

  static readonly MANAGED_TABLES = [TABLE_CHANNEL_INSTALLATIONS, TABLE_CHANNEL_CONFIG] as const;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_CHANNEL_INSTALLATIONS,
      schema: TABLE_SCHEMAS[TABLE_CHANNEL_INSTALLATIONS],
    });
    await this.#db.createTable({
      tableName: TABLE_CHANNEL_CONFIG,
      schema: TABLE_SCHEMAS[TABLE_CHANNEL_CONFIG],
    });
    // mastra_channel_threads lives outside TABLE_NAMES (same convention as the
    // observational-memory table), hence the cast.
    await this.#db.createTable({
      tableName: TABLE_CHANNEL_THREADS as any,
      schema: CHANNEL_THREADS_TABLE_SCHEMA[TABLE_CHANNEL_THREADS],
      compositePrimaryKey: [...CHANNEL_THREADS_PRIMARY_KEY],
    });

    // Indexes
    await this.#client.batch(
      [
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_channel_threads_thread_id ON "${TABLE_CHANNEL_THREADS}" ("threadId")`,
          args: [],
        },
        {
          sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_installations_webhook ON "${TABLE_CHANNEL_INSTALLATIONS}" ("webhookId")`,
          args: [],
        },
        {
          sql: `CREATE INDEX IF NOT EXISTS idx_channel_installations_platform_agent ON "${TABLE_CHANNEL_INSTALLATIONS}" ("platform", "agentId")`,
          args: [],
        },
      ],
      'write',
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_CHANNEL_INSTALLATIONS });
    await this.#db.deleteData({ tableName: TABLE_CHANNEL_CONFIG });
    await this.#db.deleteData({ tableName: TABLE_CHANNEL_THREADS as any });
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    const now = new Date().toISOString();
    await this.#client.execute({
      sql: `
        INSERT INTO "${TABLE_CHANNEL_INSTALLATIONS}" (id, platform, agentId, status, webhookId, data, configHash, error, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          platform = excluded.platform,
          agentId = excluded.agentId,
          status = excluded.status,
          webhookId = excluded.webhookId,
          data = excluded.data,
          configHash = excluded.configHash,
          error = excluded.error,
          updatedAt = excluded.updatedAt
      `,
      args: [
        installation.id,
        installation.platform,
        installation.agentId,
        installation.status,
        installation.webhookId ?? null,
        JSON.stringify(installation.data),
        installation.configHash ?? null,
        installation.error ?? null,
        installation.createdAt?.toISOString() ?? now,
        now,
      ],
    });
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_CHANNEL_INSTALLATIONS}" WHERE id = ?`,
      args: [id],
    });
    const row = result.rows?.[0];
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_CHANNEL_INSTALLATIONS}" WHERE platform = ? AND agentId = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, updatedAt DESC LIMIT 1`,
      args: [platform, agentId],
    });
    const row = result.rows?.[0];
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_CHANNEL_INSTALLATIONS}" WHERE webhookId = ?`,
      args: [webhookId],
    });
    const row = result.rows?.[0];
    return row ? this.#parseInstallationRow(row) : null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_CHANNEL_INSTALLATIONS}" WHERE platform = ? ORDER BY createdAt DESC`,
      args: [platform],
    });
    return result.rows.map(row => this.#parseInstallationRow(row));
  }

  async deleteInstallation(id: string): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM "${TABLE_CHANNEL_INSTALLATIONS}" WHERE id = ?`,
      args: [id],
    });
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    await this.#client.execute({
      sql: `
        INSERT INTO "${TABLE_CHANNEL_CONFIG}" (platform, data, updatedAt)
        VALUES (?, ?, ?)
        ON CONFLICT(platform) DO UPDATE SET
          data = excluded.data,
          updatedAt = excluded.updatedAt
      `,
      args: [config.platform, JSON.stringify(config.data), config.updatedAt.toISOString()],
    });
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_CHANNEL_CONFIG}" WHERE platform = ?`,
      args: [platform],
    });
    const row = result.rows?.[0];
    if (!row) return null;
    return {
      platform: row.platform as string,
      data: JSON.parse((row.data as string) || '{}'),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  async deleteConfig(platform: string): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM "${TABLE_CHANNEL_CONFIG}" WHERE platform = ?`,
      args: [platform],
    });
  }

  async getThreadMapping(key: ChannelThreadKey): Promise<ChannelThreadMapping | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_CHANNEL_THREADS}" WHERE platform = ? AND ownerId = ? AND externalThreadId = ?`,
      args: [key.platform, key.ownerId, key.externalThreadId],
    });
    const row = result.rows?.[0];
    return row ? this.#parseThreadMappingRow(row) : null;
  }

  async getThreadMappingByThreadId(threadId: string): Promise<ChannelThreadMapping | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_CHANNEL_THREADS}" WHERE threadId = ? LIMIT 1`,
      args: [threadId],
    });
    const row = result.rows?.[0];
    return row ? this.#parseThreadMappingRow(row) : null;
  }

  async upsertThreadMapping(mapping: ChannelThreadMappingInput): Promise<ChannelThreadMapping> {
    const now = new Date().toISOString();
    const subscribed = mapping.subscribed === undefined ? null : mapping.subscribed ? 1 : 0;
    // On conflict threadId is never changed: the first writer owns the mapping.
    await this.#client.execute({
      sql: `
        INSERT INTO "${TABLE_CHANNEL_THREADS}" (platform, ownerId, externalThreadId, threadId, externalChannelId, subscribed, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, COALESCE(?, 0), ?, ?)
        ON CONFLICT(platform, ownerId, externalThreadId) DO UPDATE SET
          externalChannelId = excluded.externalChannelId,
          subscribed = COALESCE(?, subscribed),
          updatedAt = excluded.updatedAt
      `,
      args: [
        mapping.platform,
        mapping.ownerId,
        mapping.externalThreadId,
        mapping.threadId,
        mapping.externalChannelId,
        subscribed,
        now,
        now,
        subscribed,
      ],
    });
    const row = await this.getThreadMapping(mapping);
    if (!row) throw new Error('Channel thread mapping was not persisted');
    return row;
  }

  async setThreadSubscribed(key: ChannelThreadKey, subscribed: boolean): Promise<void> {
    await this.#client.execute({
      sql: `UPDATE "${TABLE_CHANNEL_THREADS}" SET subscribed = ?, updatedAt = ? WHERE platform = ? AND ownerId = ? AND externalThreadId = ?`,
      args: [subscribed ? 1 : 0, new Date().toISOString(), key.platform, key.ownerId, key.externalThreadId],
    });
  }

  async deleteThreadMapping(key: ChannelThreadKey): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM "${TABLE_CHANNEL_THREADS}" WHERE platform = ? AND ownerId = ? AND externalThreadId = ?`,
      args: [key.platform, key.ownerId, key.externalThreadId],
    });
  }

  #parseThreadMappingRow(row: Record<string, unknown>): ChannelThreadMapping {
    return {
      platform: row.platform as string,
      ownerId: row.ownerId as string,
      externalThreadId: row.externalThreadId as string,
      threadId: row.threadId as string,
      externalChannelId: row.externalChannelId as string,
      subscribed: Number(row.subscribed) === 1,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  #parseInstallationRow(row: Record<string, unknown>): ChannelInstallation {
    return {
      id: row.id as string,
      platform: row.platform as string,
      agentId: row.agentId as string,
      status: row.status as 'pending' | 'active' | 'error',
      webhookId: (row.webhookId as string) || undefined,
      data: JSON.parse((row.data as string) || '{}'),
      configHash: (row.configHash as string) || undefined,
      error: (row.error as string) || undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }
}
