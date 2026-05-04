import type { Client } from '@libsql/client';
import {
  ChannelsStorage,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_CHANNEL_CONFIG,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type { ChannelInstallation, ChannelConfig } from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

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

    // Indexes
    await this.#client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_installations_webhook ON "${TABLE_CHANNEL_INSTALLATIONS}" ("webhookId")`,
    );
    await this.#client.execute(
      `CREATE INDEX IF NOT EXISTS idx_channel_installations_platform_agent ON "${TABLE_CHANNEL_INSTALLATIONS}" ("platform", "agentId")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_CHANNEL_INSTALLATIONS });
    await this.#db.deleteData({ tableName: TABLE_CHANNEL_CONFIG });
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
