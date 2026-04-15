import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  RolloutsStorage,
  createStorageErrorId,
  TABLE_ROLLOUTS,
  normalizePerPage,
  calculatePagination,
  safelyParseJSON,
} from '@mastra/core/storage';
import type {
  RolloutRecord,
  RolloutStatus,
  CreateRolloutInput,
  UpdateRolloutInput,
  ListRolloutsInput,
  ListRolloutsOutput,
  RolloutAllocation,
  RolloutRule,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return toDate(value);
}

function parseJsonField<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return safelyParseJSON(value) as T;
  return value as T;
}

function transformRolloutRow(row: Record<string, unknown>): RolloutRecord {
  return {
    id: row.id as string,
    agentId: row.agentId as string,
    type: row.type as RolloutRecord['type'],
    status: row.status as RolloutRecord['status'],
    stableVersionId: row.stableVersionId as string,
    allocations: parseJsonField<RolloutAllocation[]>(row.allocations) ?? [],
    routingKey: (row.routingKey as string | undefined) ?? undefined,
    rules: parseJsonField<RolloutRule[]>(row.rules) ?? undefined,
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    completedAt: toDateOrNull(row.completedAt),
  };
}

// ---------------------------------------------------------------------------
// MongoDB Rollouts Storage
// ---------------------------------------------------------------------------

export class MongoDBRolloutsStorage extends RolloutsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_ROLLOUTS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBRolloutsStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  // -------------------------------------------------------------------------
  // Index Management
  // -------------------------------------------------------------------------

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_ROLLOUTS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_ROLLOUTS, keys: { agentId: 1, status: 1 } },
      { collection: TABLE_ROLLOUTS, keys: { agentId: 1, createdAt: -1 } },
      {
        collection: TABLE_ROLLOUTS,
        keys: { agentId: 1 },
        options: { unique: true, partialFilterExpression: { status: 'active' } },
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        if (indexDef.options?.unique) {
          // Unique indexes are critical for invariants — don't swallow failures
          throw error;
        }
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_ROLLOUTS);
      await collection.deleteMany({});
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ROLLOUTS', 'CLEAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async getActiveRollout(agentId: string): Promise<RolloutRecord | null> {
    try {
      const collection = await this.getCollection(TABLE_ROLLOUTS);
      const doc = await collection.findOne({ agentId, status: 'active' });
      if (!doc) return null;
      return transformRolloutRow(doc as Record<string, unknown>);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ROLLOUTS', 'GET_ACTIVE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getRollout(id: string): Promise<RolloutRecord | null> {
    try {
      const collection = await this.getCollection(TABLE_ROLLOUTS);
      const doc = await collection.findOne({ id });
      if (!doc) return null;
      return transformRolloutRow(doc as Record<string, unknown>);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ROLLOUTS', 'GET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async createRollout(input: CreateRolloutInput): Promise<RolloutRecord> {
    try {
      const now = new Date();
      const record: RolloutRecord = {
        id: input.id ?? `rol_${randomUUID()}`,
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

      const collection = await this.getCollection(TABLE_ROLLOUTS);
      await collection.insertOne({ ...record });
      return record;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ROLLOUTS', 'CREATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async updateRollout(input: UpdateRolloutInput): Promise<RolloutRecord> {
    try {
      const collection = await this.getCollection(TABLE_ROLLOUTS);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (input.allocations) updateData.allocations = input.allocations;
      if (input.rules) updateData.rules = input.rules;

      const updated = await collection.findOneAndUpdate(
        { id: input.id, status: 'active' },
        { $set: updateData },
        { returnDocument: 'after' },
      );
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('ROLLOUTS', 'UPDATE', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { rolloutId: input.id },
        });
      }
      return transformRolloutRow(updated as Record<string, unknown>);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('ROLLOUTS', 'UPDATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async completeRollout(id: string, status: RolloutStatus, completedAt?: Date): Promise<RolloutRecord> {
    try {
      const now = completedAt ?? new Date();
      const collection = await this.getCollection(TABLE_ROLLOUTS);
      const updated = await collection.findOneAndUpdate(
        { id, status: 'active' },
        { $set: { status, updatedAt: now, completedAt: now } },
        { returnDocument: 'after' },
      );
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('ROLLOUTS', 'COMPLETE', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { rolloutId: id },
        });
      }
      return transformRolloutRow(updated as Record<string, unknown>);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('ROLLOUTS', 'COMPLETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listRollouts(input: ListRolloutsInput): Promise<ListRolloutsOutput> {
    try {
      const collection = await this.getCollection(TABLE_ROLLOUTS);
      const filter = { agentId: input.agentId };

      const total = await collection.countDocuments(filter);

      const { page, perPage: perPageInput } = input.pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const cursor = collection.find(filter).sort({ createdAt: -1 }).skip(offset);
      const docs = await (perPageInput === false ? cursor : cursor.limit(perPage)).toArray();

      return {
        rollouts: docs.map(doc => transformRolloutRow(doc as Record<string, unknown>)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : total > offset + perPage,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('ROLLOUTS', 'LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
