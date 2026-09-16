import { randomUUID } from 'node:crypto';

import { ErrorCategory, MastraError } from '@mastra/core/error';
import { TABLE_OBSERVATIONAL_MEMORY } from '@mastra/core/storage';
import type {
  ArchivedObservationGroup,
  ClearBufferedReflectionInput,
  CreateObservationArchiveGenerationInput,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  GetObservationArchiveInput,
  GetObservationArchiveResult,
  GetObservationArchivesByGroupIdsInput,
  GetObservationArchivesByGroupIdsResult,
  ListObservationArchivesInput,
  ListObservationArchivesResult,
  ObservationArchiveEntry,
  ObservationArchiveMetadata,
  ObservationGroupMetadata,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  UpdateActiveObservationsInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage';
import type { Connection } from 'oracledb';

import {
  asBindParameters,
  executeOptions,
  jsonBind,
  nullableClobBind,
  nullableJsonBind,
  rows,
} from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { toDate, parseJsonValue, parseOptionalJsonObject, parseOptionalStringArray } from '../../domain-utils';
import {
  OM_ACTIVE_OBSERVATIONS,
  OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE,
  OM_ARCHIVE,
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
  OM_OBSERVATION_GROUPS,
  OM_OBSERVATION_TOKEN_COUNT,
  OM_OBSERVED_MESSAGE_IDS,
  OM_OBSERVED_TIMEZONE,
  OM_ORIGIN_TYPE,
  OM_PENDING_MESSAGE_TOKENS,
  OM_RECORD_STATE,
  OM_REFLECTED_OBSERVATION_LINE_COUNT,
  OM_RESOURCE_ID,
  OM_SCOPE,
  OM_THREAD_ID,
  OM_TOTAL_TOKENS_OBSERVED,
  OM_UPDATED_AT,
  OM_WRITE_EPOCH,
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
  recordState?: 'active' | 'sealed';
  writeEpoch?: number | string;
  activeObservations?: unknown;
  activeObservationsPendingUpdate?: unknown;
  observationGroups?: unknown;
  archive?: unknown;
  originType?: 'initial' | 'reflection' | 'archive';
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

function parseObservationGroups(value: unknown): ObservationGroupMetadata[] | undefined {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.map(group => {
    const typed = group as ObservationGroupMetadata & { observedAt?: { from: string | Date; to: string | Date } };
    return {
      ...typed,
      observedAt: typed.observedAt
        ? { from: new Date(typed.observedAt.from), to: new Date(typed.observedAt.to) }
        : undefined,
    };
  });
}

function parseObservationArchive(value: unknown): ObservationArchiveMetadata | undefined {
  const parsed = parseJsonValue(value) as
    | (Omit<ObservationArchiveMetadata, 'archivedAt' | 'groups'> & {
        archivedAt: string | Date;
        groups: Array<ArchivedObservationGroup & { observedAt?: { from: string | Date; to: string | Date } }>;
      })
    | null;
  if (!parsed || typeof parsed !== 'object' || !('archiveId' in parsed)) return undefined;
  return {
    ...parsed,
    archivedAt: new Date(parsed.archivedAt),
    groups: (parseObservationGroups(parsed.groups) as ArchivedObservationGroup[] | undefined) ?? [],
  };
}

function normalizeArchiveSearchText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase();
}

function toObservationArchiveEntry(
  record: ObservationalMemoryRecord,
  input: Pick<ListObservationArchivesInput, 'scope' | 'resourceId' | 'threadId' | 'filterThreadId'>,
): ObservationArchiveEntry | null {
  const archive = record.archive;
  if (!archive || record.resourceId !== input.resourceId) return null;
  if (input.scope === 'thread' && record.scope === 'thread' && record.threadId !== input.threadId) return null;
  const projectedThreadId = input.scope === 'thread' ? input.threadId : input.filterThreadId;
  const groups = archive.groups.filter(group => {
    if (!projectedThreadId) return true;
    if (record.scope === 'thread') return record.threadId === projectedThreadId;
    return group.sourceThreadId === projectedThreadId;
  });
  if (groups.length === 0) return null;
  return {
    archiveId: archive.archiveId,
    recordId: record.id,
    scope: record.scope,
    threadId: record.threadId,
    resourceId: record.resourceId,
    archivedAt: archive.archivedAt,
    generationCount: record.generationCount,
    observationTokenCount: archive.observationTokenCount,
    groups,
  };
}

function encodeObservationArchiveCursor(entry: ObservationArchiveEntry): string {
  return Buffer.from(
    JSON.stringify({
      archivedAt: entry.archivedAt.toISOString(),
      generationCount: entry.generationCount,
      archiveId: entry.archiveId,
    }),
  ).toString('base64url');
}

function decodeObservationArchiveCursor(cursor: string): {
  archivedAt: string;
  generationCount: number;
  archiveId: string;
} {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (
      typeof value.archivedAt !== 'string' ||
      !Number.isFinite(new Date(value.archivedAt).getTime()) ||
      !Number.isInteger(value.generationCount) ||
      typeof value.archiveId !== 'string' ||
      !value.archiveId
    ) {
      throw new Error('invalid fields');
    }
    return {
      archivedAt: value.archivedAt,
      generationCount: value.generationCount as number,
      archiveId: value.archiveId,
    };
  } catch {
    throw new Error('Invalid observation archive cursor');
  }
}

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
           AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
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
    throw storageError(
      'GET_OBSERVATIONAL_MEMORY_HISTORY',
      'INVALID_INPUT',
      { resourceId, limit },
      error,
      ErrorCategory.USER,
    );
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
    throw storageError(
      'GET_OBSERVATIONAL_MEMORY_HISTORY',
      'FAILED',
      { threadId: threadId ?? '', resourceId, limit },
      error,
    );
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
    recordState: 'active',
    writeEpoch: 0,
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
    throw storageError(
      'INITIALIZE_OBSERVATIONAL_MEMORY',
      'FAILED',
      { threadId: input.threadId ?? '', resourceId: input.resourceId },
      error,
    );
  }
}

