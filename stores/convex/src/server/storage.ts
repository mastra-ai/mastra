import {
  TABLE_WORKFLOW_SNAPSHOT,
  TABLE_MESSAGES,
  TABLE_THREADS,
  TABLE_RESOURCES,
  TABLE_SCORERS,
  TABLE_SCHEDULES,
  TABLE_SCHEDULE_TRIGGERS,
  TABLE_CHANNEL_INSTALLATIONS,
  TABLE_CHANNEL_CONFIG,
  TABLE_BACKGROUND_TASKS,
} from '@mastra/core/storage/constants';
import type { GenericMutationCtx as MutationCtx } from 'convex/server';
import { mutationGeneric } from 'convex/server';
import type { GenericId } from 'convex/values';

import type { EqualityFilter, StorageRequest, StorageResponse } from '../storage/types';
import { findBestIndex } from './index-map';
import { handleObservationalMemoryOperation } from './observational-memory';
import { createEmptyWorkflowSnapshot, mergeWorkflowStepResult } from './workflow-snapshot';

// Vector-specific table names (not in @mastra/core)
const TABLE_VECTOR_INDEXES = 'mastra_vector_indexes';
const VECTOR_TABLE_PREFIX = 'mastra_vector_';
const CONVEX_TABLE_WORKFLOW_SNAPSHOTS = 'mastra_workflow_snapshots';
const CONVEX_TABLE_BACKGROUND_TASKS = 'mastra_background_tasks';
const CONVEX_TABLE_DOCUMENTS = 'mastra_documents';
// Defined locally (not imported from core) because this file is bundled into
// the user's Convex deployment and older cores in the peer range may not
// export the observational memory constants.
const CONVEX_TABLE_OBSERVATIONAL_MEMORY = 'mastra_observational_memory';
const STORAGE_MUTATION_BATCH_SIZE = 25;
// Keep this in sync with ConvexDB's loadMany client chunk size. The low cap
// bounds full-doc responses per request; individual document size still matters.
const LOAD_MANY_MAX_IDS_PER_REQUEST = 10;
const DEFAULT_SCHEDULE_QUERY_LIMIT = 100;

type ConvexDocWithId = { _id: GenericId<string> };
type GenericDocumentDoc = ConvexDocWithId & { record: Record<string, unknown> };
type StorageRecord = Record<string, unknown> & { id?: unknown };
const BACKGROUND_TASK_FIELD_ALIASES: Record<string, string> = {
  tool_call_id: 'toolCallId',
  toolCallId: 'tool_call_id',
  tool_name: 'toolName',
  toolName: 'tool_name',
  agent_id: 'agentId',
  agentId: 'agent_id',
  run_id: 'runId',
  runId: 'run_id',
  thread_id: 'threadId',
  threadId: 'thread_id',
  resource_id: 'resourceId',
  resourceId: 'resource_id',
  suspend_payload: 'suspendPayload',
  suspendPayload: 'suspend_payload',
  retry_count: 'retryCount',
  retryCount: 'retry_count',
  max_retries: 'maxRetries',
  maxRetries: 'max_retries',
  timeout_ms: 'timeoutMs',
  timeoutMs: 'timeout_ms',
};

function normalizeScheduleQueryLimit(limit: number | undefined): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_SCHEDULE_QUERY_LIMIT;
  return Math.max(0, Math.floor(limit));
}

function normalizeLoadManyIds(ids: string[]): string[] {
  if (ids.length > LOAD_MANY_MAX_IDS_PER_REQUEST) {
    throw new Error(`loadMany supports at most ${LOAD_MANY_MAX_IDS_PER_REQUEST} ids per request`);
  }
  return [...new Set(ids)];
}

function applyConvexEqualityFilters(
  query: any,
  filters: EqualityFilter[] | undefined,
  indexedFields = new Set<string>(),
) {
  const remainingFilters = filters?.filter(filter => !indexedFields.has(filter.field));
  if (!remainingFilters?.length) return query;

  return query.filter((q: any) => {
    const predicates = remainingFilters.map(filter => q.eq(q.field(filter.field), filter.value));
    return predicates.length === 1 ? predicates[0] : q.and(...predicates);
  });
}

