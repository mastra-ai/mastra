import { ChannelsStorage } from '@mastra/core/storage';
import type { ChannelInstallation, ChannelConfig } from '@mastra/core/storage';

import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

const TABLE_INSTALLATIONS = 'mastra_channel_installations';
const TABLE_CONFIG = 'mastra_channel_config';

export class ChannelsPG extends ChannelsStorage {
  #db: PgDB;
  #schema: string;

  static readonly MANAGED_TABLES = [TABLE_INSTALLATIONS, TABLE_CONFIG] as const;

  /**
   * Returns all DDL statements for this domain: tables and indexes.
   * Used by exportSchemas to produce a complete, reproducible schema export.
   */
  static getExportDDL(schemaName?: string): string[] {
    const sn = schemaName ? getSchemaName(schemaName) : '';
    const installationsTable = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName: sn });
    const configTable = getTableName({ indexName: TABLE_CONFIG, schemaName: sn });

    return [
      `CREATE TABLE IF NOT EXISTS ${installationsTable} (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT NOT NULL,
  "agentId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "webhookId" TEXT,
  "data" JSONB NOT NULL DEFAULT '{}',
  "configHash" TEXT,
  "error" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
      `CREATE TABLE IF NOT EXISTS ${configTable} (
  "platform" TEXT PRIMARY KEY,
  "data" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_installations_webhook ON ${installationsTable} ("webhookId");`,
      `CREATE INDEX IF NOT EXISTS idx_channel_installations_platform_agent ON ${installationsTable} ("platform", "agentId");`,
    ];
  }

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName });
    this.#schema = schemaName || 'public';
  }

  async init(): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const installationsTable = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    const configTable = getTableName({ indexName: TABLE_CONFIG, schemaName });

    // Create installations table
    await this.#db.client.none(`
      CREATE TABLE IF NOT EXISTS ${installationsTable} (
        "id" TEXT PRIMARY KEY,
        "platform" TEXT NOT NULL,
        "agentId" TEXT NOT NULL,
        "status" TEXT NOT NULL DEFAULT 'pending',
        "webhookId" TEXT,
        "data" JSONB NOT NULL DEFAULT '{}',
        "configHash" TEXT,
        "error" TEXT,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create config table
    await this.#db.client.none(`
      CREATE TABLE IF NOT EXISTS ${configTable} (
        "platform" TEXT PRIMARY KEY,
        "data" JSONB NOT NULL DEFAULT '{}',
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Indexes
    await this.#db.client.none(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_installations_webhook
      ON ${installationsTable} ("webhookId")
    `);
    await this.#db.client.none(`
      CREATE INDEX IF NOT EXISTS idx_channel_installations_platform_agent
      ON ${installationsTable} ("platform", "agentId")
    `);
  }

  async dangerouslyClearAll(): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const installationsTable = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    const configTable = getTableName({ indexName: TABLE_CONFIG, schemaName });
    await this.#db.client.none(`DELETE FROM ${installationsTable}`);
    await this.#db.client.none(`DELETE FROM ${configTable}`);
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    const now = new Date().toISOString();

    await this.#db.client.none(
      `INSERT INTO ${tableName} ("id", "platform", "agentId", "status", "webhookId", "data", "configHash", "error", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
       ON CONFLICT ("id") DO UPDATE SET
         "platform" = EXCLUDED."platform",
         "agentId" = EXCLUDED."agentId",
         "status" = EXCLUDED."status",
         "webhookId" = EXCLUDED."webhookId",
         "data" = EXCLUDED."data",
         "configHash" = EXCLUDED."configHash",
         "error" = EXCLUDED."error",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [
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
    );
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "id" = $1`, [id]);
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(
      `SELECT * FROM ${tableName} WHERE "platform" = $1 AND "agentId" = $2 ORDER BY CASE "status" WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, "updatedAt" DESC LIMIT 1`,
      [platform, agentId],
    );
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "webhookId" = $1`, [webhookId]);
    return row ? this.#parseInstallationRow(row) : null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    const rows = await this.#db.client.manyOrNone(
      `SELECT * FROM ${tableName} WHERE "platform" = $1 ORDER BY "createdAt" DESC`,
      [platform],
    );
    return rows.map(row => this.#parseInstallationRow(row));
  }

  async deleteInstallation(id: string): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_INSTALLATIONS, schemaName });
    await this.#db.client.none(`DELETE FROM ${tableName} WHERE "id" = $1`, [id]);
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CONFIG, schemaName });

    await this.#db.client.none(
      `INSERT INTO ${tableName} ("platform", "data", "updatedAt")
       VALUES ($1, $2::jsonb, $3)
       ON CONFLICT ("platform") DO UPDATE SET
         "data" = EXCLUDED."data",
         "updatedAt" = EXCLUDED."updatedAt"`,
      [config.platform, JSON.stringify(config.data), config.updatedAt.toISOString()],
    );
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CONFIG, schemaName });
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "platform" = $1`, [platform]);
    if (!row) return null;
    return {
      platform: row.platform as string,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data as Record<string, unknown>),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  async deleteConfig(platform: string): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CONFIG, schemaName });
    await this.#db.client.none(`DELETE FROM ${tableName} WHERE "platform" = $1`, [platform]);
  }

  #parseInstallationRow(row: Record<string, unknown>): ChannelInstallation {
    return {
      id: row.id as string,
      platform: row.platform as string,
      agentId: row.agentId as string,
      status: row.status as 'pending' | 'active' | 'error',
      webhookId: (row.webhookId as string) || undefined,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data as Record<string, unknown>),
      configHash: (row.configHash as string) || undefined,
      error: (row.error as string) || undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }
}