export async function insertObservationalMemoryRecord(
  ctx: MemoryContext,
  record: ObservationalMemoryRecord,
): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      await insertOMRecord(ctx, connection, record);
    });
  } catch (error) {
    throw storageError(
      'INSERT_OBSERVATIONAL_MEMORY_RECORD',
      'FAILED',
      { id: record.id, resourceId: record.resourceId },
      error,
    );
  }
}

export async function updateActiveObservations(
  ctx: MemoryContext,
  input: UpdateActiveObservationsInput,
): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      const result = await connection.execute(
        `
          UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
          SET ${OM_ACTIVE_OBSERVATIONS} = :activeObservations,
              ${OM_OBSERVATION_GROUPS} = :observationGroups,
              ${OM_LAST_OBSERVED_AT} = :lastObservedAt,
              ${OM_PENDING_MESSAGE_TOKENS} = 0,
              ${OM_OBSERVATION_TOKEN_COUNT} = :tokenCount,
              ${OM_TOTAL_TOKENS_OBSERVED} = COALESCE(${OM_TOTAL_TOKENS_OBSERVED}, 0) + :tokenCount,
              ${OM_OBSERVED_MESSAGE_IDS} = :observedMessageIds,
              ${OM_OBSERVED_TIMEZONE} = COALESCE(:observedTimezone, ${OM_OBSERVED_TIMEZONE}),
              ${OM_UPDATED_AT} = :updatedAt
          WHERE id = :id
            AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
            AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch`,
        {
          id: input.id,
          expectedWriteEpoch: input.expectedWriteEpoch ?? 0,
          activeObservations: nullableClobBind(input.observations),
          observationGroups: nullableJsonBind(input.observationGroups),
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
    recordState: 'active',
    writeEpoch: 0,
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
      const result = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         SET ${OM_BUFFERED_REFLECTION} = NULL,
             ${OM_BUFFERED_REFLECTION_TOKENS} = NULL,
             ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = NULL,
             ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = NULL,
             ${OM_IS_REFLECTING} = 0,
             ${OM_IS_BUFFERING_REFLECTION} = 0,
             ${OM_UPDATED_AT} = :updatedAt
         WHERE id = :id
           AND ${OM_GENERATION_COUNT} = :generationCount
           AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
           AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch`,
        {
          id: input.currentRecord.id,
          generationCount: input.currentRecord.generationCount,
          expectedWriteEpoch: input.expectedWriteEpoch ?? input.currentRecord.writeEpoch ?? 0,
          updatedAt: now,
        },
      );
      assertRowsAffected(result.rowsAffected, 'CREATE_REFLECTION_GENERATION', input.currentRecord.id);
      await insertOMRecord(ctx, connection, record, now);
    });
    return record;
  } catch (error) {
    throw storageError('CREATE_REFLECTION_GENERATION', 'FAILED', { id: input.currentRecord.id }, error);
  }
}

export async function createObservationArchiveGeneration(
  ctx: MemoryContext,
  input: CreateObservationArchiveGenerationInput,
): Promise<ObservationalMemoryRecord> {
  try {
    return await ctx.db.tx(async (_client, connection) => {
      const priorResult = await connection.execute<ObjectRow>(
        `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         WHERE JSON_VALUE(${OM_ARCHIVE}, '$.archiveId') = :archiveId FETCH FIRST 1 ROWS ONLY`,
        { archiveId: input.archiveId },
        executeOptions(),
      );
      const priorRow = rows(priorResult)[0] as ObservationalMemoryRow | undefined;
      if (priorRow) {
        const prior = parseOMRow(priorRow);
        const archive = prior.archive!;
        const sameTransition =
          archive.sourceRecordId === input.currentRecordId &&
          archive.sourceGenerationCount === input.expectedGenerationCount &&
          archive.sourceWriteEpoch === input.expectedWriteEpoch &&
          archive.contentDigest === input.contentDigest &&
          archive.groups.length === input.retiredGroups.length &&
          archive.groups.every((group, index) => group.groupId === input.retiredGroups[index]?.groupId);
        if (!sameTransition) {
          throw new Error(`Archive ID ${input.archiveId} is already bound to a different transition`);
        }
        const successorResult = await connection.execute<ObjectRow>(
          `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           WHERE id = :id FETCH FIRST 1 ROWS ONLY`,
          { id: archive.successorRecordId },
          executeOptions(),
        );
        const successorRow = rows(successorResult)[0] as ObservationalMemoryRow | undefined;
        if (!successorRow) throw new Error(`Archive successor not found: ${archive.successorRecordId}`);
        return parseOMRow(successorRow);
      }

      const currentResult = await connection.execute<ObjectRow>(
        `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         WHERE id = :id FOR UPDATE`,
        { id: input.currentRecordId },
        executeOptions(),
      );
      const currentRow = rows(currentResult)[0] as ObservationalMemoryRow | undefined;
      if (!currentRow) throw new Error(`Observational memory record not found: ${input.currentRecordId}`);
      const current = parseOMRow(currentRow);
      if (
        current.recordState !== 'active' ||
        (current.writeEpoch ?? 0) !== input.expectedWriteEpoch ||
        current.generationCount !== input.expectedGenerationCount
      ) {
        throw new Error(`Observational memory record is stale or sealed: ${input.currentRecordId}`);
      }

      const successorId = randomUUID();
      const archive = {
        archiveId: input.archiveId,
        archivedAt: input.archivedAt,
        sourceRecordId: current.id,
        successorRecordId: successorId,
        generationCount: current.generationCount,
        sourceGenerationCount: current.generationCount,
        sourceWriteEpoch: current.writeEpoch ?? 0,
        contentDigest: input.contentDigest,
        observationTokenCount: input.retiredObservationTokenCount,
        groups: input.retiredGroups,
      } satisfies ObservationArchiveMetadata;
      const sealed = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} SET
          ${OM_RECORD_STATE} = 'sealed', ${OM_UPDATED_AT} = :updatedAt,
          ${OM_ACTIVE_OBSERVATIONS} = :activeObservations, ${OM_OBSERVATION_GROUPS} = :observationGroups,
          ${OM_ARCHIVE} = :archive, ${OM_OBSERVATION_TOKEN_COUNT} = :observationTokenCount,
          ${OM_PENDING_MESSAGE_TOKENS} = 0, ${OM_BUFFERED_OBSERVATION_CHUNKS} = NULL,
          ${OM_BUFFERED_REFLECTION} = NULL, ${OM_BUFFERED_REFLECTION_TOKENS} = NULL,
          ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = NULL, ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = NULL,
          ${OM_IS_REFLECTING} = 0, ${OM_IS_OBSERVING} = 0,
          ${OM_IS_BUFFERING_OBSERVATION} = 0, ${OM_IS_BUFFERING_REFLECTION} = 0
         WHERE id = :id AND ${OM_GENERATION_COUNT} = :generationCount
           AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch
           AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'`,
        {
          updatedAt: input.archivedAt,
          activeObservations: nullableClobBind(input.retiredObservations),
          observationGroups: jsonBind(input.retiredGroups),
          archive: jsonBind(archive),
          observationTokenCount: Math.round(input.retiredObservationTokenCount),
          id: current.id,
          generationCount: input.expectedGenerationCount,
          expectedWriteEpoch: input.expectedWriteEpoch,
        },
      );
      assertRowsAffected(sealed.rowsAffected, 'CREATE_OBSERVATION_ARCHIVE_GENERATION', current.id);

      const successor: ObservationalMemoryRecord = {
        ...current,
        id: successorId,
        recordState: 'active',
        writeEpoch: 0,
        createdAt: input.archivedAt,
        updatedAt: input.archivedAt,
        originType: 'archive',
        generationCount: current.generationCount + 1,
        activeObservations: input.retainedObservations,
        observationGroups: input.retainedGroups,
        archive: undefined,
        observationTokenCount: input.retainedObservationTokenCount,
        bufferedReflection: undefined,
        bufferedReflectionTokens: undefined,
        bufferedReflectionInputTokens: undefined,
        reflectedObservationLineCount: undefined,
        isReflecting: false,
        isBufferingReflection: false,
      };
      await insertOMRecord(ctx, connection, successor, input.archivedAt);
      return successor;
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('CREATE_OBSERVATION_ARCHIVE_GENERATION', 'FAILED', { id: input.currentRecordId }, error);
  }
}

