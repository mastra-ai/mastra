import { MastraBase } from '@mastra/core/base';
import type { StorageThreadType } from '@mastra/core/memory';
import {
  TABLE_RESOURCES,
  TABLE_SCHEDULES,
  TABLE_SCHEDULE_TRIGGERS,
  TABLE_THREADS,
  TABLE_WORKFLOW_SNAPSHOT,
} from '@mastra/core/storage';
import type { StorageColumn, StorageResourceType, UpdateWorkflowStateOptions } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';

import { ConvexAdminClient } from '../client';
import { TABLE_OBSERVATIONAL_MEMORY } from '../types';
import type {
  ConvexStorageTable,
  EqualityFilter,
  IndexHint,
  SerializedOMChunk,
  SerializedOMCurrentRecord,
} from '../types';

// Must not exceed the server-side loadMany id cap in server/storage.ts.
const LOAD_MANY_REQUEST_BATCH_SIZE = 10;

/**
 * Configuration for standalone domain usage.
 * Accepts either:
 * 1. An existing ConvexAdminClient
 * 2. Config to create a new client internally
 */
export type ConvexDomainConfig = ConvexDomainClientConfig | ConvexDomainRestConfig;

/**
 * Pass an existing ConvexAdminClient
 */
export interface ConvexDomainClientConfig {
  client: ConvexAdminClient;
}

/**
 * Pass config to create a new ConvexAdminClient internally
 */
export interface ConvexDomainRestConfig {
  deploymentUrl: string;
  adminAuthToken: string;
  storageFunction?: string;
}

/**
 * Resolves ConvexDomainConfig to a ConvexAdminClient.
 * Handles creating a new client if config is provided.
 */
export function resolveConvexConfig(config: ConvexDomainConfig): ConvexAdminClient {
  // Existing client
  if ('client' in config) {
    return config.client;
  }

  // Config to create new client
  return new ConvexAdminClient(config);
}

export class ConvexDB extends MastraBase {
  constructor(private readonly client: ConvexAdminClient) {
    super({ name: 'convex-db' });
  }

  async hasColumn(_table: string, _column: string): Promise<boolean> {
    return true;
  }

