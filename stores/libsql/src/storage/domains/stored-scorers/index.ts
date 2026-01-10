import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StoredScorersStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_STORED_SCORERS,
  TABLE_AGENT_SCORER_ASSIGNMENTS,
  STORED_SCORERS_SCHEMA,
  AGENT_SCORER_ASSIGNMENTS_SCHEMA,
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
} from '@mastra/core/storage';
import { randomUUID } from 'crypto';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

export class StoredScorersLibSQL extends StoredScorersStorage {
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_STORED_SCORERS, schema: STORED_SCORERS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_AGENT_SCORER_ASSIGNMENTS, schema: AGENT_SCORER_ASSIGNMENTS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_STORED_SCORERS });
    await this.#db.deleteData({ tableName: TABLE_AGENT_SCORER_ASSIGNMENTS });
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
          id: createStorageErrorId('LIBSQL', 'PARSE_JSON', 'INVALID_JSON'),
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
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  private parseAssignmentRow(row: any): StorageAgentScorerAssignment {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      scorerId: row.scorerId as string,
      sampling: this.parseJson(row.sampling, 'sampling'),
      enabled: Boolean(row.enabled),
      priority: row.priority != null ? Number(row.priority) : undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  // ============================================================================
  // Scorer Definition CRUD
  // ============================================================================

  async getScorerById({ id }: { id: string }): Promise<StorageScorerType | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_STORED_SCORERS,
        keys: { id },
      });

      return result ? this.parseScorerRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_SCORER_BY_ID', 'FAILED'),
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
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_STORED_SCORERS,
        record: {
          id: scorer.id,
          name: scorer.name,
          description: scorer.description,
          type: scorer.type ? JSON.stringify(scorer.type) : null,
          judge: scorer.judge ? JSON.stringify(scorer.judge) : null,
          steps: JSON.stringify(scorer.steps),
          sampling: scorer.sampling ? JSON.stringify(scorer.sampling) : null,
          metadata: scorer.metadata ? JSON.stringify(scorer.metadata) : null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      return {
        ...scorer,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_SCORER', 'FAILED'),
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
      const existingScorer = await this.getScorerById({ id });
      if (!existingScorer) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Scorer ${id} not found`,
          details: { scorerId: id },
        });
      }

      const data: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.type !== undefined) data.type = JSON.stringify(updates.type);
      if (updates.judge !== undefined) data.judge = JSON.stringify(updates.judge);
      if (updates.steps !== undefined) data.steps = JSON.stringify(updates.steps);
      if (updates.sampling !== undefined) data.sampling = JSON.stringify(updates.sampling);
      if (updates.metadata !== undefined) {
        data.metadata = JSON.stringify({ ...existingScorer.metadata, ...updates.metadata });
      }

      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_STORED_SCORERS,
          keys: { id },
          data,
        });
      }

      const updatedScorer = await this.getScorerById({ id });
      if (!updatedScorer) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER', 'NOT_FOUND_AFTER_UPDATE'),
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
          id: createStorageErrorId('LIBSQL', 'UPDATE_SCORER', 'FAILED'),
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
      // Delete all assignments for this scorer first
      const assignments = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        whereClause: { sql: 'WHERE "scorerId" = ?', args: [id] },
      });

      if (assignments.length > 0) {
        await this.#db.batchDelete({
          tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
          keys: assignments.map(a => ({ id: a.id })),
        });
      }

      // Delete the scorer
      await this.#db.delete({
        tableName: TABLE_STORED_SCORERS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_SCORER', 'FAILED'),
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
          id: createStorageErrorId('LIBSQL', 'LIST_SCORERS', 'INVALID_PAGE'),
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
      const total = await this.#db.selectTotalCount({ tableName: TABLE_STORED_SCORERS });

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
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_STORED_SCORERS,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
      });

      const scorers = rows.map(row => this.parseScorerRow(row));

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
          id: createStorageErrorId('LIBSQL', 'LIST_SCORERS', 'FAILED'),
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
      // Verify scorer exists
      const scorer = await this.getScorerById({ id: input.scorerId });
      if (!scorer) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'ASSIGN_SCORER', 'SCORER_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Scorer ${input.scorerId} not found`,
          details: { scorerId: input.scorerId },
        });
      }

      // Check for existing assignment
      const existingRows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        whereClause: { sql: 'WHERE "agentId" = ? AND "scorerId" = ?', args: [input.agentId, input.scorerId] },
        limit: 1,
      });

      if (existingRows.length > 0) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'ASSIGN_SCORER', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Assignment already exists for agent ${input.agentId} and scorer ${input.scorerId}`,
          details: { agentId: input.agentId, scorerId: input.scorerId },
        });
      }

      const now = new Date();
      const id = randomUUID();

      await this.#db.insert({
        tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        record: {
          id,
          agentId: input.agentId,
          scorerId: input.scorerId,
          sampling: input.sampling ? JSON.stringify(input.sampling) : null,
          enabled: input.enabled ? 1 : 0,
          priority: input.priority ?? null,
          metadata: input.metadata ? JSON.stringify(input.metadata) : null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

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
          id: createStorageErrorId('LIBSQL', 'ASSIGN_SCORER', 'FAILED'),
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
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        whereClause: { sql: 'WHERE "agentId" = ? AND "scorerId" = ?', args: [params.agentId, params.scorerId] },
        limit: 1,
      });

      if (rows.length > 0 && rows[0]) {
        await this.#db.delete({
          tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
          keys: { id: rows[0].id as string },
        });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UNASSIGN_SCORER', 'FAILED'),
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
          id: createStorageErrorId('LIBSQL', 'LIST_ASSIGNMENTS', 'INVALID_PAGE'),
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
      let whereClause: { sql: string; args: any[] };
      if (enabledOnly) {
        whereClause = { sql: 'WHERE "agentId" = ? AND "enabled" = 1', args: [agentId] };
      } else {
        whereClause = { sql: 'WHERE "agentId" = ?', args: [agentId] };
      }

      const total = await this.#db.selectTotalCount({ tableName: TABLE_AGENT_SCORER_ASSIGNMENTS, whereClause });

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
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        whereClause,
        orderBy: 'COALESCE("priority", 2147483647) ASC, "createdAt" ASC',
        limit: limitValue,
        offset,
      });

      const assignments = rows.map(row => this.parseAssignmentRow(row));

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
          id: createStorageErrorId('LIBSQL', 'LIST_ASSIGNMENTS', 'FAILED'),
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
      const existing = await this.getAssignmentById({ id: params.id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_ASSIGNMENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Assignment ${params.id} not found`,
          details: { assignmentId: params.id },
        });
      }

      const data: Record<string, any> = {
        updatedAt: new Date().toISOString(),
      };

      if (params.enabled !== undefined) data.enabled = params.enabled ? 1 : 0;
      if (params.sampling !== undefined) data.sampling = JSON.stringify(params.sampling);
      if (params.priority !== undefined) data.priority = params.priority;
      if (params.metadata !== undefined) {
        data.metadata = JSON.stringify({ ...existing.metadata, ...params.metadata });
      }

      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
          keys: { id: params.id },
          data,
        });
      }

      const updated = await this.getAssignmentById({ id: params.id });
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_ASSIGNMENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Assignment ${params.id} not found after update`,
          details: { assignmentId: params.id },
        });
      }

      return updated;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_ASSIGNMENT', 'FAILED'),
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
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_AGENT_SCORER_ASSIGNMENTS,
        keys: { id },
      });

      return result ? this.parseAssignmentRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_ASSIGNMENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { assignmentId: id },
        },
        error,
      );
    }
  }
}