export async function listObservationArchives(
  ctx: MemoryContext,
  input: ListObservationArchivesInput,
): Promise<ListObservationArchivesResult> {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 20);
  if (input.scope === 'thread' && !input.threadId) {
    throw new Error('threadId is required for thread-scoped observation archive access');
  }
  const conditions = [`${OM_ARCHIVE} IS NOT NULL`, `${OM_RESOURCE_ID} = :resourceId`];
  const binds: Record<string, unknown> = { resourceId: input.resourceId, limit: limit + 1 };
  const projectedThreadId = input.scope === 'thread' ? input.threadId : input.filterThreadId;
  if (input.scope === 'thread') {
    conditions.push(`(${OM_SCOPE} = 'resource' OR (${OM_SCOPE} = 'thread' AND ${OM_THREAD_ID} = :threadId))`);
    binds.threadId = input.threadId;
  }
  const groupConditions: string[] = [];
  if (projectedThreadId) {
    groupConditions.push(
      `(${OM_SCOPE} = 'thread' AND ${OM_THREAD_ID} = :projectedThreadId OR ${OM_SCOPE} = 'resource' AND group_row.sourceThreadId = :projectedThreadId)`,
    );
    binds.projectedThreadId = projectedThreadId;
  }
  if (input.from) {
    groupConditions.push('group_row.observedTo >= :fromDate');
    binds.fromDate = input.from.toISOString();
  }
  if (input.to) {
    groupConditions.push('group_row.observedFrom <= :toDate');
    binds.toDate = input.to.toISOString();
  }
  if (input.text) {
    groupConditions.push('INSTR(group_row.searchText, :searchText) > 0');
    binds.searchText = normalizeArchiveSearchText(input.text);
  }
  if (groupConditions.length > 0) {
    conditions.push(`EXISTS (
      SELECT 1 FROM JSON_TABLE(${OM_ARCHIVE}, '$.groups[*]' COLUMNS(
        sourceThreadId VARCHAR2(512) PATH '$.sourceThreadId' NULL ON EMPTY,
        searchText VARCHAR2(4000) PATH '$.searchText' NULL ON EMPTY,
        observedFrom VARCHAR2(64) PATH '$.observedAt.from' NULL ON EMPTY,
        observedTo VARCHAR2(64) PATH '$.observedAt.to' NULL ON EMPTY
      )) group_row WHERE ${groupConditions.join(' AND ')}
    )`);
  }
  if (input.cursor) {
    const cursor = decodeObservationArchiveCursor(input.cursor);
    conditions.push(`(
      JSON_VALUE(${OM_ARCHIVE}, '$.archivedAt') < :cursorAt OR
      (JSON_VALUE(${OM_ARCHIVE}, '$.archivedAt') = :cursorAt AND ${OM_GENERATION_COUNT} < :cursorGeneration) OR
      (JSON_VALUE(${OM_ARCHIVE}, '$.archivedAt') = :cursorAt AND ${OM_GENERATION_COUNT} = :cursorGeneration
        AND JSON_VALUE(${OM_ARCHIVE}, '$.archiveId') < :cursorArchiveId)
    )`);
    binds.cursorAt = cursor.archivedAt;
    binds.cursorGeneration = cursor.generationCount;
    binds.cursorArchiveId = cursor.archiveId;
  }
  return ctx.db.withConnection(async connection => {
    const result = await connection.execute<ObjectRow>(
      `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
       WHERE ${conditions.join(' AND ')}
       ORDER BY JSON_VALUE(${OM_ARCHIVE}, '$.archivedAt') DESC, ${OM_GENERATION_COUNT} DESC,
         JSON_VALUE(${OM_ARCHIVE}, '$.archiveId') DESC FETCH FIRST :limit ROWS ONLY`,
      asBindParameters(binds),
      executeOptions(),
    );
    const normalizedText = input.text ? normalizeArchiveSearchText(input.text) : undefined;
    const entries = rows(result)
      .map(row => toObservationArchiveEntry(parseOMRow(row as ObservationalMemoryRow), input))
      .filter((entry): entry is ObservationArchiveEntry => entry !== null)
      .map(entry => ({
        ...entry,
        groups: entry.groups.filter(group => {
          if (input.from && (!group.observedAt || group.observedAt.to < input.from)) return false;
          if (input.to && (!group.observedAt || group.observedAt.from > input.to)) return false;
          if (normalizedText && !group.searchText.includes(normalizedText)) return false;
          return true;
        }),
      }))
      .filter(entry => entry.groups.length > 0);
    const hasMore = entries.length > limit;
    const archives = hasMore ? entries.slice(0, limit) : entries;
    return {
      archives,
      nextCursor: hasMore ? encodeObservationArchiveCursor(archives[archives.length - 1]!) : undefined,
    };
  });
}

