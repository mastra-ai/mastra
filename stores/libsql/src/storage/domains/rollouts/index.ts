import type { Client, InValue } from '@libsql/client';
import {
  TABLE_ROLLOUTS,
  ROLLOUTS_SCHEMA,
  RolloutsStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  ensureDate,
} from '@mastra/core/storage';
import type {
  RolloutRecord,
  RolloutStatus,
  CreateRolloutInput,
  UpdateRolloutInput,
  ListRolloutsInput,
  ListRolloutsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class RolloutsLibSQL extends RolloutsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_ROLLOUTS, schema: ROLLOUTS_SCHEMA });

    // Index for looking up the active rollout per agent
    await this.#client.execute({
      sql: `CREATE INDEX IF NOT EXISTS idx_rollouts_agentid_status ON "${TABLE_ROLLOUTS}" ("agentId", "status")`,
      args: [],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_ROLLOUTS });
  }

  private transformRow(row: Record<string, unknown>): RolloutRecord {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      type: row.type as RolloutRecord['type'],
      status: row.status as RolloutRecord['status'],
      stableVersionId: row.stableVersionId as string,
      allocations: safelyParseJSON(row.allocations as string) ?? [],
      routingKey: (row.routingKey as string | null) ?? undefined,
      rules: row.rules ? safelyParseJSON(row.rules as string) : undefined,
      createdAt: ensureDate(row.createdAt as string | Date)!,
      updatedAt: ensureDate(row.updatedAt as string | Date)!,
      completedAt: row.completedAt ? ensureDate(row.completedAt as string | Date)! : null,
    };
  }

  async getActiveRollout(agentId: string): Promise<RolloutRecord | null> {
    const cols = buildSelectColumns(TABLE_ROLLOUTS);
    const result = await this.#client.execute({
      sql: `SELECT ${cols} FROM "${TABLE_ROLLOUTS}" WHERE "agentId" = ? AND "status" = 'active' LIMIT 1`,
      args: [agentId],
    });
    if (!result.rows.length) return null;
    return this.transformRow(result.rows[0] as unknown as Record<string, unknown>);
  }

  async getRollout(id: string): Promise<RolloutRecord | null> {
    const cols = buildSelectColumns(TABLE_ROLLOUTS);
    const result = await this.#client.execute({
      sql: `SELECT ${cols} FROM "${TABLE_ROLLOUTS}" WHERE "id" = ? LIMIT 1`,
      args: [id],
    });
    if (!result.rows.length) return null;
    return this.transformRow(result.rows[0] as unknown as Record<string, unknown>);
  }

  async createRollout(input: CreateRolloutInput): Promise<RolloutRecord> {
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
  }

  async updateRollout(input: UpdateRolloutInput): Promise<RolloutRecord> {
    const existing = await this.getRollout(input.id);
    if (!existing) {
      throw new Error(`Rollout not found: ${input.id}`);
    }
    if (existing.status !== 'active') {
      throw new Error(`Cannot update rollout with status: ${existing.status}`);
    }

    const updates: Record<string, InValue> = {
      updatedAt: new Date().toISOString(),
    };
    if (input.allocations) {
      updates.allocations = JSON.stringify(input.allocations);
    }
    if (input.rules) {
      updates.rules = JSON.stringify(input.rules);
    }

    await this.#db.update({
      tableName: TABLE_ROLLOUTS,
      keys: { id: input.id },
      data: updates,
    });

    return this.getRollout(input.id) as Promise<RolloutRecord>;
  }

  async completeRollout(id: string, status: RolloutStatus, completedAt?: Date): Promise<RolloutRecord> {
    const existing = await this.getRollout(id);
    if (!existing) {
      throw new Error(`Rollout not found: ${id}`);
    }

    const now = completedAt ?? new Date();
    await this.#db.update({
      tableName: TABLE_ROLLOUTS,
      keys: { id },
      data: {
        status,
        updatedAt: now.toISOString(),
        completedAt: now.toISOString(),
      },
    });

    return this.getRollout(id) as Promise<RolloutRecord>;
  }

  async listRollouts(input: ListRolloutsInput): Promise<ListRolloutsOutput> {
    const cols = buildSelectColumns(TABLE_ROLLOUTS);
    const { page, perPage: perPageInput } = input.pagination;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    // Count total
    const countResult = await this.#client.execute({
      sql: `SELECT COUNT(*) as total FROM "${TABLE_ROLLOUTS}" WHERE "agentId" = ?`,
      args: [input.agentId],
    });
    const total = Number(countResult.rows[0]?.total ?? 0);

    // Fetch page
    const result = await this.#client.execute({
      sql: `SELECT ${cols} FROM "${TABLE_ROLLOUTS}" WHERE "agentId" = ? ORDER BY "createdAt" DESC LIMIT ? OFFSET ?`,
      args: [input.agentId, perPage, offset],
    });

    return {
      rollouts: result.rows.map(row => this.transformRow(row as unknown as Record<string, unknown>)),
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: total > offset + perPage,
      },
    };
  }
}