  async createTable({
    tableName,
    schema: _schema,
  }: {
    tableName: ConvexStorageTable;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // No-op for Convex; schema is managed server-side via schema.ts
    this.logger.debug(`ConvexDB: createTable called for ${tableName} (schema managed server-side)`);
  }

  async alterTable({
    tableName,
    schema: _schema,
    ifNotExists: _ifNotExists,
  }: {
    tableName: ConvexStorageTable;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // No-op for Convex; schema is managed server-side via schema.ts
    this.logger.debug(`ConvexDB: alterTable called for ${tableName} (schema managed server-side)`);
  }

  async clearTable({ tableName }: { tableName: ConvexStorageTable }): Promise<void> {
    // Delete in batches since each mutation can only delete a small number of docs
    // to stay within Convex's 1-second mutation timeout.
    let hasMore = true;
    while (hasMore) {
      const response = await this.client.callStorageRaw({
        op: 'clearTable',
        tableName,
      });
      hasMore = response.hasMore ?? false;
    }
  }

  async dropTable({ tableName }: { tableName: ConvexStorageTable }): Promise<void> {
    // Delete in batches since each mutation can only delete a small number of docs
    // to stay within Convex's 1-second mutation timeout.
    let hasMore = true;
    while (hasMore) {
      const response = await this.client.callStorageRaw({
        op: 'dropTable',
        tableName,
      });
      hasMore = response.hasMore ?? false;
    }
  }

  async insert({ tableName, record }: { tableName: ConvexStorageTable; record: Record<string, any> }): Promise<void> {
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
    tableName: ConvexStorageTable;
    records: Record<string, any>[];
  }): Promise<void> {
    if (records.length === 0) return;

    await this.client.callStorage({
      op: 'batchInsert',
      tableName,
      records: records.map(record => this.normalizeRecord(tableName, record)),
    });
  }

  async patch({
    tableName,
    id,
    record,
  }: {
    tableName: ConvexStorageTable;
    id: string;
    record: Record<string, any>;
  }): Promise<boolean> {
    return this.client.callStorage<boolean>({
      op: 'patch',
      tableName,
      id,
      record: this.normalizePatch(record),
    });
  }

  async updateThread({
    id,
    title,
    metadata,
    updatedAt,
  }: {
    id: string;
    title: string;
    metadata: Record<string, any>;
    updatedAt: Date;
  }): Promise<(Omit<StorageThreadType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }) | null> {
    return this.client.callStorage({
      op: 'updateThread',
      tableName: TABLE_THREADS,
      id,
      title,
      metadata,
      updatedAt: updatedAt.toISOString(),
    });
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
    createdAt,
    updatedAt,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
  }): Promise<Omit<StorageResourceType, 'createdAt' | 'updatedAt'> & { createdAt: string; updatedAt: string }> {
    return this.client.callStorage({
      op: 'updateResource',
      tableName: TABLE_RESOURCES,
      resourceId,
      ...(workingMemory !== undefined ? { workingMemory } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
      createdAt: createdAt.toISOString(),
      updatedAt: updatedAt.toISOString(),
    });
  }

  async load<R>({ tableName, keys }: { tableName: ConvexStorageTable; keys: Record<string, any> }): Promise<R | null> {
    const result = await this.client.callStorage<R | null>({
      op: 'load',
      tableName,
      keys,
    });

    return result;
  }

  async loadMany<R>(tableName: ConvexStorageTable, ids: string[]): Promise<R[]> {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return [];

    const rows: R[] = [];
    for (let index = 0; index < uniqueIds.length; index += LOAD_MANY_REQUEST_BATCH_SIZE) {
      rows.push(
        ...(await this.client.callStorage<R[]>({
          op: 'loadMany',
          tableName,
          ids: uniqueIds.slice(index, index + LOAD_MANY_REQUEST_BATCH_SIZE),
        })),
      );
    }
    return rows;
  }

  public async queryTable<R>(
    tableName: ConvexStorageTable,
    filters?: EqualityFilter[],
    indexHint?: IndexHint,
    limit?: number,
  ): Promise<R[]> {
    return this.client.callStorage<R[]>({
      op: 'queryTable',
      tableName,
      filters,
      indexHint,
      limit,
    });
  }

  public async deleteMany(tableName: ConvexStorageTable, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.client.callStorage({
      op: 'deleteMany',
      tableName,
      ids,
    });
  }

  public async mergeWorkflowStepResult({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const context = await this.client.callStorage<string>({
      op: 'mergeWorkflowStepResult',
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      workflowName,
      runId,
      stepId,
      result: JSON.stringify(result),
      requestContext: JSON.stringify(requestContext),
    });
    if (!context) {
      throw new Error(`Convex workflow step merge returned no context for runId ${runId}`);
    }
    return JSON.parse(context);
  }

  public async mergeWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState> {
    const snapshot = await this.client.callStorage<string>({
      op: 'mergeWorkflowState',
      tableName: TABLE_WORKFLOW_SNAPSHOT,
      workflowName,
      runId,
      opts: JSON.stringify(opts),
    });
    if (!snapshot) {
      throw new Error(`Convex workflow state merge returned no snapshot for runId ${runId}`);
    }
    return JSON.parse(snapshot);
  }

  public async createSchedule(record: Record<string, any>): Promise<void> {
    if (!record.id) {
      throw new Error(`Schedule is missing an id`);
    }

    await this.client.callStorage({
      op: 'createSchedule',
      tableName: TABLE_SCHEDULES,
      record: this.normalizeRecord(TABLE_SCHEDULES, record),
    });
  }

  public async recordScheduleTrigger(record: Record<string, any>): Promise<void> {
    if (!record.id) {
      throw new Error(`Schedule trigger is missing an id`);
    }

    await this.client.callStorage({
      op: 'recordScheduleTrigger',
      tableName: TABLE_SCHEDULE_TRIGGERS,
      record: this.normalizeRecord(TABLE_SCHEDULE_TRIGGERS, record),
    });
  }

  public async listDueSchedules<R>(now: number, limit?: number): Promise<R[]> {
    return this.client.callStorage<R[]>({
      op: 'listDueSchedules',
      tableName: TABLE_SCHEDULES,
      now,
      limit,
    });
  }

  public async updateScheduleNextFire({
    id,
    expectedNextFireAt,
    newNextFireAt,
    lastFireAt,
    lastRunId,
  }: {
    id: string;
    expectedNextFireAt: number;
    newNextFireAt: number;
    lastFireAt: number;
    lastRunId: string;
  }): Promise<boolean> {
    return this.client.callStorage<boolean>({
      op: 'updateScheduleNextFire',
      tableName: TABLE_SCHEDULES,
      id,
      expectedNextFireAt,
      newNextFireAt,
      lastFireAt,
      lastRunId,
    });
  }

  public async updateSchedule<R>({ id, patch }: { id: string; patch: Record<string, any> }): Promise<R> {
    return this.client.callStorage<R>({
      op: 'updateSchedule',
      tableName: TABLE_SCHEDULES,
      id,
      patch,
    });
  }

  public async listScheduleTriggers<R>({
    scheduleId,
    fromActualFireAt,
    toActualFireAt,
    limit,
  }: {
    scheduleId: string;
    fromActualFireAt?: number;
    toActualFireAt?: number;
    limit?: number;
  }): Promise<R[]> {
    return this.client.callStorage<R[]>({
      op: 'listScheduleTriggers',
      tableName: TABLE_SCHEDULE_TRIGGERS,
      scheduleId,
      fromActualFireAt,
      toActualFireAt,
      limit,
    });
  }

  public async deleteScheduleTriggers(scheduleId: string): Promise<void> {
    let hasMore = true;
    while (hasMore) {
      const response = await this.client.callStorageRaw({
        op: 'deleteScheduleTriggers',
        tableName: TABLE_SCHEDULE_TRIGGERS,
        scheduleId,
      });
      hasMore = response.hasMore ?? false;
    }
  }

  // ============================================
  // Observational Memory Operations
  // These always target TABLE_OBSERVATIONAL_MEMORY — the server rejects
  // om* operations against any other table.
  // ============================================

  public async omGetLatest<R>(lookupKey: string): Promise<R | null> {
    return this.client.callStorage<R | null>({
      op: 'omGetLatest',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      lookupKey,
    });
  }

  public async omGetHistory<R>(args: {
    lookupKey: string;
    limit: number;
    from?: string;
    to?: string;
    offset?: number;
  }): Promise<R[]> {
    return this.client.callStorage<R[]>({
      op: 'omGetHistory',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      ...args,
    });
  }

  public async omUpdateActive(args: {
    id: string;
    observations: string;
    tokenCount: number;
    lastObservedAt: string;
    observedMessageIds: string[] | null;
    updatedAt: string;
  }): Promise<void> {
    await this.client.callStorage({
      op: 'omUpdateActive',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      ...args,
    });
  }

  public async omAppendBufferedChunk(args: {
    id: string;
    chunk: SerializedOMChunk;
    lastBufferedAtTime?: string;
    updatedAt: string;
  }): Promise<void> {
    await this.client.callStorage({
      op: 'omAppendBufferedChunk',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      ...args,
    });
  }

  public async omSwapBuffered<R>(args: {
    id: string;
    activationRatio: number;
    messageTokensThreshold: number;
    currentPendingTokens: number;
    forceMaxActivation?: boolean;
    lastObservedAt?: string;
    bufferedChunks?: SerializedOMChunk[];
    now: string;
  }): Promise<R> {
    return this.client.callStorage<R>({
      op: 'omSwapBuffered',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      ...args,
    });
  }

  public async omUpdateBufferedReflection(args: {
    id: string;
    reflection: string;
    tokenCount: number;
    inputTokenCount: number;
    reflectedObservationLineCount: number;
    updatedAt: string;
  }): Promise<void> {
    await this.client.callStorage({
      op: 'omUpdateBufferedReflection',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      ...args,
    });
  }

  public async omSwapBufferedReflection<R>(args: {
    currentRecord: SerializedOMCurrentRecord;
    newId: string;
    tokenCount: number;
    now: string;
  }): Promise<R> {
    return this.client.callStorage<R>({
      op: 'omSwapBufferedReflection',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      ...args,
    });
  }

  public async omUpdateConfig(args: { id: string; config: string; updatedAt: string }): Promise<void> {
    await this.client.callStorage({
      op: 'omUpdateConfig',
      tableName: TABLE_OBSERVATIONAL_MEMORY,
      ...args,
    });
  }

  private normalizeRecord(tableName: ConvexStorageTable, record: Record<string, any>): Record<string, any> {
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

  private normalizePatch(record: Record<string, any>): Record<string, any> {
    const normalized: Record<string, any> = { ...record };

    for (const [key, value] of Object.entries(normalized)) {
      if (value instanceof Date) {
        normalized[key] = value.toISOString();
      }
    }

    return normalized;
  }
}