async function mapInBatches<TInput, TOutput>(
  inputs: TInput[],
  batchSize: number,
  mapper: (input: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results: TOutput[] = [];
  for (let index = 0; index < inputs.length; index += batchSize) {
    results.push(...(await Promise.all(inputs.slice(index, index + batchSize).map(mapper))));
  }
  return results;
}

async function deleteDocs(ctx: MutationCtx<any>, docs: ConvexDocWithId[]): Promise<void> {
  await mapInBatches(docs, STORAGE_MUTATION_BATCH_SIZE, doc => ctx.db.delete(doc._id));
}

async function findExistingDocsByIds(
  ids: string[],
  findDoc: (id: string) => Promise<ConvexDocWithId | null | undefined>,
): Promise<ConvexDocWithId[]> {
  const docs = await mapInBatches([...new Set(ids)], STORAGE_MUTATION_BATCH_SIZE, findDoc);
  return docs.filter((doc): doc is ConvexDocWithId => Boolean(doc));
}

function isBackgroundTasksTable(convexTable: string, request: StorageRequest): boolean {
  return convexTable === CONVEX_TABLE_BACKGROUND_TASKS && request.tableName === TABLE_BACKGROUND_TASKS;
}

function matchesFilters(record: Record<string, unknown>, filters: EqualityFilter[]): boolean {
  return filters.every(filter => {
    if (record[filter.field] === filter.value) return true;
    const alternateField = BACKGROUND_TASK_FIELD_ALIASES[filter.field];
    return alternateField ? record[alternateField] === filter.value : false;
  });
}

function mergeLegacyRecord(record: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const merged = { ...record };
  for (const [field, value] of Object.entries(patch)) {
    const alternateField = BACKGROUND_TASK_FIELD_ALIASES[field];
    if (alternateField) delete merged[alternateField];
    merged[field] = value;
  }
  return merged;
}

function stripPatchKeys(record: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const stripped = { ...record };
  for (const key of keys) delete stripped[key];
  return stripped;
}

function dedupeByRecordId(records: any[]): any[] {
  const seen = new Set<string>();
  return records.filter(record => {
    if (record?.id == null) return true;

    const id = String(record.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

function isMissingBackgroundTaskSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return (
    message.includes(CONVEX_TABLE_BACKGROUND_TASKS) &&
    (message.includes('does not exist') ||
      message.includes('not found') ||
      message.includes('not defined') ||
      message.includes('no such'))
  );
}

async function findGenericDocumentById(
  ctx: MutationCtx<any>,
  tableName: string,
  id: string,
): Promise<GenericDocumentDoc | null> {
  return await ctx.db
    .query(CONVEX_TABLE_DOCUMENTS)
    .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(id)))
    .unique();
}

async function findGenericDocumentsByTable(
  ctx: MutationCtx<any>,
  tableName: string,
  limit: number,
): Promise<GenericDocumentDoc[]> {
  return await ctx.db
    .query(CONVEX_TABLE_DOCUMENTS)
    .withIndex('by_table', (q: any) => q.eq('table', tableName))
    .take(limit);
}

async function filterLegacyRecordsWithoutTypedCopy(
  ctx: MutationCtx<any>,
  convexTable: string,
  legacyRecords: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const records = await mapInBatches(legacyRecords, STORAGE_MUTATION_BATCH_SIZE, async record => {
    if (record.id == null) return record;

    const typedDoc = await ctx.db
      .query(convexTable)
      .withIndex('by_record_id', (q: any) => q.eq('id', String(record.id)))
      .unique();
    return typedDoc ? null : record;
  });

  return records.filter((record): record is Record<string, unknown> => Boolean(record));
}

function coalesceTypedRecordsForBatchInsert(records: StorageRecord[]): StorageRecord[] {
  const recordsById = new Map<string, StorageRecord>();
  for (const record of records) {
    const id = record.id;
    if (!id) continue;

    const key = String(id);
    recordsById.set(key, { ...(recordsById.get(key) ?? {}), ...record });
  }
  return [...recordsById.values()];
}

function coalesceLastRecordById(records: StorageRecord[]): StorageRecord[] {
  const recordsById = new Map<string, StorageRecord>();
  for (const record of records) {
    const id = record.id;
    if (!id) continue;
    recordsById.set(String(id), record);
  }
  return [...recordsById.values()];
}

/**
 * Determines which Convex table to use based on the logical table name.
 * Returns the Convex table name and whether it's a typed table or fallback.
 */
function resolveTable(tableName: string): { convexTable: string; isTyped: boolean } {
  switch (tableName) {
    case TABLE_THREADS:
      return { convexTable: 'mastra_threads', isTyped: true };
    case TABLE_MESSAGES:
      return { convexTable: 'mastra_messages', isTyped: true };
    case TABLE_RESOURCES:
      return { convexTable: 'mastra_resources', isTyped: true };
    case TABLE_WORKFLOW_SNAPSHOT:
      return { convexTable: CONVEX_TABLE_WORKFLOW_SNAPSHOTS, isTyped: true };
    case TABLE_SCORERS:
      return { convexTable: 'mastra_scorers', isTyped: true };
    case TABLE_SCHEDULES:
      return { convexTable: 'mastra_schedules', isTyped: true };
    case TABLE_SCHEDULE_TRIGGERS:
      return { convexTable: 'mastra_schedule_triggers', isTyped: true };
    case TABLE_CHANNEL_INSTALLATIONS:
      return { convexTable: 'mastra_channel_installations', isTyped: true };
    case TABLE_CHANNEL_CONFIG:
      return { convexTable: 'mastra_channel_config', isTyped: true };
    case TABLE_BACKGROUND_TASKS:
      return { convexTable: CONVEX_TABLE_BACKGROUND_TASKS, isTyped: true };
    case TABLE_VECTOR_INDEXES:
      return { convexTable: 'mastra_vector_indexes', isTyped: true };
    case CONVEX_TABLE_OBSERVATIONAL_MEMORY:
      return { convexTable: CONVEX_TABLE_OBSERVATIONAL_MEMORY, isTyped: true };
    default:
      // Check if it's a vector data table
      if (tableName.startsWith(VECTOR_TABLE_PREFIX)) {
        return { convexTable: 'mastra_vectors', isTyped: true };
      }
      // Fallback to generic documents table for unknown tables
      return { convexTable: 'mastra_documents', isTyped: false };
  }
}

/**
 * Main storage mutation handler.
 * Routes operations to the appropriate typed table.
 */
export const mastraStorage = mutationGeneric(async (ctx, request: StorageRequest): Promise<StorageResponse> => {
  try {
    const { convexTable, isTyped } = resolveTable(request.tableName);

    // Handle vector data tables specially (but NOT vector_indexes which is a typed table)
    if (request.tableName.startsWith(VECTOR_TABLE_PREFIX) && request.tableName !== TABLE_VECTOR_INDEXES) {
      return await handleVectorOperation(ctx, request);
    }

    // Handle typed tables
    if (isTyped) {
      if (isBackgroundTasksTable(convexTable, request)) {
        try {
          return await handleTypedOperation(ctx, convexTable, request);
        } catch (error) {
          if (!isMissingBackgroundTaskSchemaError(error)) throw error;
          return handleGenericOperation(ctx, request);
        }
      }
      return handleTypedOperation(ctx, convexTable, request);
    }

    // Fallback to generic table for unknown tables
    return handleGenericOperation(ctx, request);
  } catch (error) {
    const err = error as Error;
    return {
      ok: false,
      error: err.message,
    };
  }
});

function parseStoredSnapshot(stored: unknown, runId: string): Record<string, any> {
  if (typeof stored === 'string') return JSON.parse(stored);
  return JSON.parse(JSON.stringify(stored ?? createEmptyWorkflowSnapshot(runId)));
}

function parseMetadataForMerge(metadata: unknown): Record<string, unknown> {
  if (metadata == null) return {};
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata);
      return parseMetadataForMerge(parsed);
    } catch {
      return {};
    }
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function mergeMetadata(existing: unknown, update: Record<string, unknown> | undefined): Record<string, unknown> {
  return {
    ...parseMetadataForMerge(existing),
    ...(update ?? {}),
  };
}

/**
 * Handle operations on typed tables (threads, messages, etc.)
 * Records are stored with their `id` field as a regular field (not _id).
 * We query by the `id` field to find/update records.
 */
export async function handleTypedOperation(
  ctx: MutationCtx<any>,
  convexTable: string,
  request: StorageRequest,
): Promise<StorageResponse> {
  switch (request.op) {
    case 'omGetLatest':
    case 'omGetHistory':
    case 'omUpdateActive':
    case 'omAppendBufferedChunk':
    case 'omSwapBuffered':
    case 'omUpdateBufferedReflection':
    case 'omSwapBufferedReflection':
    case 'omUpdateConfig': {
      if (convexTable !== CONVEX_TABLE_OBSERVATIONAL_MEMORY) {
        throw new Error(`${request.op} is only supported for ${CONVEX_TABLE_OBSERVATIONAL_MEMORY}`);
      }
      return handleObservationalMemoryOperation(ctx, convexTable, request);
    }

    case 'createSchedule': {
      if (convexTable !== 'mastra_schedules') {
        throw new Error(`createSchedule is only supported for mastra_schedules`);
      }
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Schedule is missing an id`);
      }

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', id))
        .unique();

      if (existing) {
        throw new Error(`Schedule with id "${id}" already exists`);
      }

      await ctx.db.insert(convexTable, record);
      return { ok: true };
    }

    case 'recordScheduleTrigger': {
      if (convexTable !== 'mastra_schedule_triggers') {
        throw new Error(`recordScheduleTrigger is only supported for mastra_schedule_triggers`);
      }
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Schedule trigger is missing an id`);
      }

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', id))
        .unique();

      if (existing) {
        throw new Error(`Schedule trigger with id "${id}" already exists`);
      }

      await ctx.db.insert(convexTable, record);
      return { ok: true };
    }

    case 'listDueSchedules': {
      if (convexTable !== 'mastra_schedules') {
        throw new Error(`listDueSchedules is only supported for mastra_schedules`);
      }
      const query = ctx.db
        .query(convexTable)
        .withIndex('by_status_next_fire_at', (q: any) => q.eq('status', 'active').lte('next_fire_at', request.now));
      const docs = await query.take(normalizeScheduleQueryLimit(request.limit));
      return { ok: true, result: docs };
    }

    case 'updateScheduleNextFire': {
      if (convexTable !== 'mastra_schedules') {
        throw new Error(`updateScheduleNextFire is only supported for mastra_schedules`);
      }
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', request.id))
        .unique();

      if (!existing || existing.status !== 'active' || existing.next_fire_at !== request.expectedNextFireAt) {
        return { ok: true, result: false };
      }

      await ctx.db.patch(existing._id, {
        next_fire_at: request.newNextFireAt,
        last_fire_at: request.lastFireAt,
        last_run_id: request.lastRunId,
        updated_at: Date.now(),
      });

      return { ok: true, result: true };
    }

    case 'updateSchedule': {
      if (convexTable !== 'mastra_schedules') {
        throw new Error(`updateSchedule is only supported for mastra_schedules`);
      }
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', request.id))
        .unique();

      if (!existing) {
        throw new Error(`Schedule ${request.id} not found`);
      }

      await ctx.db.patch(existing._id, request.patch);
      return { ok: true, result: { ...existing, ...request.patch } };
    }

    case 'listScheduleTriggers': {
      if (convexTable !== 'mastra_schedule_triggers') {
        throw new Error(`listScheduleTriggers is only supported for mastra_schedule_triggers`);
      }

      const query = ctx.db
        .query(convexTable)
        .withIndex('by_schedule_actual', (q: any) => {
          let builder = q.eq('schedule_id', request.scheduleId);
          if (request.fromActualFireAt != null) {
            builder = builder.gte('actual_fire_at', request.fromActualFireAt);
          }
          if (request.toActualFireAt != null) {
            builder = builder.lt('actual_fire_at', request.toActualFireAt);
          }
          return builder;
        })
        .order('desc');
      const docs = await query.take(normalizeScheduleQueryLimit(request.limit));
      return { ok: true, result: docs };
    }

    case 'deleteScheduleTriggers': {
      if (convexTable !== 'mastra_schedule_triggers') {
        throw new Error(`deleteScheduleTriggers is only supported for mastra_schedule_triggers`);
      }

      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_schedule_actual', (q: any) => q.eq('schedule_id', request.scheduleId))
        .take(STORAGE_MUTATION_BATCH_SIZE + 1);
      const hasMore = docs.length > STORAGE_MUTATION_BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, STORAGE_MUTATION_BATCH_SIZE) : docs;

      await deleteDocs(ctx, docsToDelete);
      return { ok: true, hasMore };
    }

    case 'insert': {
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Record is missing an id`);
      }

      // Find existing record by id field using index
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', id))
        .unique();

      if (existing) {
        // Update existing - don't include id in patch (it's already set)
        const { id: _, ...updateData } = record;
        await ctx.db.patch(existing._id, updateData);
      } else {
        // Insert new - include id as a regular field
        await ctx.db.insert(convexTable, record);
      }
      return { ok: true };
    }

    case 'batchInsert': {
      const records = coalesceTypedRecordsForBatchInsert(request.records);
      await mapInBatches(records, STORAGE_MUTATION_BATCH_SIZE, async record => {
        const id = record.id;
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', id))
          .unique();

        if (existing) {
          const { id: _, ...updateData } = record;
          await ctx.db.patch(existing._id, updateData);
        } else {
          await ctx.db.insert(convexTable, record);
        }
      });
      return { ok: true };
    }

    case 'updateThread': {
      if (convexTable !== 'mastra_threads') {
        return { ok: false, error: `Unsupported operation ${request.op} for table ${request.tableName}` };
      }

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', request.id))
        .unique();

      if (!existing) {
        return { ok: true, result: null };
      }

      const patchRecord = {
        title: request.title,
        metadata: mergeMetadata(existing.metadata, request.metadata),
        updatedAt: request.updatedAt,
      };
      await ctx.db.patch(existing._id, patchRecord);
      return { ok: true, result: { ...existing, ...patchRecord } };
    }

    case 'updateResource': {
      if (convexTable !== 'mastra_resources') {
        return { ok: false, error: `Unsupported operation ${request.op} for table ${request.tableName}` };
      }

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', request.resourceId))
        .unique();

      if (!existing) {
        const record = {
          id: request.resourceId,
          ...(request.workingMemory !== undefined ? { workingMemory: request.workingMemory } : {}),
          metadata: request.metadata ?? {},
          createdAt: request.createdAt,
          updatedAt: request.updatedAt,
        };
        await ctx.db.insert(convexTable, record);
        return { ok: true, result: record };
      }

      const patchRecord: Record<string, unknown> = {
        updatedAt: request.updatedAt,
      };
      if (request.workingMemory !== undefined) {
        patchRecord.workingMemory = request.workingMemory;
      }
      if (request.metadata !== undefined) {
        patchRecord.metadata = mergeMetadata(existing.metadata, request.metadata);
      }

      await ctx.db.patch(existing._id, patchRecord);
      return { ok: true, result: { ...existing, ...patchRecord } };
    }

    case 'patch': {
      const patchRecord = stripPatchKeys(request.record, ['id']);
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_record_id', (q: any) => q.eq('id', request.id))
        .unique();

      if (!existing) {
        if (isBackgroundTasksTable(convexTable, request)) {
          const legacy = await findGenericDocumentById(ctx, request.tableName, request.id);
          if (legacy) {
            await ctx.db.patch(legacy._id, { record: mergeLegacyRecord(legacy.record, patchRecord) });
            return { ok: true, result: true };
          }
        }
        return { ok: true, result: false };
      }

      await ctx.db.patch(existing._id, patchRecord);
      if (isBackgroundTasksTable(convexTable, request)) {
        const legacy = await findGenericDocumentById(ctx, request.tableName, request.id);
        if (legacy) {
          await ctx.db.delete(legacy._id);
        }
      }
      return { ok: true, result: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        // Find by id field using index
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', keys.id))
          .unique();
        if (!doc && isBackgroundTasksTable(convexTable, request)) {
          const legacy = await findGenericDocumentById(ctx, request.tableName, String(keys.id));
          return { ok: true, result: legacy?.record ?? null };
        }
        return { ok: true, result: doc || null };
      }

      if (
        convexTable === CONVEX_TABLE_WORKFLOW_SNAPSHOTS &&
        typeof keys.workflow_name === 'string' &&
        typeof keys.run_id === 'string'
      ) {
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_workflow_run', (q: any) => q.eq('workflow_name', keys.workflow_name).eq('run_id', keys.run_id))
          .unique();
        return { ok: true, result: doc || null };
      }

      // Query by other fields - use take() to avoid 32k limit
      const docs = await ctx.db.query(convexTable).take(10000);
      const match = docs.find((doc: any) => Object.entries(keys).every(([key, value]) => doc[key] === value));
      return { ok: true, result: match || null };
    }

    case 'loadMany': {
      const ids = normalizeLoadManyIds(request.ids);
      const docs = await mapInBatches(ids, STORAGE_MUTATION_BATCH_SIZE, id =>
        ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', id))
          .unique(),
      );
      const typedDocs = docs.filter(Boolean);

      if (!isBackgroundTasksTable(convexTable, request)) {
        return { ok: true, result: typedDocs };
      }

      const typedDocsById = new Map(typedDocs.map(doc => [String((doc as Record<string, unknown>).id), doc]));
      const legacyDocs = await mapInBatches(
        ids.filter(id => !typedDocsById.has(id)),
        STORAGE_MUTATION_BATCH_SIZE,
        id => findGenericDocumentById(ctx, request.tableName, id),
      );
      const legacyRecordsById = new Map(
        legacyDocs
          .filter((doc): doc is GenericDocumentDoc => Boolean(doc))
          .map(doc => [String(doc.record.id), doc.record]),
      );
      return {
        ok: true,
        result: ids.map(id => typedDocsById.get(id) ?? legacyRecordsById.get(id)).filter(Boolean),
      };
    }

    case 'queryTable': {
      // Use take() to avoid hitting Convex's 32k document limit
      const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;

      // Build query with index if hint provided for efficient filtering
      let query: any;
      let indexedFields = new Set<string>();
      if (request.indexHint) {
        const hint = request.indexHint;
        if (hint.index === 'by_workflow') {
          query = ctx.db
            .query(convexTable)
            .withIndex('by_workflow', (q: any) => q.eq('workflow_name', hint.workflowName));
        } else if (hint.index === 'by_workflow_run') {
          query = ctx.db
            .query(convexTable)
            .withIndex('by_workflow_run', (q: any) =>
              q.eq('workflow_name', hint.workflowName).eq('run_id', hint.runId),
            );
        } else {
          query = ctx.db.query(convexTable);
        }
      } else if (request.filters && request.filters.length > 0) {
        const match = findBestIndex(convexTable, request.filters);
        if (match) {
          query = ctx.db.query(convexTable).withIndex(match.indexName, (q: any) => {
            let builder = q;
            for (const filter of match.indexedFilters) {
              builder = builder.eq(filter.field, filter.value);
            }
            return builder;
          });
          indexedFields = new Set(match.indexedFilters.map(filter => filter.field));
        } else {
          query = ctx.db.query(convexTable);
        }
      } else {
        query = ctx.db.query(convexTable);
      }

      let docs = await applyConvexEqualityFilters(query, request.filters, indexedFields).take(maxDocs);

      if (isBackgroundTasksTable(convexTable, request)) {
        const legacyDocs = await findGenericDocumentsByTable(ctx, request.tableName, maxDocs);
        let legacyRecords = legacyDocs.map(doc => doc.record);
        if (request.filters && request.filters.length > 0) {
          legacyRecords = legacyRecords.filter(record => matchesFilters(record, request.filters!));
        }
        legacyRecords = await filterLegacyRecordsWithoutTypedCopy(ctx, convexTable, legacyRecords);
        docs.push(...legacyRecords);
        docs = dedupeByRecordId(docs);
      }

      // Apply limit if provided
      if (request.limit) {
        docs = docs.slice(0, request.limit);
      }

      return { ok: true, result: docs };
    }

    case 'clearTable':
    case 'dropTable': {
      // Delete a small batch per call to stay within Convex's 1-second mutation timeout.
      // Client must call repeatedly until hasMore is false.
      const docs = await ctx.db.query(convexTable).take(STORAGE_MUTATION_BATCH_SIZE + 1);
      const hasMore = docs.length > STORAGE_MUTATION_BATCH_SIZE;
      let docsToDelete = hasMore ? docs.slice(0, STORAGE_MUTATION_BATCH_SIZE) : docs;
      let legacyHasMore = false;

      if (
        !hasMore &&
        docsToDelete.length < STORAGE_MUTATION_BATCH_SIZE &&
        isBackgroundTasksTable(convexTable, request)
      ) {
        const remainingBatchSize = STORAGE_MUTATION_BATCH_SIZE - docsToDelete.length;
        const legacyDocs = await findGenericDocumentsByTable(ctx, request.tableName, remainingBatchSize + 1);
        legacyHasMore = legacyDocs.length > remainingBatchSize;
        docsToDelete = docsToDelete.concat(legacyHasMore ? legacyDocs.slice(0, remainingBatchSize) : legacyDocs);
      }

      await deleteDocs(ctx, docsToDelete);
      return { ok: true, hasMore: hasMore || legacyHasMore };
    }

    case 'deleteMany': {
      const docsToDelete = await findExistingDocsByIds(request.ids, id =>
        ctx.db
          .query(convexTable)
          .withIndex('by_record_id', (q: any) => q.eq('id', id))
          .unique(),
      );
      if (isBackgroundTasksTable(convexTable, request)) {
        docsToDelete.push(
          ...(await findExistingDocsByIds(request.ids, id => findGenericDocumentById(ctx, request.tableName, id))),
        );
      }
      await deleteDocs(ctx, docsToDelete);
      return { ok: true };
    }

    case 'mergeWorkflowStepResult': {
      if (convexTable !== CONVEX_TABLE_WORKFLOW_SNAPSHOTS) {
        return { ok: false, error: `Unsupported operation ${request.op} for table ${request.tableName}` };
      }

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_workflow_run', (q: any) =>
          q.eq('workflow_name', request.workflowName).eq('run_id', request.runId),
        )
        .unique();

      if (!existing) {
        return { ok: false, error: `Workflow snapshot not found for runId ${request.runId}` };
      }

      const snapshot = parseStoredSnapshot(existing.snapshot, request.runId);
      if (!snapshot.context) {
        return { ok: false, error: `Snapshot for runId ${request.runId} is missing or has invalid context` };
      }

      const context = mergeWorkflowStepResult({
        snapshot,
        stepId: request.stepId,
        result: JSON.parse(request.result),
        requestContext: JSON.parse(request.requestContext),
      });

      await ctx.db.patch(existing._id, {
        snapshot: JSON.stringify(snapshot),
        updatedAt: new Date().toISOString(),
      });

      return { ok: true, result: JSON.stringify(context) };
    }

    case 'mergeWorkflowState': {
      if (convexTable !== CONVEX_TABLE_WORKFLOW_SNAPSHOTS) {
        return { ok: false, error: `Unsupported operation ${request.op} for table ${request.tableName}` };
      }

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_workflow_run', (q: any) =>
          q.eq('workflow_name', request.workflowName).eq('run_id', request.runId),
        )
        .unique();

      if (!existing) {
        return { ok: false, error: `Workflow snapshot not found for runId ${request.runId}` };
      }

      const snapshot = parseStoredSnapshot(existing.snapshot, request.runId);
      if (!snapshot.context) {
        return { ok: false, error: `Snapshot for runId ${request.runId} is missing or has invalid context` };
      }

      const mergedSnapshot = { ...snapshot, ...JSON.parse(request.opts) };
      await ctx.db.patch(existing._id, {
        snapshot: JSON.stringify(mergedSnapshot),
        updatedAt: new Date().toISOString(),
      });

      return { ok: true, result: JSON.stringify(mergedSnapshot) };
    }

    default:
      return { ok: false, error: `Unsupported operation ${(request as any).op}` };
  }
}

/**
 * Handle operations on the vectors table.
 * Vectors are stored with indexName to support multiple indexes.
 */
async function handleVectorOperation(ctx: MutationCtx<any>, request: StorageRequest): Promise<StorageResponse> {
  // Extract the index name from the table name (e.g., "mastra_vector_myindex" -> "myindex")
  const indexName = request.tableName.replace(VECTOR_TABLE_PREFIX, '');
  const convexTable = 'mastra_vectors';

  switch (request.op) {
    case 'insert': {
      const record = request.record;
      const id = record.id;
      if (!id) {
        throw new Error(`Vector record is missing an id`);
      }

      // Find existing by composite key (indexName, id) to scope per index
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, {
          embedding: record.embedding,
          metadata: record.metadata,
        });
      } else {
        await ctx.db.insert(convexTable, {
          id,
          indexName,
          embedding: record.embedding,
          metadata: record.metadata,
        });
      }
      return { ok: true };
    }

    case 'batchInsert': {
      const records = coalesceLastRecordById(request.records);
      await mapInBatches(records, STORAGE_MUTATION_BATCH_SIZE, async record => {
        const id = record.id;

        // Find existing by composite key (indexName, id) to scope per index
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, {
            embedding: record.embedding,
            metadata: record.metadata,
          });
        } else {
          await ctx.db.insert(convexTable, {
            id,
            indexName,
            embedding: record.embedding,
            metadata: record.metadata,
          });
        }
      });
      return { ok: true };
    }

    case 'patch': {
      const patchRecord = stripPatchKeys(request.record, ['id', 'indexName']);
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', request.id))
        .unique();

      if (!existing) {
        return { ok: true, result: false };
      }

      await ctx.db.patch(existing._id, patchRecord);
      return { ok: true, result: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        // Use composite key (indexName, id) to scope lookup per index
        const doc = await ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', keys.id))
          .unique();
        return { ok: true, result: doc || null };
      }
      return { ok: true, result: null };
    }

    case 'loadMany': {
      const docs = await findExistingDocsByIds(normalizeLoadManyIds(request.ids), id =>
        ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
          .unique(),
      );
      return { ok: true, result: docs };
    }

    case 'queryTable': {
      if (request.cursor !== undefined && request.pageSize === undefined) {
        throw new Error('queryTable cursor requires pageSize');
      }

      if (request.pageSize !== undefined) {
        if (!Number.isInteger(request.pageSize) || request.pageSize <= 0) {
          throw new Error('queryTable pageSize must be a positive integer');
        }
        if (request.limit !== undefined) {
          throw new Error('queryTable limit cannot be combined with pageSize');
        }

        const page = await ctx.db
          .query(convexTable)
          .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
          .paginate({ cursor: request.cursor ?? null, numItems: request.pageSize });

        let docs = page.page;

        // Apply filters if provided
        if (request.filters && request.filters.length > 0) {
          docs = docs.filter((doc: any) => request.filters!.every(filter => doc[filter.field] === filter.value));
        }

        return {
          ok: true,
          result: docs,
          hasMore: !page.isDone,
          continuationCursor: page.continueCursor,
        };
      }

      // Use take() to avoid hitting Convex's 32k document limit
      const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;
      let docs = await ctx.db
        .query(convexTable)
        .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
        .take(maxDocs);

      // Apply filters if provided
      if (request.filters && request.filters.length > 0) {
        docs = docs.filter((doc: any) => request.filters!.every(filter => doc[filter.field] === filter.value));
      }

      // Apply limit if provided
      if (request.limit) {
        docs = docs.slice(0, request.limit);
      }

      return { ok: true, result: docs };
    }

    case 'clearTable':
    case 'dropTable': {
      // Delete a small batch per call to stay within Convex's 1-second mutation timeout.
      // Client must call repeatedly until hasMore is false.
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_index', (q: any) => q.eq('indexName', indexName))
        .take(STORAGE_MUTATION_BATCH_SIZE + 1);
      const hasMore = docs.length > STORAGE_MUTATION_BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, STORAGE_MUTATION_BATCH_SIZE) : docs;

      await deleteDocs(ctx, docsToDelete);
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      const docsToDelete = await findExistingDocsByIds(request.ids, id =>
        // Use composite key (indexName, id) to scope deletion per index
        ctx.db
          .query(convexTable)
          .withIndex('by_index_id', (q: any) => q.eq('indexName', indexName).eq('id', id))
          .unique(),
      );
      await deleteDocs(ctx, docsToDelete);
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${(request as any).op}` };
  }
}

