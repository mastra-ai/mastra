import { randomUUID } from 'node:crypto';

import type { MastraError } from '@mastra/core/error';
import { ErrorCategory } from '@mastra/core/error';
import type { IMastraLogger } from '@mastra/core/logger';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  BufferedObservationChunk,
  StorageResourceType,
  ThreadOrderBy,
  ThreadSortDirection,
  StorageOrderBy,
} from '@mastra/core/storage';

import { clobBind, isOracleErrorCode } from '../../../shared/connection';
import { qualifyName } from '../../../vector/identifiers';
import type { OracleDB, OracleCreateIndexOptions, OracleTxClient } from '../../db';
import { createOracleStorageError, parseJsonValue, toDate } from '../../domain-utils';

// Shared helpers used across the memory domain modules (schema, threads, messages,
// resources, observational memory). Kept together so binds/parsing stay consistent
// no matter which sub-module reads or writes a row.
const STORE_NAME = 'ORACLEDB';

export const ORACLE_IN_LIMIT = 900;
export const EMPTY_STRING_SENTINEL = '__MASTRA_ORACLE_EMPTY_STRING__';
export const STRING_SENTINEL_ESCAPE_PREFIX = '__MASTRA_ORACLE_ESCAPED__';

/**
 * Per-call context every memory sub-module function receives instead of `this`.
 * Built fresh by `MemoryOracle` on every public method call so mocked/replaced
 * fields (e.g. tests swapping `db`) are always picked up.
 */
export interface MemoryContext {
  db: OracleDB;
  schemaName?: string;
  messageBatchSize: number;
  vectorRegistryTableName: string;
  skipDefaultIndexes?: boolean;
  indexes: OracleCreateIndexOptions[];
  logger: IMastraLogger;
  validatePaginationInput(page: number, perPageInput: number | false): void;
  validateMetadataKeys(metadata: Record<string, unknown> | undefined): void;
  parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection?: ThreadSortDirection,
  ): { field: ThreadOrderBy; direction: ThreadSortDirection };
  deepMergeConfig(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown>;
  // Bound references to the *public* MemoryOracle methods of the same name.
  // Other public methods that historically called `this.xyz(...)` internally
  // (e.g. saveMessages validating threads via getThreadById, updateResource
  // reading-then-writing) go through these instead of importing the sibling
  // module directly, so an instance-level override/mock (tests, subclasses)
  // is still honored exactly like it was on the single monolithic class.
  getThreadById(args: { threadId: string; resourceId?: string }): Promise<StorageThreadType | null>;
  listMessagesById(args: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }>;
  getResourceById(args: { resourceId: string }): Promise<StorageResourceType | null>;
  saveResource(args: { resource: StorageResourceType }): Promise<StorageResourceType>;
}

export function table(ctx: Pick<MemoryContext, 'schemaName'>, tableName: string): string {
  return qualifyName(tableName, ctx.schemaName);
}

export function storageError(
  operation: string,
  reason: string,
  details: Record<string, string | number | boolean | undefined>,
  cause: unknown,
  category: ErrorCategory = ErrorCategory.THIRD_PARTY,
): MastraError {
  return createOracleStorageError({ storeName: STORE_NAME, operation, reason, details, cause, category });
}

export function assertRowsAffected(rowsAffected: number | undefined, operation: string, id: string): void {
  if (rowsAffected && rowsAffected > 0) return;
  throw storageError(
    operation,
    'NOT_FOUND',
    { id },
    new Error(`Observational memory record not found: ${id}`),
    ErrorCategory.THIRD_PARTY,
  );
}

export function inClause(prefix: string, values: readonly string[]): { sql: string; binds: Record<string, unknown> } {
  const binds: Record<string, unknown> = {};
  const placeholders = values.map((value, index) => {
    const key = `${prefix}${index}`;
    binds[key] = value;
    return `:${key}`;
  });
  return { sql: placeholders.join(', '), binds };
}

export function chunkValues<T>(values: T[], size = ORACLE_IN_LIMIT): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export function boolToNumber(value: boolean | undefined): number {
  return value ? 1 : 0;
}

export function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE';
}

export function numberOrZero(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return numberOrZero(value);
}

export function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function emptyToUndefined(value: unknown): string | undefined {
  const stringValue = stringOrEmpty(value);
  return stringValue.length === 0 ? undefined : stringValue;
}

export function optionalStringBind(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return EMPTY_STRING_SENTINEL;
  if (value.startsWith(EMPTY_STRING_SENTINEL) || value.startsWith(STRING_SENTINEL_ESCAPE_PREFIX)) {
    return `${STRING_SENTINEL_ESCAPE_PREFIX}${value}`;
  }
  return value;
}

