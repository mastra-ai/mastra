import type { Client } from '@libsql/client';
import { ChannelsStorage } from '@mastra/core/storage';
import type { ChannelInstallation, ChannelConfig } from '@mastra/core/storage';
import { resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

const TABLE_INSTALLATIONS = 'mastra_channel_installations';
const TABLE_CONFIG = 'mastra_channel_config';

export class ChannelsLibSQL extends ChannelsStorage {
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    this.#client = resolveClient(config);
  }

  async init(): Promise<void> {
    // Create installations table
    await this.#client.execute(`
      CREATE TABLE IF NOT EXISTS "${TABLE_INSTALLATIONS}" (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        agentId TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        webhookId TEXT,
        data TEXT NOT NULL DEFAULT '{}',
        configHash TEXT,
        error TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

    // Create config table (generic JSON blob for platform-specific config)
    await this.#client.execute(`
      CREATE TABLE IF NOT EXISTS "${TABLE_CONFIG}" (
        platform TEXT PRIMARY KEY,
        data TEXT NOT NULL DEFAULT '{}',
        updatedAt TEXT NOT NULL
      )
    `);

    // Indexes
    await this.#client.execute(
      `CREATE INDEX IF NOT EXISTS idx_channel_installations_webhook ON "${TABLE_INSTALLATIONS}" ("webhookId")`,
    );
    await this.#client.execute(
      `CREATE INDEX IF NOT EXISTS idx_channel_installations_platform_agent ON "${TABLE_INSTALLATIONS}" ("platform", "agentId")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#client.execute(`DELETE FROM "${TABLE_INSTALLATIONS}"`);
    await this.#client.execute(`DELETE FROM "${TABLE_CONFIG}"`);
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    const now = new Date().toISOString();
    await this.#client.execute({
      sql: `
        INSERT INTO "${TABLE_INSTALLATIONS}" (id, platform, agentId, status, webhookId, data, configHash, error, createdAt, updatedAt)
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
      sql: `SELECT * FROM "${TABLE_INSTALLATIONS}" WHERE id = ?`,
      args: [id],
    });
    const row = result.rows?.[0];
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_INSTALLATIONS}" WHERE platform = ? AND agentId = ?`,
      args: [platform, agentId],
    });
    const row = result.rows?.[0];
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_INSTALLATIONS}" WHERE webhookId = ?`,
      args: [webhookId],
    });
    const row = result.rows?.[0];
    return row ? this.#parseInstallationRow(row) : null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_INSTALLATIONS}" WHERE platform = ? ORDER BY createdAt DESC`,
      args: [platform],
    });
    return result.rows.map(row => this.#parseInstallationRow(row));
  }

  async deleteInstallation(id: string): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM "${TABLE_INSTALLATIONS}" WHERE id = ?`,
      args: [id],
    });
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    await this.#client.execute({
      sql: `
        INSERT INTO "${TABLE_CONFIG}" (platform, data, updatedAt)
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
      sql: `SELECT * FROM "${TABLE_CONFIG}" WHERE platform = ?`,
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
      sql: `DELETE FROM "${TABLE_CONFIG}" WHERE platform = ?`,
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