export async function getObservationArchive(
  ctx: MemoryContext,
  input: GetObservationArchiveInput,
): Promise<GetObservationArchiveResult | null> {
  return ctx.db.withConnection(async connection => {
    const result = await connection.execute<ObjectRow>(
      `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
       WHERE ${OM_RESOURCE_ID} = :resourceId AND JSON_VALUE(${OM_ARCHIVE}, '$.archiveId') = :archiveId
       FETCH FIRST 1 ROWS ONLY`,
      { resourceId: input.resourceId, archiveId: input.archiveId },
      executeOptions(),
    );
    const row = rows(result)[0] as ObservationalMemoryRow | undefined;
    if (!row) return null;
    const record = parseOMRow(row);
    const entry = toObservationArchiveEntry(record, input);
    if (!entry) return null;
    const groups = input.groupId ? entry.groups.filter(group => group.groupId === input.groupId) : entry.groups;
    if (groups.length === 0) return null;
    entry.groups = groups;
    return {
      archive: entry,
      observations: groups.map(group => record.activeObservations.slice(group.textStart, group.textEnd)).join('\n\n'),
    };
  });
}

export async function getObservationArchivesByGroupIds(
  ctx: MemoryContext,
  input: GetObservationArchivesByGroupIdsInput,
): Promise<GetObservationArchivesByGroupIdsResult> {
  const groupIds = Array.from(new Set(input.groupIds));
  if (groupIds.length > 20) throw new Error('Observation archive group lookup supports at most 20 group IDs');
  if (groupIds.length === 0) return { matches: [] };
  if (input.scope === 'thread' && !input.threadId) {
    throw new Error('threadId is required for thread-scoped observation archive access');
  }
  const idBinds = Object.fromEntries(groupIds.map((groupId, index) => [`groupId${index}`, groupId]));
  const idPlaceholders = groupIds.map((_, index) => `:groupId${index}`).join(', ');
  const conditions = [
    `${OM_ARCHIVE} IS NOT NULL`,
    `${OM_RESOURCE_ID} = :resourceId`,
    `EXISTS (
      SELECT 1 FROM JSON_TABLE(${OM_ARCHIVE}, '$.groups[*]' COLUMNS(
        groupId VARCHAR2(512) PATH '$.groupId'
      )) group_row WHERE group_row.groupId IN (${idPlaceholders})
    )`,
  ];
  const binds: Record<string, unknown> = { resourceId: input.resourceId, ...idBinds };
  if (input.scope === 'thread') {
    conditions.push(`(${OM_SCOPE} = 'resource' OR (${OM_SCOPE} = 'thread' AND ${OM_THREAD_ID} = :threadId))`);
    binds.threadId = input.threadId;
  }
  return ctx.db.withConnection(async connection => {
    const result = await connection.execute<ObjectRow>(
      `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} WHERE ${conditions.join(' AND ')}
       ORDER BY JSON_VALUE(${OM_ARCHIVE}, '$.archivedAt') DESC, ${OM_GENERATION_COUNT} DESC,
         JSON_VALUE(${OM_ARCHIVE}, '$.archiveId') DESC FETCH FIRST 400 ROWS ONLY`,
      asBindParameters(binds),
      executeOptions(),
    );
    const requested = new Set(groupIds);
    const matches = rows(result)
      .map(row => toObservationArchiveEntry(parseOMRow(row as ObservationalMemoryRow), input))
      .filter((entry): entry is ObservationArchiveEntry => entry !== null)
      .map(archiveEntry => {
        const groups = archiveEntry.groups.filter(group => requested.has(group.groupId));
        archiveEntry.groups = groups;
        return { archive: archiveEntry, groupIds: groups.map(group => group.groupId) };
      })
      .filter(match => match.groupIds.length > 0);
    return { matches };
  });
}

