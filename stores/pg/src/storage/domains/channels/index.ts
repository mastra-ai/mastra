import {
  ChannelsStorage,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_CHANNEL_CONFIG,
  TABLE_CHANNEL_STATE,
  TABLE_SCHEMAS,
  TABLE_CONFIGS,
} from '@mastra/core/storage';
import type { CreateIndexOptions, ChannelInstallation, ChannelConfig, ChannelStateEntry } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class ChannelsPG extends ChannelsStorage {
  override readonly supportsChannelState = true;

  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_CHANNEL_INSTALLATIONS, TABLE_CHANNEL_CONFIG, TABLE_CHANNEL_STATE] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (ChannelsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
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
    await this.#db.createTable({
      tableName: TABLE_CHANNEL_STATE,
      schema: TABLE_SCHEMAS[TABLE_CHANNEL_STATE],
      compositePrimaryKey: TABLE_CONFIGS[TABLE_CHANNEL_STATE]?.compositePrimaryKey,
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}idx_channel_installations_webhook`,
        table: TABLE_CHANNEL_INSTALLATIONS,
        columns: ['webhookId'],
        unique: true,
      },
      {
        name: `${schemaPrefix}idx_channel_installations_platform_agent`,
        table: TABLE_CHANNEL_INSTALLATIONS,
        columns: ['platform', 'agentId'],
      },
      {
        name: `${schemaPrefix}idx_channel_state_expires_at`,
        table: TABLE_CHANNEL_STATE,
        columns: ['expiresAt'],
      },
    ];
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    for (const tableName of ChannelsPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          includeAllConstraints: true,
          compositePrimaryKey: TABLE_CONFIGS[tableName]?.compositePrimaryKey,
        }),
      );
    }

    for (const idx of ChannelsPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return ChannelsPG.getDefaultIndexDefs(schemaPrefix);
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_CHANNEL_INSTALLATIONS });
    await this.#db.clearTable({ tableName: TABLE_CHANNEL_CONFIG });
    await this.#db.clearTable({ tableName: TABLE_CHANNEL_STATE });
  }

  async saveInstallation(installation: ChannelInstallation): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const now = new Date().toISOString();
    const createdAt = installation.createdAt?.toISOString() ?? now;

    await this.#db.client.none(
      `INSERT INTO ${tableName} ("id", "platform", "agentId", "status", "webhookId", "data", "configHash", "error", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)
       ON CONFLICT ("id") DO UPDATE SET
         "platform" = EXCLUDED."platform",
         "agentId" = EXCLUDED."agentId",
         "status" = EXCLUDED."status",
         "webhookId" = EXCLUDED."webhookId",
         "data" = EXCLUDED."data",
         "configHash" = EXCLUDED."configHash",
         "error" = EXCLUDED."error",
         "updatedAt" = EXCLUDED."updatedAt",
         "updatedAtZ" = EXCLUDED."updatedAtZ"`,
      [
        installation.id,
        installation.platform,
        installation.agentId,
        installation.status,
        installation.webhookId ?? null,
        JSON.stringify(installation.data),
        installation.configHash ?? null,
        installation.error ?? null,
        createdAt,
        createdAt,
        now,
        now,
      ],
    );
  }

  async getInstallation(id: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "id" = $1`, [id]);
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(
      `SELECT * FROM ${tableName} WHERE "platform" = $1 AND "agentId" = $2 ORDER BY CASE "status" WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, "updatedAt" DESC LIMIT 1`,
      [platform, agentId],
    );
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "webhookId" = $1`, [webhookId]);
    return row ? this.#parseInstallationRow(row) : null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const rows = await this.#db.client.manyOrNone(
      `SELECT * FROM ${tableName} WHERE "platform" = $1 ORDER BY "createdAt" DESC`,
      [platform],
    );
    return rows.map(row => this.#parseInstallationRow(row));
  }

  async deleteInstallation(id: string): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    await this.#db.client.none(`DELETE FROM ${tableName} WHERE "id" = $1`, [id]);
  }

  async saveConfig(config: ChannelConfig): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_CONFIG, schemaName });
    const now = config.updatedAt.toISOString();

    await this.#db.client.none(
      `INSERT INTO ${tableName} ("platform", "data", "updatedAt", "updatedAtZ")
       VALUES ($1, $2::jsonb, $3, $4)
       ON CONFLICT ("platform") DO UPDATE SET
         "data" = EXCLUDED."data",
         "updatedAt" = EXCLUDED."updatedAt",
         "updatedAtZ" = EXCLUDED."updatedAtZ"`,
      [config.platform, JSON.stringify(config.data), now, now],
    );
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_CONFIG, schemaName });
    const row = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "platform" = $1`, [platform]);
    if (!row) return null;
    return {
      platform: row.platform as string,
      data: typeof row.data === 'string' ? JSON.parse(row.data) : (row.data as Record<string, unknown>),
      updatedAt: new Date((row.updatedAtZ as string) || (row.updatedAt as string)),
    };
  }

  async deleteConfig(platform: string): Promise<void> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_CONFIG, schemaName });
    await this.#db.client.none(`DELETE FROM ${tableName} WHERE "platform" = $1`, [platform]);
  }

  #stateTable(): string {
    return getTableName({ indexName: TABLE_CHANNEL_STATE, schemaName: getSchemaName(this.#schema) });
  }

  async getState(ownerId: string, key: string): Promise<ChannelStateEntry | null> {
    const row = await this.#db.client.oneOrNone(
      `SELECT "value" FROM ${this.#stateTable()}
       WHERE "ownerId" = $1 AND "key" = $2 AND ("expiresAt" IS NULL OR "expiresAt" > $3)`,
      [ownerId, key, Date.now()],
    );
    if (!row) return null;
    // pg already decodes jsonb, so row.value is the value itself, not JSON text.
    return { value: row.value };
  }

  async setState(ownerId: string, key: string, value: unknown, expiresAt: number | null): Promise<void> {
    const now = new Date().toISOString();
    await this.#db.client.none(
      `INSERT INTO ${this.#stateTable()} ("ownerId", "key", "value", "expiresAt", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
       ON CONFLICT ("ownerId", "key") DO UPDATE SET
         "value" = EXCLUDED."value",
         "expiresAt" = EXCLUDED."expiresAt",
         "updatedAt" = EXCLUDED."updatedAt",
         "updatedAtZ" = EXCLUDED."updatedAtZ"`,
      [ownerId, key, JSON.stringify(value ?? null), expiresAt, now, now, now, now],
    );
  }

  async setStateIfNotExists(ownerId: string, key: string, value: unknown, expiresAt: number | null): Promise<boolean> {
    const now = new Date().toISOString();
    // One statement, so two processes racing on the same key cannot both win. The WHERE
    // on the DO UPDATE makes an expired row claimable while leaving a live one untouched;
    // no row returned therefore means "someone else holds it".
    const claimed = await this.#db.client.oneOrNone(
      `INSERT INTO ${this.#stateTable()} AS existing ("ownerId", "key", "value", "expiresAt", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8)
       ON CONFLICT ("ownerId", "key") DO UPDATE SET
         "value" = EXCLUDED."value",
         "expiresAt" = EXCLUDED."expiresAt",
         "updatedAt" = EXCLUDED."updatedAt",
         "updatedAtZ" = EXCLUDED."updatedAtZ"
       WHERE existing."expiresAt" IS NOT NULL AND existing."expiresAt" <= $9
       RETURNING "key"`,
      [ownerId, key, JSON.stringify(value ?? null), expiresAt, now, now, now, now, Date.now()],
    );
    return claimed !== null;
  }

  async deleteState(ownerId: string, key: string): Promise<void> {
    await this.#db.client.none(`DELETE FROM ${this.#stateTable()} WHERE "ownerId" = $1 AND "key" = $2`, [ownerId, key]);
  }

  async deleteExpiredState(now: number): Promise<void> {
    await this.#db.client.none(
      `DELETE FROM ${this.#stateTable()} WHERE "expiresAt" IS NOT NULL AND "expiresAt" <= $1`,
      [now],
    );
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
      createdAt: new Date((row.createdAtZ as string) || (row.createdAt as string)),
      updatedAt: new Date((row.updatedAtZ as string) || (row.updatedAt as string)),
    };
  }
}
