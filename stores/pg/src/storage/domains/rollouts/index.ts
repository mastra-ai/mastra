import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  TABLE_ROLLOUTS,
  TABLE_SCHEMAS,
  ROLLOUTS_SCHEMA,
  RolloutsStorage,
  calculatePagination,
  normalizePerPage,
  ensureDate,
} from '@mastra/core/storage';
import type {
  RolloutRecord,
  RolloutStatus,
  CreateRolloutInput,
  UpdateRolloutInput,
  ListRolloutsInput,
  ListRolloutsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class RolloutsPG extends RolloutsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_ROLLOUTS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (RolloutsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    for (const tableName of RolloutsPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          includeAllConstraints: true,
        }),
      );
    }
    return statements;
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_ROLLOUTS, schema: ROLLOUTS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_rollouts_agentid_status',
        table: TABLE_ROLLOUTS,
        columns: ['agentId', 'status'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create default index ${indexDef.name}:`, error);
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
    await this.#db.clearTable({ tableName: TABLE_ROLLOUTS });
  }

  private transformRow(row: Record<string, any>): RolloutRecord {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      type: row.type as RolloutRecord['type'],
      status: row.status as RolloutRecord['status'],
      stableVersionId: row.stableVersionId as string,
      allocations: typeof row.allocations === 'string' ? JSON.parse(row.allocations) : (row.allocations ?? []),
      routingKey: (row.routingKey as string | null) ?? undefined,
      rules: row.rules ? (typeof row.rules === 'string' ? JSON.parse(row.rules) : row.rules) : undefined,
      createdAt: ensureDate(row.createdAtZ || row.createdAt)!,
      updatedAt: ensureDate(row.updatedAtZ || row.updatedAt)!,
      completedAt: row.completedAt ? ensureDate(row.completedAtZ || row.completedAt)! : null,
    };
  }

  async getActiveRollout(agentId: string): Promise<RolloutRecord | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_ROLLOUTS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 AND "status" = 'active' LIMIT 1`,
        [agentId],
      );
      return result ? this.transformRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_ACTIVE_ROLLOUT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getRollout(id: string): Promise<RolloutRecord | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_ROLLOUTS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE "id" = $1`, [id]);
      return result ? this.transformRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_ROLLOUT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async createRollout(input: CreateRolloutInput): Promise<RolloutRecord> {
    try {
      const id = input.id ?? `rol_${crypto.randomUUID()}`;
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.insert({
        tableName: TABLE_ROLLOUTS,
        record: {
          id,
          agentId: input.agentId,
          type: input.type,
          status: 'active',
          stableVersionId: input.stableVersionId,
          allocations: JSON.stringify(input.allocations),
          routingKey: input.routingKey ?? null,
          rules: input.rules ? JSON.stringify(input.rules) : null,
          createdAt: nowIso,
          updatedAt: nowIso,
          completedAt: null,
        },
      });

      return {
        id,
        agentId: input.agentId,
        type: input.type,
        status: 'active',
        stableVersionId: input.stableVersionId,
        allocations: input.allocations,
        routingKey: input.routingKey,
        rules: input.rules,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_ROLLOUT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateRollout(input: UpdateRolloutInput): Promise<RolloutRecord> {
    try {
      const existing = await this.getRollout(input.id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_ROLLOUT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { rolloutId: input.id },
        });
      }
      if (existing.status !== 'active') {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_ROLLOUT', 'INVALID_STATUS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { rolloutId: input.id, status: existing.status },
        });
      }

      const tableName = getTableName({ indexName: TABLE_ROLLOUTS, schemaName: getSchemaName(this.#schema) });
      const now = new Date().toISOString();
      const setClauses: string[] = ['"updatedAt" = $1', '"updatedAtZ" = $2'];
      const values: any[] = [now, now];
      let paramIndex = 3;

      if (input.allocations) {
        setClauses.push(`"allocations" = $${paramIndex++}`);
        values.push(JSON.stringify(input.allocations));
      }
      if (input.rules) {
        setClauses.push(`"rules" = $${paramIndex++}`);
        values.push(JSON.stringify(input.rules));
      }

      values.push(input.id);
      await this.#db.client.none(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE "id" = $${paramIndex}`,
        values,
      );

      return (await this.getRollout(input.id))!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_ROLLOUT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async completeRollout(id: string, status: RolloutStatus, completedAt?: Date): Promise<RolloutRecord> {
    try {
      const existing = await this.getRollout(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'COMPLETE_ROLLOUT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { rolloutId: id },
        });
      }

      const tableName = getTableName({ indexName: TABLE_ROLLOUTS, schemaName: getSchemaName(this.#schema) });
      const now = completedAt ?? new Date();
      const nowIso = now.toISOString();
      await this.#db.client.none(
        `UPDATE ${tableName} SET "status" = $1, "updatedAt" = $2, "updatedAtZ" = $3, "completedAt" = $4, "completedAtZ" = $5 WHERE "id" = $6`,
        [status, nowIso, nowIso, nowIso, nowIso, id],
      );

      return (await this.getRollout(id))!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COMPLETE_ROLLOUT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listRollouts(input: ListRolloutsInput): Promise<ListRolloutsOutput> {
    try {
      const { page, perPage: perPageInput } = input.pagination;
      const tableName = getTableName({ indexName: TABLE_ROLLOUTS, schemaName: getSchemaName(this.#schema) });

      // Count total
      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "agentId" = $1`, [
        input.agentId,
      ]);
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return { rollouts: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`,
        [input.agentId, limitValue, offset],
      );

      return {
        rollouts: rows.map((row: Record<string, any>) => this.transformRow(row)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: total > offset + limitValue,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_ROLLOUTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