/**
 * Handle operations on the generic documents table.
 * Used as fallback for unknown table names.
 */
async function handleGenericOperation(ctx: MutationCtx<any>, request: StorageRequest): Promise<StorageResponse> {
  const tableName = request.tableName;
  const convexTable = 'mastra_documents';

  switch (request.op) {
    case 'insert': {
      const record = request.record;
      if (!record.id) {
        throw new Error(`Record for table ${tableName} is missing an id`);
      }
      const primaryKey = String(record.id);

      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', primaryKey))
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { record });
      } else {
        await ctx.db.insert(convexTable, {
          table: tableName,
          primaryKey,
          record,
        });
      }
      return { ok: true };
    }

    case 'batchInsert': {
      const records = coalesceLastRecordById(request.records);
      await mapInBatches(records, STORAGE_MUTATION_BATCH_SIZE, async record => {
        const primaryKey = String(record.id);

        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', primaryKey))
          .unique();

        if (existing) {
          await ctx.db.patch(existing._id, { record });
        } else {
          await ctx.db.insert(convexTable, {
            table: tableName,
            primaryKey,
            record,
          });
        }
      });
      return { ok: true };
    }

    case 'patch': {
      const patchRecord = stripPatchKeys(request.record, ['id']);
      const existing = await ctx.db
        .query(convexTable)
        .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(request.id)))
        .unique();

      if (!existing) {
        return { ok: true, result: false };
      }

      await ctx.db.patch(existing._id, {
        record:
          tableName === TABLE_BACKGROUND_TASKS
            ? mergeLegacyRecord(existing.record, patchRecord)
            : { ...existing.record, ...patchRecord },
      });
      return { ok: true, result: true };
    }

    case 'load': {
      const keys = request.keys;
      if (keys.id) {
        const existing = await ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(keys.id)))
          .unique();
        return { ok: true, result: existing ? existing.record : null };
      }

      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(10000);
      const match = docs.find((doc: any) => Object.entries(keys).every(([key, value]) => doc.record?.[key] === value));
      return { ok: true, result: match ? match.record : null };
    }

    case 'loadMany': {
      const docs = await mapInBatches(normalizeLoadManyIds(request.ids), STORAGE_MUTATION_BATCH_SIZE, id =>
        findGenericDocumentById(ctx, tableName, id),
      );
      return {
        ok: true,
        result: docs.filter((doc): doc is GenericDocumentDoc => Boolean(doc)).map(doc => doc.record),
      };
    }

    case 'queryTable': {
      // Use take() to avoid hitting Convex's 32k document limit
      const maxDocs = request.limit ? Math.min(request.limit * 2, 10000) : 10000;
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(maxDocs);

      let records = docs.map((doc: any) => doc.record);

      if (request.filters && request.filters.length > 0) {
        records = records.filter((record: any) =>
          tableName === TABLE_BACKGROUND_TASKS
            ? matchesFilters(record, request.filters!)
            : request.filters!.every(filter => record?.[filter.field] === filter.value),
        );
      }

      if (request.limit) {
        records = records.slice(0, request.limit);
      }

      return { ok: true, result: records };
    }

    case 'clearTable':
    case 'dropTable': {
      // Delete a small batch per call to stay within Convex's 1-second mutation timeout.
      // Client must call repeatedly until hasMore is false.
      const docs = await ctx.db
        .query(convexTable)
        .withIndex('by_table', (q: any) => q.eq('table', tableName))
        .take(STORAGE_MUTATION_BATCH_SIZE + 1);
      const hasMore = docs.length > STORAGE_MUTATION_BATCH_SIZE;
      const docsToDelete = hasMore ? docs.slice(0, STORAGE_MUTATION_BATCH_SIZE) : docs;

      await deleteDocs(ctx, docsToDelete);
      return { ok: true, hasMore };
    }

    case 'deleteMany': {
      const docsToDelete = await findExistingDocsByIds(request.ids, id =>
        ctx.db
          .query(convexTable)
          .withIndex('by_table_primary', (q: any) => q.eq('table', tableName).eq('primaryKey', String(id)))
          .unique(),
      );
      await deleteDocs(ctx, docsToDelete);
      return { ok: true };
    }

    default:
      return { ok: false, error: `Unsupported operation ${(request as any).op}` };
  }
}