export async function clearBufferedReflection(
  ctx: MemoryContext,
  input: ClearBufferedReflectionInput,
): Promise<ObservationalMemoryRecord> {
  return ctx.db.tx(async (_client, connection) => {
    const updated = await connection.execute(
      `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} SET
        ${OM_BUFFERED_REFLECTION} = NULL, ${OM_BUFFERED_REFLECTION_TOKENS} = NULL,
        ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = NULL, ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = NULL,
        ${OM_IS_REFLECTING} = 0, ${OM_IS_BUFFERING_REFLECTION} = 0,
        ${OM_WRITE_EPOCH} = COALESCE(${OM_WRITE_EPOCH}, 0) + 1, ${OM_UPDATED_AT} = :updatedAt
       WHERE id = :id AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
         AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch`,
      { id: input.id, expectedWriteEpoch: input.expectedWriteEpoch, updatedAt: new Date() },
    );
    assertRowsAffected(updated.rowsAffected, 'CLEAR_BUFFERED_REFLECTION', input.id);
    const result = await connection.execute<ObjectRow>(
      `${omSelect()} FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} WHERE id = :id`,
      { id: input.id },
      executeOptions(),
    );
    const row = rows(result)[0] as ObservationalMemoryRow | undefined;
    if (!row) throw new Error(`Observational memory record not found: ${input.id}`);
    return parseOMRow(row);
  });
}

