import { ErrorCategory, MastraError } from '@mastra/core/error';
import type { StorageThreadType } from '@mastra/core/memory';
import { calculatePagination, normalizePerPage, TABLE_MESSAGES, TABLE_THREADS } from '@mastra/core/storage';
import type { StorageListThreadsInput, StorageListThreadsOutput } from '@mastra/core/storage';

import { asBindParameters, executeOptions, jsonBind, rows } from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { assertJsonPath } from '../../../vector/identifiers';
import type { OracleTxClient } from '../../db';
import { toDate } from '../../domain-utils';
import { THREAD_CREATED_AT, THREAD_RESOURCE_ID, THREAD_UPDATED_AT } from './schema';
import {
  deleteSemanticRecallVectors,
  optionalStringBind,
  paginationClause,
  parseJson,
  parseOptionalString,
  storageError,
  table,
} from './utils';
import type { MemoryContext } from './utils';

// Thread CRUD + listing. Thread deletion also sweeps semantic-recall vectors
// and messages belonging to the thread (see utils.ts for the vector cleanup).

type ThreadRow = {
  id: string;
  resourceId: string;
  title?: string | null;
  metadata?: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

export async function getThreadById(
  ctx: MemoryContext,
  { threadId, resourceId }: { threadId: string; resourceId?: string },
): Promise<StorageThreadType | null> {
  try {
    return await ctx.db.withConnection(async connection => {
      const binds: Record<string, unknown> = { threadId };
      const conditions = ['id = :threadId'];
      if (resourceId !== undefined) {
        conditions.push(`${THREAD_RESOURCE_ID} = :resourceId`);
        binds.resourceId = resourceId;
      }

      const result = await connection.execute<ObjectRow>(
        `${threadSelect()} FROM ${table(ctx, TABLE_THREADS)} WHERE ${conditions.join(' AND ')}`,
        asBindParameters(binds),
        executeOptions(),
      );
      const row = rows(result)[0] as ThreadRow | undefined;
      return row ? parseThread(row) : null;
    });
  } catch (error) {
    throw storageError('GET_THREAD_BY_ID', 'FAILED', { threadId }, error);
  }
}

export async function saveThread(
  ctx: MemoryContext,
  { thread }: { thread: StorageThreadType },
): Promise<StorageThreadType> {
  try {
    await mergeThreadRow(ctx, ctx.db, thread);
    return thread;
  } catch (error) {
    throw storageError('SAVE_THREAD', 'FAILED', { threadId: thread.id }, error);
  }
}

/**
 * Upserts one thread row against the given client. Only `saveThread` may
 * upsert; `cloneThread` (memory/index.ts) uses the insert-only
 * `insertThreadRow` below so a concurrent clone can never overwrite an
 * existing destination thread.
 */
export async function mergeThreadRow(
  ctx: Pick<MemoryContext, 'schemaName'>,
  client: Pick<OracleTxClient, 'none'>,
  thread: StorageThreadType,
): Promise<void> {
  // Upsert threads because titles and metadata are often produced after the
  // first message, while the thread id must remain stable for memory lookups.
  await client.none(
    `
        MERGE INTO ${table(ctx, TABLE_THREADS)} target
        USING (
          SELECT
            :id AS id,
            :resourceId AS resource_id,
            :title AS title,
            :metadata AS metadata,
            :createdAt AS created_at,
            :updatedAt AS updated_at
          FROM dual
        ) source
        ON (target.id = source.id)
        WHEN MATCHED THEN UPDATE SET
          target.${THREAD_RESOURCE_ID} = source.resource_id,
          target.title = source.title,
          target.metadata = source.metadata,
          target.${THREAD_UPDATED_AT} = source.updated_at
        WHEN NOT MATCHED THEN INSERT (
          id,
          ${THREAD_RESOURCE_ID},
          title,
          metadata,
          ${THREAD_CREATED_AT},
          ${THREAD_UPDATED_AT}
        ) VALUES (
          source.id,
          source.resource_id,
          source.title,
          source.metadata,
          source.created_at,
          source.updated_at
        )`,
    {
      id: thread.id,
      resourceId: thread.resourceId,
      title: optionalStringBind(thread.title),
      metadata: jsonBind(thread.metadata ?? {}),
      createdAt: thread.createdAt ?? new Date(),
      updatedAt: thread.updatedAt ?? new Date(),
    },
  );
}

/**
 * Insert-only variant of `mergeThreadRow` for `cloneThread` (memory/index.ts).
 * The clone destination must be brand new, so an existing row has to fail the
 * INSERT (ORA-00001) — which the caller translates to DESTINATION_EXISTS —
 * instead of being silently updated by a MERGE. Runs against the caller's
 * transaction client, alongside the cloned-messages insert, so a failure
 * partway through rolls back the whole clone.
 */
export async function insertThreadRow(
  ctx: Pick<MemoryContext, 'schemaName'>,
  client: Pick<OracleTxClient, 'none'>,
  thread: StorageThreadType,
): Promise<void> {
  await client.none(
    `
        INSERT INTO ${table(ctx, TABLE_THREADS)} (
          id,
          ${THREAD_RESOURCE_ID},
          title,
          metadata,
          ${THREAD_CREATED_AT},
          ${THREAD_UPDATED_AT}
        ) VALUES (
          :id,
          :resourceId,
          :title,
          :metadata,
          :createdAt,
          :updatedAt
        )`,
    {
      id: thread.id,
      resourceId: thread.resourceId,
      title: optionalStringBind(thread.title),
      metadata: jsonBind(thread.metadata ?? {}),
      createdAt: thread.createdAt ?? new Date(),
      updatedAt: thread.updatedAt ?? new Date(),
    },
  );
}

export async function updateThread(
  ctx: MemoryContext,
  {
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  },
): Promise<StorageThreadType> {
  const existingThread = await ctx.getThreadById({ threadId: id });
  if (!existingThread) {
    throw storageError(
      'UPDATE_THREAD',
      'FAILED',
      { threadId: id, title },
      new Error(`Thread ${id} not found`),
      ErrorCategory.USER,
    );
  }

  const mergedMetadata = { ...(existingThread.metadata ?? {}), ...metadata };
  const updatedAt = new Date();

  try {
    await ctx.db.none(
      `
          UPDATE ${table(ctx, TABLE_THREADS)}
          SET title = :title,
              metadata = :metadata,
              ${THREAD_UPDATED_AT} = :updatedAt
          WHERE id = :id`,
      {
        id,
        title: optionalStringBind(title),
        metadata: jsonBind(mergedMetadata),
        updatedAt,
      },
    );

    const updatedThread = await ctx.getThreadById({ threadId: id });
    if (!updatedThread) {
      throw storageError('UPDATE_THREAD', 'FAILED', { threadId: id, title }, new Error(`Thread ${id} not found after update`));
    }
    return updatedThread;
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('UPDATE_THREAD', 'FAILED', { threadId: id, title }, error);
  }
}

export async function deleteThread(ctx: MemoryContext, { threadId }: { threadId: string }): Promise<void> {
  try {
    await ctx.db.tx(async client => {
      await client.none(`DELETE FROM ${table(ctx, TABLE_MESSAGES)} WHERE thread_id = :threadId`, { threadId });
      // Semantic recall stores embeddings outside the messages table; delete
      // those vector rows in the same transaction as thread/message cleanup.
      await deleteSemanticRecallVectors(ctx, client, threadId);
      await client.none(`DELETE FROM ${table(ctx, TABLE_THREADS)} WHERE id = :threadId`, { threadId });
    });
  } catch (error) {
    throw storageError('DELETE_THREAD', 'FAILED', { threadId }, error);
  }
}

export async function listThreads(ctx: MemoryContext, args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
  const { page = 0, perPage: perPageInput, orderBy, filter } = args;

  try {
    ctx.validatePaginationInput(page, perPageInput ?? 100);
    ctx.validateMetadataKeys(filter?.metadata);
  } catch (error) {
    throw storageError('LIST_THREADS', 'INVALID_INPUT', { page }, error, ErrorCategory.USER);
  }

  const perPage = normalizePerPage(perPageInput, 100);
  const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

  try {
    return await ctx.db.withConnection(async connection => {
      const { field, direction } = ctx.parseOrderBy(orderBy);
      const { sql: whereClause, binds } = threadWhereClause(filter);
      const baseQuery = `FROM ${table(ctx, TABLE_THREADS)} ${whereClause}`;
      // Count before fetching rows so the response can match Mastra's
      // pagination contract even when this page is empty.
      const countResult = await connection.execute<ObjectRow>(
        `SELECT COUNT(*) AS "count" ${baseQuery}`,
        asBindParameters(binds),
        executeOptions(),
      );
      const total = Number(rows(countResult)[0]?.count ?? 0);

      if (total === 0 || perPage === 0) {
        return { threads: [], total, page, perPage: perPageForResponse, hasMore: false };
      }

      const pagination = paginationClause(perPageInput, perPage, offset);
      const result = await connection.execute<ObjectRow>(
        `${threadSelect()} ${baseQuery} ORDER BY ${threadOrderColumn(field)} ${direction} ${pagination}`,
        asBindParameters(binds),
        executeOptions(),
      );
      const threads = rows(result).map(row => parseThread(row as ThreadRow));

      return {
        threads,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    });
  } catch (error) {
    throw storageError('LIST_THREADS', 'FAILED', { page }, error);
  }
}

function threadWhereClause(filter?: StorageListThreadsInput['filter']): { sql: string; binds: Record<string, unknown> } {
  const conditions: string[] = [];
  const binds: Record<string, unknown> = {};
  if (filter?.resourceId) {
    conditions.push(`${THREAD_RESOURCE_ID} = :resourceId`);
    binds.resourceId = filter.resourceId;
  }
  if (filter?.metadata) {
    let index = 0;
    for (const [key, value] of Object.entries(filter.metadata)) {
      const bindName = `metadata${index++}`;
      conditions.push(`${jsonValue('metadata', key, value)} = :${bindName}`);
      binds[bindName] = normalizeMetadataBind(value);
    }
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', binds };
}

function jsonValue(column: string, path: string, comparisonValue: unknown): string {
  const jsonPath = assertJsonPath(path);
  if (typeof comparisonValue === 'number') {
    return `JSON_VALUE(${column}, '${jsonPath}' RETURNING NUMBER NULL ON ERROR)`;
  }
  return `JSON_VALUE(${column}, '${jsonPath}' RETURNING VARCHAR2(4000) NULL ON ERROR)`;
}

function normalizeMetadataBind(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return String(value);
  return value;
}

function parseThread(row: ThreadRow): StorageThreadType {
  return {
    id: String(row.id),
    resourceId: String(row.resourceId),
    title: parseOptionalString(row.title),
    metadata: parseJson(row.metadata),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function threadSelect(): string {
  return `SELECT id AS "id", ${THREAD_RESOURCE_ID} AS "resourceId", title AS "title", metadata AS "metadata", ${THREAD_CREATED_AT} AS "createdAt", ${THREAD_UPDATED_AT} AS "updatedAt"`;
}

function threadOrderColumn(field: string): string {
  return field === 'updatedAt' ? THREAD_UPDATED_AT : THREAD_CREATED_AT;
}
