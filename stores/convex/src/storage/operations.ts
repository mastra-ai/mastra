import crypto from 'node:crypto';

import { TABLE_WORKFLOW_SNAPSHOT, type TABLE_NAMES } from '@mastra/core/storage';
import type { StorageColumn } from '@mastra/core/storage';

import { StoreOperations } from '@mastra/core/storage/domains/operations/base';

import type { EqualityFilter } from './types';
import type { ConvexAdminClient } from './client';

export class StoreOperationsConvex extends StoreOperations {
  constructor(private readonly client: ConvexAdminClient) {
    super();
  }

  async hasColumn(_table: string, _column: string): Promise<boolean> {
    return true;
  }

  async createTable(_args: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    // No-op for Convex; schema is managed server-side.
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.client.callStorage({
      op: 'clearTable',
      tableName,
    });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.client.callStorage({
      op: 'dropTable',
      tableName,
    });
  }

  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // No-op; columns are implicit in Convex documents.
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    await this.client.callStorage({
      op: 'insert',
      tableName,
      record: this.normalizeRecord(tableName, record),
    });
  }

  async batchInsert({
    tableName,
    records,
  }: {
    tableName: TABLE_NAMES;
    records: Record<string, any>[];
  }): Promise<void> {
    if (records.length === 0) return;

    await this.client.callStorage({
      op: 'batchInsert',
      tableName,
      records: records.map(record => this.normalizeRecord(tableName, record)),
    });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    const result = await this.client.callStorage<R | null>({
      op: 'load',
      tableName,
      keys,
    });

    return result;
  }

  public async queryTable<R>(tableName: TABLE_NAMES, filters?: EqualityFilter[]): Promise<R[]> {
    return this.client.callStorage<R[]>({
      op: 'queryTable',
      tableName,
      filters,
    });
  }

  public async deleteMany(tableName: TABLE_NAMES, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.client.callStorage({
      op: 'deleteMany',
      tableName,
      ids,
    });
  }

  private normalizeRecord(tableName: TABLE_NAMES, record: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = { ...record };

    if (tableName === TABLE_WORKFLOW_SNAPSHOT && !normalized.id) {
      const runId = normalized.run_id || normalized.runId;
      const workflowName = normalized.workflow_name || normalized.workflowName;
      normalized.id = workflowName ? `${workflowName}-${runId}` : runId;
    }

    if (!normalized.id) {
      normalized.id = crypto.randomUUID();
    }

    for (const [key, value] of Object.entries(normalized)) {
      if (value instanceof Date) {
        normalized[key] = value.toISOString();
      }
    }

    return normalized;
  }
}