export async function setReflectingFlag(
  ctx: MemoryContext,
  id: string,
  isReflecting: boolean,
  expectedWriteEpoch?: number,
): Promise<void> {
  await updateOMFlag(ctx, id, OM_IS_REFLECTING, isReflecting, 'SET_REFLECTING_FLAG', expectedWriteEpoch);
}

export async function setObservingFlag(
  ctx: MemoryContext,
  id: string,
  isObserving: boolean,
  expectedWriteEpoch?: number,
): Promise<void> {
  await updateOMFlag(ctx, id, OM_IS_OBSERVING, isObserving, 'SET_OBSERVING_FLAG', expectedWriteEpoch);
}

export async function setBufferingObservationFlag(
  ctx: MemoryContext,
  id: string,
  isBuffering: boolean,
  lastBufferedAtTokens?: number,
  expectedWriteEpoch?: number,
): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      const setTokens =
        lastBufferedAtTokens !== undefined ? `, ${OM_LAST_BUFFERED_AT_TOKENS} = :lastBufferedAtTokens` : '';
      const binds: Record<string, unknown> = {
        id,
        isBuffering: boolToNumber(isBuffering),
        updatedAt: new Date(),
        expectedWriteEpoch: expectedWriteEpoch ?? 0,
      };
      if (lastBufferedAtTokens !== undefined) {
        binds.lastBufferedAtTokens = Math.round(lastBufferedAtTokens);
      }

      const result = await connection.execute(
        `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
           SET ${OM_IS_BUFFERING_OBSERVATION} = :isBuffering,
               ${OM_UPDATED_AT} = :updatedAt
               ${setTokens}
           WHERE id = :id
             AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
             AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch`,
        asBindParameters(binds),
      );
      assertRowsAffected(result.rowsAffected, 'SET_BUFFERING_OBSERVATION_FLAG', id);
    });
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SET_BUFFERING_OBSERVATION_FLAG', 'FAILED', { id, isBuffering }, error);
  }
}

