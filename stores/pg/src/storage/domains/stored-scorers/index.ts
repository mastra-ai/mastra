import { randomUUID } from 'crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StoredScorersStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_STORED_SCORERS,
  TABLE_AGENT_SCORER_ASSIGNMENTS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageScorerType,
  StorageCreateScorerInput,
  StorageUpdateScorerInput,
  StorageListScorersInput,
  StorageListScorersOutput,
  StorageAgentScorerAssignment,
  StorageCreateAgentScorerAssignmentInput,
  StorageUpdateAgentScorerAssignmentInput,
  StorageListAgentScorerAssignmentsInput,
  StorageListAgentScorerAssignmentsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class StoredScorersPG extends StoredScorersStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_STORED_SCORERS, TABLE_AGENT_SCORER_ASSIGNMENTS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (StoredScorersPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns default index definitions for the stored scorers domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_agent_scorer_assignments_agent_id',
        table: TABLE_AGENT_SCORER_ASSIGNMENTS,
        columns: ['agentId'],
      },
      {
        name: 'idx_agent_scorer_assignments_enabled',
        table: TABLE_AGENT_SCORER_ASSIGNMENTS,
        columns: ['agentId', 'enabled'],
      },
      {
        name: 'idx_agent_scorer_assignments_unique',
        table: TABLE_AGENT_SCORER_ASSIGNMENTS,
        columns: ['agentId', 'scorerId'],
        unique: true,
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    const indexes = this.getDefaultIndexDefinitions();
    for (const indexDef of indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create default index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_STORED_SCORERS,
      schema: TABLE_SCHEMAS[TABLE_STORED_SCORERS],
    });
    await this.#db.createTable({
      tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
      schema: TABLE_SCHEMAS[TABLE_AGENT_SCORER_ASSIGNMENTS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    // Clear assignments first due to foreign key reference
    await this.#db.clearTable({ tableName: TABLE_AGENT_SCORER_ASSIGNMENTS });
    await this.#db.clearTable({ tableName: TABLE_STORED_SCORERS });
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details,
        },
        error,
      );
    }
  }

  private parseScorerRow(row: any): StorageScorerType {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string,
      type: this.parseJson(row.type, 'type'),
      judge: this.parseJson(row.judge, 'judge'),
      steps: this.parseJson(row.steps, 'steps') || [],
      sampling: this.parseJson(row.sampling, 'sampling'),
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: row.createdAtZ || row.createdAt,
      updatedAt: row.updatedAtZ || row.updatedAt,
    };
  }

  private parseAssignmentRow(row: any): StorageAgentScorerAssignment {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      scorerId: row.scorerId as string,
      sampling: this.parseJson(row.sampling, 'sampling'),
      enabled: row.enabled as boolean,
      priority: row.priority as number | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: row.createdAtZ || row.createdAt,
      updatedAt: row.updatedAtZ || row.updatedAt,
    };
  }

  // ============================================================================
  // Scorer CRUD
  // ============================================================================

  async getScorerById({ id }: { id: string }): Promise<StorageScorerType | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseScorerRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SCORER_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async createScorer({ scorer }: { scorer: StorageCreateScorerInput }): Promise<StorageScorerType> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, name, description, type, judge, steps, sampling, metadata,
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          scorer.id,
          scorer.name,
          scorer.description,
          scorer.type ? JSON.stringify(scorer.type) : null,
          scorer.judge ? JSON.stringify(scorer.judge) : null,
          JSON.stringify(scorer.steps),
          scorer.sampling ? JSON.stringify(scorer.sampling) : null,
          scorer.metadata ? JSON.stringify(scorer.metadata) : null,
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

      return {
        ...scorer,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: scorer.id },
        },
        error,
      );
    }
  }

  async updateScorer({ id, ...updates }: StorageUpdateScorerInput): Promise<StorageScorerType> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      const existingScorer = await this.getScorerById({ id });
      if (!existingScorer) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_SCORER', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Scorer ${id} not found`,
          details: { scorerId: id },
        });
      }

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.type !== undefined) {
        setClauses.push(`type = $${paramIndex++}`);
        values.push(JSON.stringify(updates.type));
      }

      if (updates.judge !== undefined) {
        setClauses.push(`judge = $${paramIndex++}`);
        values.push(JSON.stringify(updates.judge));
      }

      if (updates.steps !== undefined) {
        setClauses.push(`steps = $${paramIndex++}`);
        values.push(JSON.stringify(updates.steps));
      }

      if (updates.sampling !== undefined) {
        setClauses.push(`sampling = $${paramIndex++}`);
        values.push(JSON.stringify(updates.sampling));
      }

      if (updates.metadata !== undefined) {
        const mergedMetadata = { ...existingScorer.metadata, ...updates.metadata };
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      // Always update the updatedAt timestamp
      const now = new Date().toISOString();
      setClauses.push(`"updatedAt" = $${paramIndex++}`);
      values.push(now);
      setClauses.push(`"updatedAtZ" = $${paramIndex++}`);
      values.push(now);

      values.push(id);

      if (setClauses.length > 2) {
        await this.#db.client.none(
          `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values,
        );
      }

      const updatedScorer = await this.getScorerById({ id });
      if (!updatedScorer) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_SCORER', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Scorer ${id} not found after update`,
          details: { scorerId: id },
        });
      }

      return updatedScorer;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async deleteScorer({ id }: { id: string }): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      // Assignments will be deleted via cascade (if using foreign keys)
      // or we can delete them explicitly
      const assignmentsTable = getTableName({
        indexName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${assignmentsTable} WHERE "scorerId" = $1`, [id]);

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async listScorers(args?: StorageListScorersInput): Promise<StorageListScorersOutput> {
    const { page = 0, perPage: perPageInput, orderBy } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORERS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName}`);
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          scorers: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ORDER BY "${field}" ${direction} LIMIT $1 OFFSET $2`,
        [limitValue, offset],
      );

      const scorers = (dataResult || []).map(row => this.parseScorerRow(row));

      return {
        scorers,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORERS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ============================================================================
  // Agent-Scorer Assignments
  // ============================================================================

  async assignScorerToAgent(input: StorageCreateAgentScorerAssignmentInput): Promise<StorageAgentScorerAssignment> {
    try {
      const tableName = getTableName({
        indexName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        schemaName: getSchemaName(this.#schema),
      });

      // Check if scorer exists
      const scorer = await this.getScorerById({ id: input.scorerId });
      if (!scorer) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'ASSIGN_SCORER', 'SCORER_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Scorer ${input.scorerId} not found`,
          details: { scorerId: input.scorerId },
        });
      }

      const now = new Date();
      const nowIso = now.toISOString();
      const id = randomUUID();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "agentId", "scorerId", sampling, enabled, priority, metadata,
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          id,
          input.agentId,
          input.scorerId,
          input.sampling ? JSON.stringify(input.sampling) : null,
          input.enabled,
          input.priority ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

      return {
        id,
        agentId: input.agentId,
        scorerId: input.scorerId,
        sampling: input.sampling,
        enabled: input.enabled,
        priority: input.priority,
        metadata: input.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'ASSIGN_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: input.agentId, scorerId: input.scorerId },
        },
        error,
      );
    }
  }

  async unassignScorerFromAgent(params: { agentId: string; scorerId: string }): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        schemaName: getSchemaName(this.#schema),
      });

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "agentId" = $1 AND "scorerId" = $2`, [
        params.agentId,
        params.scorerId,
      ]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UNASSIGN_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: params.agentId, scorerId: params.scorerId },
        },
        error,
      );
    }
  }

  async listAgentScorerAssignments(
    input: StorageListAgentScorerAssignmentsInput,
  ): Promise<StorageListAgentScorerAssignmentsOutput> {
    const { agentId, enabledOnly, page = 0, perPage: perPageInput } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_ASSIGNMENTS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const tableName = getTableName({
        indexName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        schemaName: getSchemaName(this.#schema),
      });

      let whereClause = `"agentId" = $1`;
      const countParams: any[] = [agentId];
      const queryParams: any[] = [agentId];

      if (enabledOnly) {
        whereClause += ` AND enabled = true`;
      }

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`,
        countParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          assignments: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      queryParams.push(limitValue, offset);

      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName}
         WHERE ${whereClause}
         ORDER BY COALESCE(priority, 2147483647) ASC, "createdAt" ASC
         LIMIT $2 OFFSET $3`,
        queryParams,
      );

      const assignments = (dataResult || []).map(row => this.parseAssignmentRow(row));

      return {
        assignments,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_ASSIGNMENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async updateAgentScorerAssignment(
    params: StorageUpdateAgentScorerAssignmentInput,
  ): Promise<StorageAgentScorerAssignment> {
    try {
      const tableName = getTableName({
        indexName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        schemaName: getSchemaName(this.#schema),
      });

      const existingAssignment = await this.getAssignmentById({ id: params.id });
      if (!existingAssignment) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_ASSIGNMENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Assignment ${params.id} not found`,
          details: { assignmentId: params.id },
        });
      }

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (params.enabled !== undefined) {
        setClauses.push(`enabled = $${paramIndex++}`);
        values.push(params.enabled);
      }

      if (params.sampling !== undefined) {
        setClauses.push(`sampling = $${paramIndex++}`);
        values.push(JSON.stringify(params.sampling));
      }

      if (params.priority !== undefined) {
        setClauses.push(`priority = $${paramIndex++}`);
        values.push(params.priority);
      }

      if (params.metadata !== undefined) {
        const mergedMetadata = { ...existingAssignment.metadata, ...params.metadata };
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      const now = new Date().toISOString();
      setClauses.push(`"updatedAt" = $${paramIndex++}`);
      values.push(now);
      setClauses.push(`"updatedAtZ" = $${paramIndex++}`);
      values.push(now);

      values.push(params.id);

      if (setClauses.length > 2) {
        await this.#db.client.none(
          `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values,
        );
      }

      const updatedAssignment = await this.getAssignmentById({ id: params.id });
      if (!updatedAssignment) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_ASSIGNMENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Assignment ${params.id} not found after update`,
          details: { assignmentId: params.id },
        });
      }

      return updatedAssignment;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_ASSIGNMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { assignmentId: params.id },
        },
        error,
      );
    }
  }

  async getAssignmentById({ id }: { id: string }): Promise<StorageAgentScorerAssignment | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        schemaName: getSchemaName(this.#schema),
      });

      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseAssignmentRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_ASSIGNMENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { assignmentId: id },
        },
        error,
      );
    }
  }
}
