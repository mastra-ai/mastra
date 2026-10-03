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
  CreateIndexOptions,
  ChannelInstallation,
  ChannelConfig,
  ChannelThreadKey,
  ChannelThreadMapping,
  ChannelThreadMappingInput,
} from '@mastra/core/storage';

import { schemaNamePrefix } from '../../../shared/schema-name';
import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { toPgJson } from '../../db/sanitize-json';
import { getTableName, getSchemaName } from '../utils';

export class ChannelsPG extends ChannelsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_CHANNEL_INSTALLATIONS, TABLE_CHANNEL_CONFIG] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, readClient, schemaName, skipDefaultIndexes });
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
    // mastra_channel_threads lives outside TABLE_NAMES (same convention as the
    // observational-memory table), hence the cast.
    await this.#db.createTable({
      tableName: TABLE_CHANNEL_THREADS as any,
      schema: CHANNEL_THREADS_TABLE_SCHEMA[TABLE_CHANNEL_THREADS],
      compositePrimaryKey: [...CHANNEL_THREADS_PRIMARY_KEY],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}idx_channel_threads_thread_id`,
        table: TABLE_CHANNEL_THREADS,
        columns: ['threadId'],
      },
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
    ];
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? schemaNamePrefix(schemaName) : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    for (const tableName of ChannelsPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          includeAllConstraints: true,
        }),
      );
    }
    statements.push(
      generateTableSQL({
        tableName: TABLE_CHANNEL_THREADS as any,
        schema: CHANNEL_THREADS_TABLE_SCHEMA[TABLE_CHANNEL_THREADS],
        schemaName,
        compositePrimaryKey: [...CHANNEL_THREADS_PRIMARY_KEY],
        includeAllConstraints: true,
      }),
    );

    for (const idx of ChannelsPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${schemaNamePrefix(this.#schema)}_` : '';
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
    await this.#db.clearTable({ tableName: TABLE_CHANNEL_THREADS as any });
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
        toPgJson(installation.data),
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
    const row = await this.#db.readClient.oneOrNone(`SELECT * FROM ${tableName} WHERE "id" = $1`, [id]);
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByAgent(platform: string, agentId: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const row = await this.#db.readClient.oneOrNone(
      `SELECT * FROM ${tableName} WHERE "platform" = $1 AND "agentId" = $2 ORDER BY CASE "status" WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, "updatedAt" DESC LIMIT 1`,
      [platform, agentId],
    );
    return row ? this.#parseInstallationRow(row) : null;
  }

  async getInstallationByWebhookId(webhookId: string): Promise<ChannelInstallation | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const row = await this.#db.readClient.oneOrNone(`SELECT * FROM ${tableName} WHERE "webhookId" = $1`, [webhookId]);
    return row ? this.#parseInstallationRow(row) : null;
  }

  async listInstallations(platform: string): Promise<ChannelInstallation[]> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_INSTALLATIONS, schemaName });
    const rows = await this.#db.readClient.manyOrNone(
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
      [config.platform, toPgJson(config.data), now, now],
    );
  }

  async getConfig(platform: string): Promise<ChannelConfig | null> {
    const schemaName = getSchemaName(this.#schema);
    const tableName = getTableName({ indexName: TABLE_CHANNEL_CONFIG, schemaName });
    const row = await this.#db.readClient.oneOrNone(`SELECT * FROM ${tableName} WHERE "platform" = $1`, [platform]);
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

  async getThreadMapping(key: ChannelThreadKey): Promise<ChannelThreadMapping | null> {
    const tableName = this.#threadsTable();
    const row = await this.#db.readClient.oneOrNone(
      `SELECT * FROM ${tableName} WHERE "platform" = $1 AND "ownerId" = $2 AND "externalThreadId" = $3`,
      [key.platform, key.ownerId, key.externalThreadId],
    );
    return row ? this.#parseThreadMappingRow(row) : null;
  }

  async getThreadMappingByThreadId(threadId: string): Promise<ChannelThreadMapping | null> {
    const tableName = this.#threadsTable();
    const row = await this.#db.readClient.oneOrNone(`SELECT * FROM ${tableName} WHERE "threadId" = $1 LIMIT 1`, [
      threadId,
    ]);
    return row ? this.#parseThreadMappingRow(row) : null;
  }

  async upsertThreadMapping(mapping: ChannelThreadMappingInput): Promise<ChannelThreadMapping> {
    const tableName = this.#threadsTable();
    const now = new Date().toISOString();
    const subscribed = mapping.subscribed ?? null;
    // On conflict "threadId" is never changed: the first writer owns the mapping.
    const row = await this.#db.client.one(
      `INSERT INTO ${tableName} ("platform", "ownerId", "externalThreadId", "threadId", "externalChannelId", "subscribed", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::boolean, false), $7, $8, $9, $10)
       ON CONFLICT ("platform", "ownerId", "externalThreadId") DO UPDATE SET
         "externalChannelId" = EXCLUDED."externalChannelId",
         "subscribed" = COALESCE($6::boolean, ${tableName}."subscribed"),
         "updatedAt" = EXCLUDED."updatedAt",
         "updatedAtZ" = EXCLUDED."updatedAtZ"
       RETURNING *`,
      [
        mapping.platform,
        mapping.ownerId,
        mapping.externalThreadId,
        mapping.threadId,
        mapping.externalChannelId,
        subscribed,
        now,
        now,
        now,
        now,
      ],
    );
    return this.#parseThreadMappingRow(row);
  }

  async setThreadSubscribed(key: ChannelThreadKey, subscribed: boolean): Promise<void> {
    const tableName = this.#threadsTable();
    const now = new Date().toISOString();
    await this.#db.client.none(
      `UPDATE ${tableName} SET "subscribed" = $4, "updatedAt" = $5, "updatedAtZ" = $6
       WHERE "platform" = $1 AND "ownerId" = $2 AND "externalThreadId" = $3`,
      [key.platform, key.ownerId, key.externalThreadId, subscribed, now, now],
    );
  }

  async deleteThreadMapping(key: ChannelThreadKey): Promise<void> {
    const tableName = this.#threadsTable();
    await this.#db.client.none(
      `DELETE FROM ${tableName} WHERE "platform" = $1 AND "ownerId" = $2 AND "externalThreadId" = $3`,
      [key.platform, key.ownerId, key.externalThreadId],
    );
  }

  #threadsTable(): string {
    return getTableName({ indexName: TABLE_CHANNEL_THREADS, schemaName: getSchemaName(this.#schema) });
  }

  #parseThreadMappingRow(row: Record<string, unknown>): ChannelThreadMapping {
    return {
      platform: row.platform as string,
      ownerId: row.ownerId as string,
      externalThreadId: row.externalThreadId as string,
      threadId: row.threadId as string,
      externalChannelId: row.externalChannelId as string,
      subscribed: Boolean(row.subscribed),
      createdAt: new Date((row.createdAtZ as string) || (row.createdAt as string)),
      updatedAt: new Date((row.updatedAtZ as string) || (row.updatedAt as string)),
    };
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
