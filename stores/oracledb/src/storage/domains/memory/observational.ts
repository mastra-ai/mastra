import { randomUUID } from 'node:crypto';

import { ErrorCategory, MastraError } from '@mastra/core/error';
import { TABLE_OBSERVATIONAL_MEMORY } from '@mastra/core/storage';
import type {
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  UpdateActiveObservationsInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage';
import type { Connection } from 'oracledb';

import { asBindParameters, executeOptions, jsonBind, nullableClobBind, nullableJsonBind, rows } from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { toDate, parseOptionalJsonObject, parseOptionalStringArray } from '../../domain-utils';
import {
  OM_ACTIVE_OBSERVATIONS,
  OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE,
  OM_BUFFERED_MESSAGE_IDS,
  OM_BUFFERED_OBSERVATIONS,
  OM_BUFFERED_OBSERVATION_CHUNKS,
  OM_BUFFERED_OBSERVATION_TOKENS,
  OM_BUFFERED_REFLECTION,
  OM_BUFFERED_REFLECTION_INPUT_TOKENS,
  OM_BUFFERED_REFLECTION_TOKENS,
  OM_CREATED_AT,
  OM_GENERATION_COUNT,
  OM_IS_BUFFERING_OBSERVATION,
  OM_IS_BUFFERING_REFLECTION,
  OM_IS_OBSERVING,
  OM_IS_REFLECTING,
  OM_LAST_BUFFERED_AT_TIME,
  OM_LAST_BUFFERED_AT_TOKENS,
  OM_LAST_OBSERVED_AT,
  OM_LAST_REFLECTION_AT,
  OM_LOOKUP_KEY,
  OM_OBSERVATION_TOKEN_COUNT,
  OM_OBSERVED_MESSAGE_IDS,
  OM_OBSERVED_TIMEZONE,
  OM_ORIGIN_TYPE,
  OM_PENDING_MESSAGE_TOKENS,
  OM_REFLECTED_OBSERVATION_LINE_COUNT,
  OM_RESOURCE_ID,
  OM_SCOPE,
  OM_THREAD_ID,
  OM_TOTAL_TOKENS_OBSERVED,
  OM_UPDATED_AT,
} from './schema';
import {
  assertRowsAffected,
  boolToNumber,
  emptyToUndefined,
  numberOrZero,
  optionalNumber,
  parseBufferedChunks,
  parseJson,
  storageError,
  stringOrEmpty,
  table,
  toBoolean,
} from './utils';
import type { MemoryContext } from './utils';

// Core observational memory: current record lookup/history, record creation,
// active-observation updates, config merges, and simple state flags. The
// async buffering/reflection-swap workflow lives in observational-buffering.ts.

export type ObservationalMemoryRow = {
  id: string;
  lookupKey: string;
  scope: 'thread' | 'resource';
  resourceId: string;
  threadId?: string | null;
  activeObservations?: unknown;
  activeObservationsPendingUpdate?: unknown;
  originType?: 'initial' | 'reflection';
  config?: unknown;
  generationCount?: number | string;
  lastObservedAt?: Date | string | null;
  lastReflectionAt?: Date | string | null;
  pendingMessageTokens?: number | string | null;
  totalTokensObserved?: number | string | null;
  observationTokenCount?: number | string | null;
  isObserving?: number | boolean | string | null;
  isReflecting?: number | boolean | string | null;
  observedMessageIds?: unknown;
  observedTimezone?: string | null;
  bufferedObservations?: unknown;
  bufferedObservationTokens?: number | string | null;
  bufferedMessageIds?: unknown;
  bufferedReflection?: unknown;
  bufferedReflectionTokens?: number | string | null;
  bufferedReflectionInputTokens?: number | string | null;
  reflectedObservationLineCount?: number | string | null;
  bufferedObservationChunks?: unknown;
  isBufferingObservation?: number | boolean | string | null;
  isBufferingReflection?: number | boolean | string | null;
  lastBufferedAtTokens?: number | string | null;
  lastBufferedAtTime?: Date | string | null;
  metadata?: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export async function getObservationalMemory(
  ctx: MemoryContext,
  threadId: string | null,
  resourceId: string,
): Promise<ObservationalMemoryRecord | null> {
  try {
    const lookupKey = getOMKey(threadId, resourceId);
    // A resource can have global and thread-scoped observations. lookupKey
    // keeps those scopes independent while sharing one indexed table.
    return await ctx.db.withConnection(async connection => {
      const result = await connection.execute<ObjectRow>(
        `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         WHERE ${OM_LOOKUP_KEY} = :lookupKey
         ORDER BY ${OM_GENERATION_COUNT} DESC
         FETCH FIRST 1 ROWS ONLY`,
        asBindParameters({ lookupKey }),
        executeOptions(),
      );
      const row = rows(result)[0] as ObservationalMemoryRow | undefined;
      return row ? parseOMRow(row) : null;
    });
  } catch (error) {
    throw storageError('GET_OBSERVATIONAL_MEMORY', 'FAILED', { threadId: threadId ?? '', resourceId }, error);
  }
}

export async function getObservationalMemoryHistory(
  ctx: MemoryContext,
  threadId: string | null,
  resourceId: string,
  limit = 10,
  options?: ObservationalMemoryHistoryOptions,
): Promise<ObservationalMemoryRecord[]> {
  try {
    ctx.validatePaginationInput(options?.offset ?? 0, limit);
  } catch (error) {
    throw storageError('GET_OBSERVATIONAL_MEMORY_HISTORY', 'INVALID_INPUT', { resourceId, limit }, error, ErrorCategory.USER);
  }

  try {
    const lookupKey = getOMKey(threadId, resourceId);
    const conditions = [`${OM_LOOKUP_KEY} = :lookupKey`];
    const binds: Record<string, unknown> = { lookupKey, limit };

    if (options?.from) {
      conditions.push(`${OM_CREATED_AT} >= :fromDate`);
      binds.fromDate = options.from;
    }
    if (options?.to) {
      conditions.push(`${OM_CREATED_AT} <= :toDate`);
      binds.toDate = options.to;
    }
    if (options?.offset !== undefined) {
      binds.offset = options.offset;
    }

    return await ctx.db.withConnection(async connection => {
      const result = await connection.execute<ObjectRow>(
        `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         WHERE ${conditions.join(' AND ')}
         ORDER BY ${OM_GENERATION_COUNT} DESC
         OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        asBindParameters({ offset: options?.offset ?? 0, ...binds }),
        executeOptions(),
      );
      return rows(result).map(row => parseOMRow(row as ObservationalMemoryRow));
    });
  } catch (error) {
    throw storageError('GET_OBSERVATIONAL_MEMORY_HISTORY', 'FAILED', { threadId: threadId ?? '', resourceId, limit }, error);
  }
}

export async function initializeObservationalMemory(
  ctx: MemoryContext,
  input: CreateObservationalMemoryInput,
): Promise<ObservationalMemoryRecord> {
  const now = new Date();
  // Start with empty active observations; later calls append observations and reflection output transactionally.
  const record: ObservationalMemoryRecord = {
    id: randomUUID(),
    scope: input.scope,
    threadId: input.threadId,
    resourceId: input.resourceId,
    createdAt: now,
    updatedAt: now,
    lastObservedAt: undefined,
    originType: 'initial',
    generationCount: 0,
    activeObservations: '',
    totalTokensObserved: 0,
    observationTokenCount: 0,
    pendingMessageTokens: 0,
    isReflecting: false,
    isObserving: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: input.config,
    observedTimezone: input.observedTimezone,
  };

  try {
    await ctx.db.tx(async (_client, connection) => {
      await insertOMRecord(ctx, connection, record);
    });
    return record;
  } catch (error) {
    throw storageError('INITIALIZE_OBSERVATIONAL_MEMORY', 'FAILED', { threadId: input.threadId ?? '', resourceId: input.resourceId }, error);
  }
}

export async function insertObservationalMemoryRecord(ctx: MemoryContext, record: ObservationalMemoryRecord): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      await insertOMRecord(ctx, connection, record);
    });
  } catch (error) {
    throw storageError('INSERT_OBSERVATIONAL_MEMORY_RECORD', 'FAILED', { id: record.id, resourceId: record.resourceId }, error);
  }
}

export async function updateActiveObservations(ctx: MemoryContext, input: UpdateActiveObservationsInput): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      const result = await connection.execute(
        `
          UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
          SET ${OM_ACTIVE_OBSERVATIONS} = :activeObservations,
              ${OM_LAST_OBSERVED_AT} = :lastObservedAt,
              ${OM_PENDING_MESSAGE_TOKENS} = 0,
              ${OM_OBSERVATION_TOKEN_COUNT} = :tokenCount,
              ${OM_TOTAL_TOKENS_OBSERVED} = COALESCE(${OM_TOTAL_TOKENS_OBSERVED}, 0) + :tokenCount,
              ${OM_OBSERVED_MESSAGE_IDS} = :observedMessageIds,
              ${OM_OBSERVED_TIMEZONE} = COALESCE(:observedTimezone, ${OM_OBSERVED_TIMEZONE}),
              ${OM_UPDATED_AT} = :updatedAt
          WHERE id = :id`,
        {
          id: input.id,
          activeObservations: nullableClobBind(input.observations),
          lastObservedAt: input.lastObservedAt,
          // Moving observations to active memory consumes pending tokens and
          // advances the cumulative observed-token counter atomically.
          tokenCount: Math.round(input.tokenCount),
          observedMessageIds: nullableJsonBind(input.observedMessageIds),
          observedTimezone: input.observedTimezone ?? null,
          updatedAt: new Date(),
        },
      );
      assertRowsAffected(result.rowsAffected, 'UPDATE_ACTIVE_OBSERVATIONS', input.id);
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('UPDATE_ACTIVE_OBSERVATIONS', 'FAILED', { id: input.id }, error);
  }
}

export async function createReflectionGeneration(
  ctx: MemoryContext,
  input: CreateReflectionGenerationInput,
): Promise<ObservationalMemoryRecord> {
  const now = new Date();
  const record: ObservationalMemoryRecord = {
    id: randomUUID(),
    scope: input.currentRecord.scope,
    threadId: input.currentRecord.threadId,
    resourceId: input.currentRecord.resourceId,
    createdAt: now,
    updatedAt: now,
    lastObservedAt: input.currentRecord.lastObservedAt,
    originType: 'reflection',
    generationCount: input.currentRecord.generationCount + 1,
    activeObservations: input.reflection,
    totalTokensObserved: input.currentRecord.totalTokensObserved,
    observationTokenCount: Math.round(input.tokenCount),
    pendingMessageTokens: 0,
    isReflecting: false,
    isObserving: false,
    isBufferingObservation: false,
    isBufferingReflection: false,
    lastBufferedAtTokens: 0,
    lastBufferedAtTime: null,
    config: input.currentRecord.config,
    metadata: input.currentRecord.metadata,
    observedTimezone: input.currentRecord.observedTimezone,
  };

  try {
    await ctx.db.tx(async (_client, connection) => {
      await insertOMRecord(ctx, connection, record, now);
    });
    return record;
  } catch (error) {
    throw storageError('CREATE_REFLECTION_GENERATION', 'FAILED', { id: input.currentRecord.id }, error);
  }
}

export async function setReflectingFlag(ctx: MemoryContext, id: string, isReflecting: boolean): Promise<void> {
  await updateOMFlag(ctx, id, OM_IS_REFLECTING, isReflecting, 'SET_REFLECTING_FLAG');
}

export async function setObservingFlag(ctx: MemoryContext, id: string, isObserving: boolean): Promise<void> {
  await updateOMFlag(ctx, id, OM_IS_OBSERVING, isObserving, 'SET_OBSERVING_FLAG');
}

export async function setBufferingObservationFlag(
  ctx: MemoryContext,
  id: string,
  isBuffering: boolean,
  lastBufferedAtTokens?: number,
): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      const setTokens = lastBufferedAtTokens !== undefined ? `, ${OM_LAST_BUFFERED_AT_TOKENS} = :lastBufferedAtTokens` : '';
      const binds: Record<string, unknown> = {
        id,
        isBuffering: boolToNumber(isBuffering),
        updatedAt: new Date(),
      };
      if (lastBufferedAtTokens !== undefined) {
        binds.lastBufferedAtTokens = Math.round(lastBufferedAtTokens);
      }

      const result = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_IS_BUFFERING_OBSERVATION} = :isBuffering,
               ${OM_UPDATED_AT} = :updatedAt
               ${setTokens}
           WHERE id = :id`,
        asBindParameters(binds),
      );
      assertRowsAffected(result.rowsAffected, 'SET_BUFFERING_OBSERVATION_FLAG', id);
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SET_BUFFERING_OBSERVATION_FLAG', 'FAILED', { id, isBuffering }, error);
  }
}

export async function setBufferingReflectionFlag(ctx: MemoryContext, id: string, isBuffering: boolean): Promise<void> {
  await updateOMFlag(ctx, id, OM_IS_BUFFERING_REFLECTION, isBuffering, 'SET_BUFFERING_REFLECTION_FLAG');
}

export async function clearObservationalMemory(ctx: MemoryContext, threadId: string | null, resourceId: string): Promise<void> {
  try {
    const lookupKey = getOMKey(threadId, resourceId);
    await ctx.db.none(`DELETE FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} WHERE ${OM_LOOKUP_KEY} = :lookupKey`, {
      lookupKey,
    });
  } catch (error) {
    throw storageError('CLEAR_OBSERVATIONAL_MEMORY', 'FAILED', { threadId: threadId ?? '', resourceId }, error);
  }
}

export async function setPendingMessageTokens(ctx: MemoryContext, id: string, tokenCount: number): Promise<void> {
  try {
    await updateOMColumns(ctx, id, 'SET_PENDING_MESSAGE_TOKENS', {
      [OM_PENDING_MESSAGE_TOKENS]: Math.round(tokenCount),
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SET_PENDING_MESSAGE_TOKENS', 'FAILED', { id, tokenCount }, error);
  }
}

export async function updateObservationalMemoryConfig(ctx: MemoryContext, input: UpdateObservationalMemoryConfigInput): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      // Lock current config before deep-merging so concurrent observers do not
      // drop nested config keys written by another request.
      const result = await connection.execute<ObjectRow>(
        `SELECT config AS "config" FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} WHERE id = :id FOR UPDATE`,
        { id: input.id },
        executeOptions(),
      );
      const row = rows(result)[0];
      if (!row) {
        assertRowsAffected(0, 'UPDATE_OM_CONFIG', input.id);
      }

      const existing = parseJson(row?.config);
      const merged = ctx.deepMergeConfig(existing, input.config);
      const updateResult = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET config = :config,
               ${OM_UPDATED_AT} = :updatedAt
           WHERE id = :id`,
        { id: input.id, config: jsonBind(merged), updatedAt: new Date() },
      );
      assertRowsAffected(updateResult.rowsAffected, 'UPDATE_OM_CONFIG', input.id);
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('UPDATE_OM_CONFIG', 'FAILED', { id: input.id }, error);
  }
}

function getOMKey(threadId: string | null, resourceId: string): string {
  return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
}

export async function insertOMRecord(
  ctx: MemoryContext,
  connection: Connection,
  record: ObservationalMemoryRecord,
  timestamp = record.createdAt,
): Promise<void> {
  // Store free-form observations/reflections as CLOBs while keeping config,
  // ids, chunks, and counters typed for runtime queries and state transitions.
  await connection.execute(
    `
    INSERT INTO ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} (
      id,
      ${OM_LOOKUP_KEY},
      ${OM_SCOPE},
      ${OM_RESOURCE_ID},
      ${OM_THREAD_ID},
      ${OM_ACTIVE_OBSERVATIONS},
      ${OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE},
      ${OM_ORIGIN_TYPE},
      config,
      ${OM_GENERATION_COUNT},
      ${OM_LAST_OBSERVED_AT},
      ${OM_LAST_REFLECTION_AT},
      ${OM_PENDING_MESSAGE_TOKENS},
      ${OM_TOTAL_TOKENS_OBSERVED},
      ${OM_OBSERVATION_TOKEN_COUNT},
      ${OM_OBSERVED_MESSAGE_IDS},
      ${OM_OBSERVED_TIMEZONE},
      ${OM_BUFFERED_OBSERVATIONS},
      ${OM_BUFFERED_OBSERVATION_TOKENS},
      ${OM_BUFFERED_MESSAGE_IDS},
      ${OM_BUFFERED_REFLECTION},
      ${OM_BUFFERED_REFLECTION_TOKENS},
      ${OM_BUFFERED_REFLECTION_INPUT_TOKENS},
      ${OM_REFLECTED_OBSERVATION_LINE_COUNT},
      ${OM_BUFFERED_OBSERVATION_CHUNKS},
      ${OM_IS_OBSERVING},
      ${OM_IS_REFLECTING},
      ${OM_IS_BUFFERING_OBSERVATION},
      ${OM_IS_BUFFERING_REFLECTION},
      ${OM_LAST_BUFFERED_AT_TOKENS},
      ${OM_LAST_BUFFERED_AT_TIME},
      metadata,
      ${OM_CREATED_AT},
      ${OM_UPDATED_AT}
    ) VALUES (
      :id,
      :lookupKey,
      :scope,
      :resourceId,
      :threadId,
      :activeObservations,
      :activeObservationsPendingUpdate,
      :originType,
      :config,
      :generationCount,
      :lastObservedAt,
      :lastReflectionAt,
      :pendingMessageTokens,
      :totalTokensObserved,
      :observationTokenCount,
      :observedMessageIds,
      :observedTimezone,
      :bufferedObservations,
      :bufferedObservationTokens,
      :bufferedMessageIds,
      :bufferedReflection,
      :bufferedReflectionTokens,
      :bufferedReflectionInputTokens,
      :reflectedObservationLineCount,
      :bufferedObservationChunks,
      :isObserving,
      :isReflecting,
      :isBufferingObservation,
      :isBufferingReflection,
      :lastBufferedAtTokens,
      :lastBufferedAtTime,
      :metadata,
      :createdAt,
      :updatedAt
    )`,
    {
      id: record.id,
      lookupKey: getOMKey(record.threadId, record.resourceId),
      scope: record.scope,
      resourceId: record.resourceId,
      threadId: record.threadId ?? null,
      activeObservations: nullableClobBind(record.activeObservations ?? ''),
      activeObservationsPendingUpdate: nullableClobBind(record.bufferedObservations),
      originType: record.originType ?? 'initial',
      config: jsonBind(record.config ?? {}),
      generationCount: record.generationCount ?? 0,
      lastObservedAt: record.lastObservedAt ?? null,
      lastReflectionAt: record.originType === 'reflection' ? timestamp : null,
      pendingMessageTokens: Math.round(record.pendingMessageTokens ?? 0),
      totalTokensObserved: Math.round(record.totalTokensObserved ?? 0),
      observationTokenCount: Math.round(record.observationTokenCount ?? 0),
      observedMessageIds: nullableJsonBind(record.observedMessageIds),
      observedTimezone: record.observedTimezone ?? null,
      bufferedObservations: nullableClobBind(record.bufferedObservations),
      bufferedObservationTokens: record.bufferedObservationTokens ?? null,
      bufferedMessageIds: nullableJsonBind(record.bufferedMessageIds),
      bufferedReflection: nullableClobBind(record.bufferedReflection),
      bufferedReflectionTokens: record.bufferedReflectionTokens ?? null,
      bufferedReflectionInputTokens: record.bufferedReflectionInputTokens ?? null,
      reflectedObservationLineCount: record.reflectedObservationLineCount ?? null,
      bufferedObservationChunks: nullableJsonBind(record.bufferedObservationChunks),
      isObserving: boolToNumber(record.isObserving),
      isReflecting: boolToNumber(record.isReflecting),
      isBufferingObservation: boolToNumber(record.isBufferingObservation),
      isBufferingReflection: boolToNumber(record.isBufferingReflection),
      lastBufferedAtTokens: Math.round(record.lastBufferedAtTokens ?? 0),
      lastBufferedAtTime: record.lastBufferedAtTime ?? null,
      metadata: nullableJsonBind(record.metadata),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    },
  );
}

async function updateOMFlag(ctx: MemoryContext, id: string, column: string, value: boolean, operation: string): Promise<void> {
  try {
    await updateOMColumns(ctx, id, operation, { [column]: boolToNumber(value) });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError(operation, 'FAILED', { id, value }, error);
  }
}

async function updateOMColumns(ctx: MemoryContext, id: string, operation: string, columns: Record<string, unknown>): Promise<void> {
  await ctx.db.tx(async (_client, connection) => {
    const setParts = Object.keys(columns).map((column, index) => `${column} = :value${index}`);
    const binds = Object.fromEntries(Object.values(columns).map((value, index) => [`value${index}`, value]));
    const result = await connection.execute(
      `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         SET ${setParts.join(', ')},
             ${OM_UPDATED_AT} = :updatedAt
         WHERE id = :id`,
      { ...binds, id, updatedAt: new Date() },
    );
    assertRowsAffected(result.rowsAffected, operation, id);
  });
}

export function omSelect(): string {
  return `SELECT
    id AS "id",
    ${OM_LOOKUP_KEY} AS "lookupKey",
    ${OM_SCOPE} AS "scope",
    ${OM_RESOURCE_ID} AS "resourceId",
    ${OM_THREAD_ID} AS "threadId",
    ${OM_ACTIVE_OBSERVATIONS} AS "activeObservations",
    ${OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE} AS "activeObservationsPendingUpdate",
    ${OM_ORIGIN_TYPE} AS "originType",
    config AS "config",
    ${OM_GENERATION_COUNT} AS "generationCount",
    ${OM_LAST_OBSERVED_AT} AS "lastObservedAt",
    ${OM_LAST_REFLECTION_AT} AS "lastReflectionAt",
    ${OM_PENDING_MESSAGE_TOKENS} AS "pendingMessageTokens",
    ${OM_TOTAL_TOKENS_OBSERVED} AS "totalTokensObserved",
    ${OM_OBSERVATION_TOKEN_COUNT} AS "observationTokenCount",
    ${OM_IS_OBSERVING} AS "isObserving",
    ${OM_IS_REFLECTING} AS "isReflecting",
    ${OM_OBSERVED_MESSAGE_IDS} AS "observedMessageIds",
    ${OM_OBSERVED_TIMEZONE} AS "observedTimezone",
    ${OM_BUFFERED_OBSERVATIONS} AS "bufferedObservations",
    ${OM_BUFFERED_OBSERVATION_TOKENS} AS "bufferedObservationTokens",
    ${OM_BUFFERED_MESSAGE_IDS} AS "bufferedMessageIds",
    ${OM_BUFFERED_REFLECTION} AS "bufferedReflection",
    ${OM_BUFFERED_REFLECTION_TOKENS} AS "bufferedReflectionTokens",
    ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} AS "bufferedReflectionInputTokens",
    ${OM_REFLECTED_OBSERVATION_LINE_COUNT} AS "reflectedObservationLineCount",
    ${OM_BUFFERED_OBSERVATION_CHUNKS} AS "bufferedObservationChunks",
    ${OM_IS_BUFFERING_OBSERVATION} AS "isBufferingObservation",
    ${OM_IS_BUFFERING_REFLECTION} AS "isBufferingReflection",
    ${OM_LAST_BUFFERED_AT_TOKENS} AS "lastBufferedAtTokens",
    ${OM_LAST_BUFFERED_AT_TIME} AS "lastBufferedAtTime",
    metadata AS "metadata",
    ${OM_CREATED_AT} AS "createdAt",
    ${OM_UPDATED_AT} AS "updatedAt"`;
}

export function parseOMRow(row: ObservationalMemoryRow): ObservationalMemoryRecord {
  return {
    id: String(row.id),
    scope: row.scope,
    threadId: row.threadId === null || row.threadId === undefined ? null : String(row.threadId),
    resourceId: String(row.resourceId),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    lastObservedAt: row.lastObservedAt ? toDate(row.lastObservedAt) : undefined,
    originType: row.originType ?? 'initial',
    generationCount: numberOrZero(row.generationCount),
    activeObservations: stringOrEmpty(row.activeObservations),
    bufferedObservationChunks: parseBufferedChunks(row.bufferedObservationChunks),
    bufferedObservations: emptyToUndefined(row.bufferedObservations ?? row.activeObservationsPendingUpdate),
    bufferedObservationTokens: optionalNumber(row.bufferedObservationTokens),
    bufferedMessageIds: parseOptionalStringArray(row.bufferedMessageIds),
    bufferedReflection: emptyToUndefined(row.bufferedReflection),
    bufferedReflectionTokens: optionalNumber(row.bufferedReflectionTokens),
    bufferedReflectionInputTokens: optionalNumber(row.bufferedReflectionInputTokens),
    reflectedObservationLineCount: optionalNumber(row.reflectedObservationLineCount),
    totalTokensObserved: numberOrZero(row.totalTokensObserved),
    observationTokenCount: numberOrZero(row.observationTokenCount),
    pendingMessageTokens: numberOrZero(row.pendingMessageTokens),
    isReflecting: toBoolean(row.isReflecting),
    isObserving: toBoolean(row.isObserving),
    isBufferingObservation: toBoolean(row.isBufferingObservation),
    isBufferingReflection: toBoolean(row.isBufferingReflection),
    lastBufferedAtTokens: numberOrZero(row.lastBufferedAtTokens),
    lastBufferedAtTime: row.lastBufferedAtTime ? toDate(row.lastBufferedAtTime) : null,
    config: parseJson(row.config),
    metadata: parseOptionalJsonObject(row.metadata, { emptyObjectAsUndefined: true }),
    observedMessageIds: parseOptionalStringArray(row.observedMessageIds),
    observedTimezone: row.observedTimezone ? String(row.observedTimezone) : undefined,
  };
}