export async function setBufferingReflectionFlag(
  ctx: MemoryContext,
  id: string,
  isBuffering: boolean,
  expectedWriteEpoch?: number,
): Promise<void> {
  await updateOMFlag(
    ctx,
    id,
    OM_IS_BUFFERING_REFLECTION,
    isBuffering,
    'SET_BUFFERING_REFLECTION_FLAG',
    expectedWriteEpoch,
  );
}

export async function clearObservationalMemory(
  ctx: MemoryContext,
  threadId: string | null,
  resourceId: string,
): Promise<void> {
  try {
    const lookupKey = getOMKey(threadId, resourceId);
    await ctx.db.none(`DELETE FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)} WHERE ${OM_LOOKUP_KEY} = :lookupKey`, {
      lookupKey,
    });
  } catch (error) {
    throw storageError('CLEAR_OBSERVATIONAL_MEMORY', 'FAILED', { threadId: threadId ?? '', resourceId }, error);
  }
}

export async function setPendingMessageTokens(
  ctx: MemoryContext,
  id: string,
  tokenCount: number,
  expectedWriteEpoch?: number,
): Promise<void> {
  try {
    await updateOMColumns(
      ctx,
      id,
      'SET_PENDING_MESSAGE_TOKENS',
      { [OM_PENDING_MESSAGE_TOKENS]: Math.round(tokenCount) },
      expectedWriteEpoch,
    );
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SET_PENDING_MESSAGE_TOKENS', 'FAILED', { id, tokenCount }, error);
  }
}