export function optionalClobStringBind(value: string | null | undefined) {
  const encoded = optionalStringBind(value);
  return encoded === null ? null : clobBind(encoded);
}

export function parseOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const stringValue = String(value);
  if (stringValue === EMPTY_STRING_SENTINEL) return '';
  if (stringValue.startsWith(STRING_SENTINEL_ESCAPE_PREFIX)) {
    return stringValue.slice(STRING_SENTINEL_ESCAPE_PREFIX.length);
  }
  return stringValue;
}

export function parseJson(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8')) as Record<string, unknown>;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return {};
}

export function paginationClause(perPageInput: number | false | undefined, perPage: number, offset: number): string {
  if (perPageInput === false) return '';
  return `OFFSET ${offset} ROWS FETCH NEXT ${perPage} ROWS ONLY`;
}

// Shared by observational.ts (row parsing) and observational-buffering.ts
// (buffer chunk reads/writes) so both agree on the buffered-chunk shape.
export function parseBufferedChunks(value: unknown): BufferedObservationChunk[] {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return [];
  return parsed.map(chunk => {
    const item = chunk as Partial<BufferedObservationChunk>;
    return {
      id: String(item.id ?? `ombuf-${randomUUID()}`),
      cycleId: String(item.cycleId ?? ''),
      observations: String(item.observations ?? ''),
      tokenCount: Math.round(numberOrZero(item.tokenCount)),
      messageIds: Array.isArray(item.messageIds) ? item.messageIds.map(id => String(id)) : [],
      messageTokens: Math.round(numberOrZero(item.messageTokens)),
      lastObservedAt: item.lastObservedAt ? toDate(item.lastObservedAt as Date | string) : new Date(),
      createdAt: item.createdAt ? toDate(item.createdAt as Date | string) : new Date(),
      suggestedContinuation: item.suggestedContinuation,
      currentTask: item.currentTask,
      threadTitle: item.threadTitle,
      extractedValues: item.extractedValues,
      extractionFailures: item.extractionFailures,
    };
  });
}

async function semanticRecallVectorTables(
  ctx: Pick<MemoryContext, 'schemaName' | 'vectorRegistryTableName'>,
  client: OracleTxClient,
): Promise<Array<{ tableName: string }>> {
  try {
    return await client.manyOrNone<{ tableName: string }>(
      `
      SELECT table_name AS "tableName"
      FROM ${qualifyName(ctx.vectorRegistryTableName, ctx.schemaName)}
      WHERE LOWER(index_name) = 'memory_messages'
         OR LOWER(index_name) LIKE 'memory_messages\\_%' ESCAPE '\\'
         OR LOWER(index_name) LIKE 'mastra_memory\\_%' ESCAPE '\\'`,
    );
  } catch (error) {
    if (isOracleErrorCode(error, [-942])) return [];
    throw error;
  }
}

// Semantic recall stores embeddings outside the threads/messages tables, so
// deleting a thread or a set of messages must also sweep those vector rows.
export async function deleteSemanticRecallVectors(
  ctx: Pick<MemoryContext, 'schemaName' | 'vectorRegistryTableName'>,
  client: OracleTxClient,
  threadId: string,
): Promise<void> {
  const vectorTables = await semanticRecallVectorTables(ctx, client);

  for (const { tableName } of vectorTables) {
    try {
      await client.none(
        `DELETE FROM ${qualifyName(tableName, ctx.schemaName)}
         WHERE JSON_VALUE(metadata, '$.thread_id' RETURNING VARCHAR2(512) NULL ON ERROR) = :threadId`,
        { threadId },
      );
    } catch (error) {
      if (!isOracleErrorCode(error, [-942])) throw error;
    }
  }
}

export async function deleteSemanticRecallVectorsByMessageIds(
  ctx: Pick<MemoryContext, 'schemaName' | 'vectorRegistryTableName'>,
  client: OracleTxClient,
  messageIds: readonly string[],
): Promise<void> {
  if (messageIds.length === 0) return;

  const vectorTables = await semanticRecallVectorTables(ctx, client);
  const { sql, binds } = inClause('semanticMessageId', messageIds);

  for (const { tableName } of vectorTables) {
    try {
      await client.none(
        `DELETE FROM ${qualifyName(tableName, ctx.schemaName)}
         WHERE JSON_VALUE(metadata, '$.message_id' RETURNING VARCHAR2(512) NULL ON ERROR) IN (${sql})`,
        binds,
      );
    } catch (error) {
      if (!isOracleErrorCode(error, [-942])) throw error;
    }
  }
}