export async function updateObservationalMemoryConfig(
  ctx: MemoryContext,
  input: UpdateObservationalMemoryConfigInput,
): Promise<void> {
  try {
    await ctx.db.tx(async (_client, connection) => {
      // Lock current config before deep-merging so concurrent observers do not
      // drop nested config keys written by another request.
      const result = await connection.execute<ObjectRow>(
        `SELECT config AS "config" FROM ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         WHERE id = :id AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
           AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch FOR UPDATE`,
        { id: input.id, expectedWriteEpoch: input.expectedWriteEpoch ?? 0 },
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
           WHERE id = :id AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
             AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch`,
        {
          id: input.id,
          expectedWriteEpoch: input.expectedWriteEpoch ?? 0,
          config: jsonBind(merged),
          updatedAt: new Date(),
        },
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
      ${OM_RECORD_STATE},
      ${OM_WRITE_EPOCH},
      ${OM_ACTIVE_OBSERVATIONS},
      ${OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE},
      ${OM_OBSERVATION_GROUPS},
      ${OM_ARCHIVE},
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
      :recordState,
      :writeEpoch,
      :activeObservations,
      :activeObservationsPendingUpdate,
      :observationGroups,
      :archive,
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
      recordState: record.recordState ?? 'active',
      writeEpoch: record.writeEpoch ?? 0,
      activeObservations: nullableClobBind(record.activeObservations ?? ''),
      activeObservationsPendingUpdate: nullableClobBind(record.bufferedObservations),
      observationGroups: nullableJsonBind(record.observationGroups),
      archive: nullableJsonBind(record.archive),
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

async function updateOMFlag(
  ctx: MemoryContext,
  id: string,
  column: string,
  value: boolean,
  operation: string,
  expectedWriteEpoch?: number,
): Promise<void> {
  try {
    await updateOMColumns(ctx, id, operation, { [column]: boolToNumber(value) }, expectedWriteEpoch);
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError(operation, 'FAILED', { id, value }, error);
  }
}

async function updateOMColumns(
  ctx: MemoryContext,
  id: string,
  operation: string,
  columns: Record<string, unknown>,
  expectedWriteEpoch?: number,
): Promise<void> {
  await ctx.db.tx(async (_client, connection) => {
    const setParts = Object.keys(columns).map((column, index) => `${column} = :value${index}`);
    const binds = Object.fromEntries(Object.values(columns).map((value, index) => [`value${index}`, value]));
    const result = await connection.execute(
      `UPDATE ${table(ctx, TABLE_OBSERVATIONAL_MEMORY)}
         SET ${setParts.join(', ')},
             ${OM_UPDATED_AT} = :updatedAt
         WHERE id = :id
           AND COALESCE(${OM_RECORD_STATE}, 'active') = 'active'
           AND COALESCE(${OM_WRITE_EPOCH}, 0) = :expectedWriteEpoch`,
      { ...binds, id, updatedAt: new Date(), expectedWriteEpoch: expectedWriteEpoch ?? 0 },
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
    ${OM_RECORD_STATE} AS "recordState",
    ${OM_WRITE_EPOCH} AS "writeEpoch",
    ${OM_ACTIVE_OBSERVATIONS} AS "activeObservations",
    ${OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE} AS "activeObservationsPendingUpdate",
    ${OM_OBSERVATION_GROUPS} AS "observationGroups",
    ${OM_ARCHIVE} AS "archive",
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
    recordState: row.recordState ?? 'active',
    writeEpoch: numberOrZero(row.writeEpoch),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
    lastObservedAt: row.lastObservedAt ? toDate(row.lastObservedAt) : undefined,
    originType: row.originType ?? 'initial',
    generationCount: numberOrZero(row.generationCount),
    activeObservations: stringOrEmpty(row.activeObservations),
    observationGroups: parseObservationGroups(row.observationGroups),
    archive: parseObservationArchive(row.archive),
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
