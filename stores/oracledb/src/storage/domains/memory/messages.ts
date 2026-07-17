import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, MastraMessageV1 } from '@mastra/core/memory';
import { calculatePagination, normalizePerPage, TABLE_MESSAGES, TABLE_THREADS } from '@mastra/core/storage';
import type {
  StorageListMessagesByResourceIdInput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
} from '@mastra/core/storage';
import oracledb from 'oracledb';
import type { Connection } from 'oracledb';

import { asBindParameters, clobBind, executeOptions, rows } from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { quoteIdentifier } from '../../../vector/identifiers';
import type { OracleTxClient } from '../../db';
import { toDate } from '../../domain-utils';
import { MESSAGE_CREATED_AT, MESSAGE_RESOURCE_ID, THREAD_UPDATED_AT } from './schema';
import {
  chunkValues,
  deleteSemanticRecallVectorsByMessageIds,
  inClause,
  paginationClause,
  storageError,
  table,
} from './utils';
import type { MemoryContext } from './utils';

// Message CRUD, pagination/include windows, and batched saves. Deleting
// messages also sweeps their semantic-recall vectors (see utils.ts).
const MAX_MESSAGE_STRING_BIND_BYTES = 3900;

type MessageRow = {
  id: string;
  content: unknown;
  role: string;
  type?: string;
  createdAt: Date | string;
  threadId: string;
  resourceId?: string | null;
};

type MessageSaveBind = {
  id: string;
  threadId: string;
  content: string;
  role: string;
  type: string;
  createdAt: Date;
  resourceId: string;
};

export async function listMessagesById(
  ctx: MemoryContext,
  { messageIds }: { messageIds: string[] },
): Promise<{ messages: MastraDBMessage[] }> {
  if (messageIds.length === 0) return { messages: [] };

  try {
    return await ctx.db.withConnection(async connection => {
      const messageRows: MastraDBMessage[] = [];
      for (const [chunkIndex, chunk] of chunkValues(messageIds).entries()) {
        // Large include lists can exceed Oracle's bind limits. Chunking keeps
        // semantic recall and message include paths safe for long histories.
        const { sql, binds } = inClause(`messageId${chunkIndex}`, chunk);
        const result = await connection.execute<ObjectRow>(
          `${messageSelect()} FROM ${table(ctx, TABLE_MESSAGES)} WHERE id IN (${sql}) ORDER BY ${MESSAGE_CREATED_AT} DESC, id DESC`,
          asBindParameters(binds),
          executeOptions(),
        );
        messageRows.push(...rows(result).map(row => parseMessage(row as MessageRow)));
      }
      const list = new MessageList().add(
        sortMessages(messageRows, 'createdAt', 'DESC') as (MastraMessageV1 | MastraDBMessage)[],
        'memory',
      );
      return { messages: list.get.all.db() };
    });
  } catch (error) {
    throw storageError('LIST_MESSAGES_BY_ID', 'FAILED', { messageIds: messageIds.join(',') }, error);
  }
}

export async function listMessages(ctx: MemoryContext, args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
  const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
  const threadIds = (Array.isArray(threadId) ? threadId : [threadId]).filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0,
  );

  if (threadIds.length === 0) {
    throw storageError(
      'LIST_MESSAGES',
      'INVALID_THREAD_ID',
      { threadId: String(threadId) },
      new Error('threadId must be a non-empty string or array of non-empty strings'),
      ErrorCategory.USER,
    );
  }

  return listMessagesWithWhere(ctx, {
    operation: 'LIST_MESSAGES',
    baseFilter: { threadIds, resourceId },
    include,
    filter,
    perPageInput,
    page,
    orderBy,
  });
}

export async function listMessagesByResourceId(
  ctx: MemoryContext,
  args: StorageListMessagesByResourceIdInput,
): Promise<StorageListMessagesOutput> {
  const { resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
  if (!resourceId || !resourceId.trim()) {
    throw storageError(
      'LIST_MESSAGES_BY_RESOURCE_ID',
      'INVALID_QUERY',
      { resourceId: resourceId ?? '' },
      new Error('resourceId is required'),
      ErrorCategory.USER,
    );
  }

  return listMessagesWithWhere(ctx, {
    operation: 'LIST_MESSAGES_BY_RESOURCE_ID',
    baseFilter: { resourceId },
    include,
    filter,
    perPageInput,
    page,
    orderBy,
  });
}

export async function saveMessages(
  ctx: MemoryContext,
  { messages }: { messages: MastraDBMessage[] },
): Promise<{ messages: MastraDBMessage[] }> {
  if (messages.length === 0) return { messages: [] };

  const threadIds = new Set<string>();

  try {
    for (const message of messages) {
      if (!message.threadId || !message.resourceId) {
        throw storageError(
          'SAVE_MESSAGES',
          'FAILED',
          { messageId: message.id },
          new Error('Each message must include threadId and resourceId'),
          ErrorCategory.USER,
        );
      }
      threadIds.add(message.threadId);
    }

    for (const threadId of threadIds) {
      const thread = await ctx.getThreadById({ threadId });
      if (!thread) {
        throw storageError('SAVE_MESSAGES', 'FAILED', { threadId }, new Error(`Thread ${threadId} not found`), ErrorCategory.USER);
      }
    }

    await ctx.db.tx(async client => {
      await insertMessageBatch(ctx, client, messages);
    });

    const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
    return { messages: list.get.all.db() };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('SAVE_MESSAGES', 'FAILED', { threadIds: Array.from(threadIds).join(',') }, error);
  }
}

/**
 * Batch-inserts/merges message rows and touches their threads' updatedAt
 * against the given transactional client. Extracted out of `saveMessages` so
 * `cloneThread` (memory/index.ts) can run this in the SAME transaction as the
 * destination thread MERGE — a failure here must not leave an orphaned,
 * message-less cloned thread committed. Does not verify that the owning
 * thread exists; `saveMessages` checks that before opening its transaction.
 */
export async function insertMessageBatch(ctx: MemoryContext, client: OracleTxClient, messages: MastraDBMessage[]): Promise<void> {
  const threadIds = new Set<string>();
  const stringExecuteManyOptions: oracledb.ExecuteManyOptions = {
    bindDefs: {
      id: { type: oracledb.STRING, maxSize: 512 },
      threadId: { type: oracledb.STRING, maxSize: 512 },
      content: { type: oracledb.STRING, maxSize: 4000 },
      role: { type: oracledb.STRING, maxSize: 512 },
      type: { type: oracledb.STRING, maxSize: 64 },
      createdAt: { type: oracledb.DB_TYPE_TIMESTAMP_TZ },
      resourceId: { type: oracledb.STRING, maxSize: 512 },
    },
  };
  const clobExecuteManyOptions: oracledb.ExecuteManyOptions = {
    bindDefs: {
      ...stringExecuteManyOptions.bindDefs,
      content: { type: oracledb.DB_TYPE_CLOB },
    },
  };
  const stringMessageBinds: MessageSaveBind[] = [];
  const clobMessageBinds: MessageSaveBind[] = [];

  for (const message of messages) {
    const messageThreadId = message.threadId;
    const messageResourceId = message.resourceId;
    if (!messageThreadId || !messageResourceId) {
      throw new Error('Each message must include threadId and resourceId');
    }
    threadIds.add(messageThreadId);
    const content = serializeContent(message.content);
    const bind = {
      id: message.id,
      threadId: messageThreadId,
      content,
      role: message.role,
      type: message.type ?? 'v2',
      createdAt: message.createdAt ?? new Date(),
      resourceId: messageResourceId,
    };
    if (Buffer.byteLength(content, 'utf8') <= MAX_MESSAGE_STRING_BIND_BYTES) {
      stringMessageBinds.push(bind);
    } else {
      clobMessageBinds.push(bind);
    }
  }

  for (const chunk of chunkValues(stringMessageBinds, ctx.messageBatchSize)) {
    await client.executeMany(messageMergeSql(ctx), chunk, stringExecuteManyOptions);
  }
  // Large or multipart messages still use CLOB binds; small messages take
  // the cheaper string path above, which avoids CLOB allocation overhead.
  for (const chunk of chunkValues(clobMessageBinds, ctx.messageBatchSize)) {
    await client.executeMany(messageMergeSql(ctx), chunk, clobExecuteManyOptions);
  }

  const updatedAt = new Date();
  await client.executeMany(
    `UPDATE ${table(ctx, TABLE_THREADS)} SET ${THREAD_UPDATED_AT} = :updatedAt WHERE id = :threadId`,
    Array.from(threadIds, messageThreadId => ({ updatedAt, threadId: messageThreadId })),
  );
}

export async function updateMessages(
  ctx: MemoryContext,
  {
    messages,
  }: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  },
): Promise<MastraDBMessage[]> {
  if (messages.length === 0) return [];

  const messageIds = messages.map(message => message.id);
  const existingMessages = (await ctx.listMessagesById({ messageIds })).messages;
  if (existingMessages.length === 0) return [];

  const existingById = new Map(existingMessages.map(message => [message.id, message]));
  const threadIdsToUpdate = new Set<string>();

  try {
    await ctx.db.tx(async client => {
      // Message ids whose content/threadId/resourceId actually changed. Those
      // fields feed semantic-recall embeddings/metadata, so the vectors for
      // these ids are stale once the update below commits.
      const semanticRecallMessageIds: string[] = [];

      for (const updatePayload of messages) {
        const existing = existingById.get(updatePayload.id);
        if (!existing) continue;

        const { id, ...fieldsToUpdate } = updatePayload;
        if (Object.keys(fieldsToUpdate).length === 0) continue;

        const setParts: string[] = [];
        const binds: Record<string, unknown> = { id };
        let invalidatesSemanticRecallVectors = false;

        threadIdsToUpdate.add(existing.threadId!);
        if (fieldsToUpdate.threadId && fieldsToUpdate.threadId !== existing.threadId) {
          threadIdsToUpdate.add(fieldsToUpdate.threadId);
        }

        if (fieldsToUpdate.content) {
          setParts.push('content = :content');
          // Partial content updates merge into the stored V2 envelope instead
          // of overwriting metadata/content subfields independently.
          binds.content = clobBind(serializeContent(mergeMessageContent(existing.content, fieldsToUpdate.content)));
          invalidatesSemanticRecallVectors = true;
        }
        if (fieldsToUpdate.threadId) {
          setParts.push('thread_id = :threadId');
          binds.threadId = fieldsToUpdate.threadId;
          invalidatesSemanticRecallVectors = true;
        }
        if (fieldsToUpdate.resourceId) {
          setParts.push(`${MESSAGE_RESOURCE_ID} = :resourceId`);
          binds.resourceId = fieldsToUpdate.resourceId;
          invalidatesSemanticRecallVectors = true;
        }
        if (fieldsToUpdate.role) {
          setParts.push('role = :role');
          binds.role = fieldsToUpdate.role;
        }
        if (fieldsToUpdate.type) {
          setParts.push('type = :type');
          binds.type = fieldsToUpdate.type;
        }

        if (setParts.length > 0) {
          await client.none(`UPDATE ${table(ctx, TABLE_MESSAGES)} SET ${setParts.join(', ')} WHERE id = :id`, binds);
        }

        if (invalidatesSemanticRecallVectors) {
          semanticRecallMessageIds.push(id);
        }
      }

      if (semanticRecallMessageIds.length > 0) {
        // Delete stale semantic-recall vectors in the same transaction as the
        // message update, so a subsequent retrieval never surfaces embeddings
        // for content/thread/resource state that no longer exists.
        await deleteSemanticRecallVectorsByMessageIds(ctx, client, semanticRecallMessageIds);
      }

      const updatedAt = new Date();
      await client.executeMany(
        `UPDATE ${table(ctx, TABLE_THREADS)} SET ${THREAD_UPDATED_AT} = :updatedAt WHERE id = :threadId`,
        Array.from(threadIdsToUpdate, updatedThreadId => ({ updatedAt, threadId: updatedThreadId })),
      );
    });

    return (await ctx.listMessagesById({ messageIds })).messages;
  } catch (error) {
    throw storageError('UPDATE_MESSAGES', 'FAILED', { messageIds: messageIds.join(',') }, error);
  }
}

export async function deleteMessages(ctx: MemoryContext, messageIds: string[]): Promise<void> {
  if (!messageIds.length) return;

  try {
    await ctx.db.tx(async client => {
      const threadIds = new Set<string>();

      for (const [chunkIndex, chunk] of chunkValues(messageIds).entries()) {
        const { sql, binds } = inClause(`messageId${chunkIndex}`, chunk);
        const threadRows = await client.manyOrNone<ObjectRow>(
          `SELECT DISTINCT thread_id AS "threadId" FROM ${table(ctx, TABLE_MESSAGES)} WHERE id IN (${sql})`,
          binds,
        );
        for (const row of threadRows) {
          if (row.threadId) threadIds.add(String(row.threadId));
        }

        await client.none(`DELETE FROM ${table(ctx, TABLE_MESSAGES)} WHERE id IN (${sql})`, binds);
        await deleteSemanticRecallVectorsByMessageIds(ctx, client, chunk);
      }

      const updatedAt = new Date();
      await client.executeMany(
        `UPDATE ${table(ctx, TABLE_THREADS)} SET ${THREAD_UPDATED_AT} = :updatedAt WHERE id = :threadId`,
        Array.from(threadIds, updatedThreadId => ({ updatedAt, threadId: updatedThreadId })),
      );
    });
  } catch (error) {
    throw storageError('DELETE_MESSAGES', 'FAILED', { messageIds: messageIds.join(',') }, error);
  }
}

async function listMessagesWithWhere(
  ctx: MemoryContext,
  {
    operation,
    baseFilter,
    include,
    filter,
    perPageInput,
    page,
    orderBy,
  }: {
    operation: string;
    baseFilter: { threadIds?: string[]; resourceId?: string };
    include?: StorageListMessagesInput['include'];
    filter?: StorageListMessagesInput['filter'];
    perPageInput?: number | false;
    page: number;
    orderBy?: StorageListMessagesInput['orderBy'];
  },
): Promise<StorageListMessagesOutput> {
  try {
    ctx.validatePaginationInput(page, perPageInput ?? 40);
  } catch (error) {
    throw storageError(operation, 'INVALID_PAGE', { page }, error, ErrorCategory.USER);
  }

  const perPage = normalizePerPage(perPageInput, 40);
  const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

  try {
    return await ctx.db.withConnection(async connection => {
      const { field, direction } = ctx.parseOrderBy(orderBy, 'ASC');
      const { whereClause, binds } = messageWhereClause(baseFilter, filter);

      if (perPage === 0 && (!include || include.length === 0)) {
        return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      if (perPage === 0 && include && include.length > 0) {
        const includeMessages = await getIncludedMessages(ctx, connection, include);
        const list = new MessageList().add(includeMessages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
        return {
          messages: sortMessages(list.get.all.db(), field, direction),
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const countResult = await connection.execute<ObjectRow>(
        `SELECT COUNT(*) AS "count" FROM ${table(ctx, TABLE_MESSAGES)} ${whereClause}`,
        asBindParameters(binds),
        executeOptions(),
      );
      const total = Number(rows(countResult)[0]?.count ?? 0);

      const pagination = paginationClause(perPageInput, perPage, offset);
      const result = await connection.execute<ObjectRow>(
        `${messageSelect()} FROM ${table(ctx, TABLE_MESSAGES)} ${whereClause} ORDER BY ${messageOrderColumn(field)} ${direction}, id ${direction} ${pagination}`,
        asBindParameters(binds),
        executeOptions(),
      );
      const messages = rows(result).map(row => parseMessage(row as MessageRow));

      const messageIds = new Set(messages.map(message => message.id));
      if (include && include.length > 0) {
        // Included messages may fall outside the paged query. Merge by id,
        // then let MessageList normalize ordering and provider shape.
        const includeMessages = await getIncludedMessages(ctx, connection, include);
        for (const message of includeMessages) {
          if (!messageIds.has(message.id)) {
            messages.push(message);
            messageIds.add(message.id);
          }
        }
      }

      const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      const finalMessages = sortMessages(list.get.all.db(), field, direction);
      const baseThreadIds = new Set(baseFilter.threadIds ?? []);
      const returnedThreadMessageIds = new Set(
        finalMessages
          .filter(message => baseThreadIds.size === 0 || (message.threadId !== undefined && baseThreadIds.has(message.threadId)))
          .map(message => message.id),
      );
      const hasMore = perPageInput !== false && returnedThreadMessageIds.size < total && offset + perPage < total;

      return {
        messages: finalMessages,
        total,
        page,
        perPage: perPageForResponse,
        hasMore,
      };
    });
  } catch (error) {
    throw storageError(operation, 'FAILED', { page }, error);
  }
}

async function getIncludedMessages(
  ctx: MemoryContext,
  connection: Connection,
  include: NonNullable<StorageListMessagesInput['include']>,
): Promise<MastraDBMessage[]> {
  const targetIds = include.map(item => item.id).filter(Boolean);
  if (targetIds.length === 0) return [];

  const { sql, binds } = inClause('targetId', targetIds);
  const targetResult = await connection.execute<ObjectRow>(
    `SELECT id AS "id", thread_id AS "threadId", ${MESSAGE_CREATED_AT} AS "createdAt" FROM ${table(ctx, TABLE_MESSAGES)} WHERE id IN (${sql})`,
    asBindParameters(binds),
    executeOptions(),
  );
  const targetMap = new Map(rows(targetResult).map(row => [String(row.id), row]));
  const collected: MastraDBMessage[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < include.length; index += 1) {
    const item = include[index]!;
    const target = targetMap.get(item.id);
    if (!target) continue;

    const previousLimit = Math.max(0, item.withPreviousMessages ?? 0) + 1;
    const previousRows = await queryMessageWindow(ctx, connection, {
      threadId: String(target.threadId),
      createdAt: target.createdAt as Date | string,
      operator: '<=',
      direction: 'DESC',
      limit: previousLimit,
      bindPrefix: `prev${index}`,
    });

    for (const message of previousRows.reverse()) {
      if (!seen.has(message.id)) {
        collected.push(message);
        seen.add(message.id);
      }
    }

    const nextLimit = Math.max(0, item.withNextMessages ?? 0);
    if (nextLimit > 0) {
      const nextRows = await queryMessageWindow(ctx, connection, {
        threadId: String(target.threadId),
        createdAt: target.createdAt as Date | string,
        operator: '>',
        direction: 'ASC',
        limit: nextLimit,
        bindPrefix: `next${index}`,
      });
      for (const message of nextRows) {
        if (!seen.has(message.id)) {
          collected.push(message);
          seen.add(message.id);
        }
      }
    }
  }

  return collected;
}

async function queryMessageWindow(
  ctx: MemoryContext,
  connection: Connection,
  params: {
    threadId: string;
    createdAt: Date | string;
    operator: '<=' | '>';
    direction: 'ASC' | 'DESC';
    limit: number;
    bindPrefix: string;
  },
): Promise<MastraDBMessage[]> {
  const result = await connection.execute<ObjectRow>(
    `${messageSelect()} FROM ${table(ctx, TABLE_MESSAGES)} WHERE thread_id = :${params.bindPrefix}_threadId AND ${MESSAGE_CREATED_AT} ${params.operator} :${params.bindPrefix}_createdAt ORDER BY ${MESSAGE_CREATED_AT} ${params.direction}, id ${params.direction} FETCH FIRST ${params.limit} ROWS ONLY`,
    asBindParameters({
      [`${params.bindPrefix}_threadId`]: params.threadId,
      [`${params.bindPrefix}_createdAt`]: params.createdAt,
    }),
    executeOptions(),
  );
  return rows(result).map(row => parseMessage(row as MessageRow));
}

function messageWhereClause(
  baseFilter: { threadIds?: string[]; resourceId?: string },
  filter?: StorageListMessagesInput['filter'],
): { whereClause: string; binds: Record<string, unknown> } {
  const conditions: string[] = [];
  const binds: Record<string, unknown> = {};

  if (baseFilter.threadIds?.length) {
    const threadClause = inClause('threadId', baseFilter.threadIds);
    conditions.push(`thread_id IN (${threadClause.sql})`);
    Object.assign(binds, threadClause.binds);
  }
  if (baseFilter.resourceId) {
    conditions.push(`${MESSAGE_RESOURCE_ID} = :resourceId`);
    binds.resourceId = baseFilter.resourceId;
  }
  if (filter?.dateRange?.start) {
    conditions.push(`${MESSAGE_CREATED_AT} ${filter.dateRange.startExclusive ? '>' : '>='} :startDate`);
    binds.startDate = toDate(filter.dateRange.start);
  }
  if (filter?.dateRange?.end) {
    conditions.push(`${MESSAGE_CREATED_AT} ${filter.dateRange.endExclusive ? '<' : '<='} :endDate`);
    binds.endDate = toDate(filter.dateRange.end);
  }

  return { whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', binds };
}

function sortMessages(messages: MastraDBMessage[], field: string, direction: string): MastraDBMessage[] {
  return messages.sort((a, b) => {
    const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as Record<string, unknown>)[field];
    const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as Record<string, unknown>)[field];
    if (aValue === bValue) return a.id.localeCompare(b.id);
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    }
    return direction === 'ASC' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue));
  });
}

function parseMessage(row: MessageRow): MastraDBMessage {
  return {
    id: String(row.id),
    content: parseContent(row.content),
    role: String(row.role) as MastraDBMessage['role'],
    createdAt: toDate(row.createdAt),
    threadId: String(row.threadId),
    resourceId: row.resourceId === null || row.resourceId === undefined ? undefined : String(row.resourceId),
    ...(row.type && row.type !== 'v2' ? { type: String(row.type) } : {}),
  } satisfies MastraDBMessage;
}

function messageSelect(): string {
  return `SELECT id AS "id", content AS "content", role AS "role", type AS "type", ${MESSAGE_CREATED_AT} AS "createdAt", thread_id AS "threadId", ${MESSAGE_RESOURCE_ID} AS "resourceId"`;
}

function messageMergeSql(ctx: MemoryContext): string {
  return `
    MERGE INTO ${table(ctx, TABLE_MESSAGES)} target
    USING (
      SELECT
        :id AS id,
        :threadId AS thread_id,
        :content AS content,
        :role AS role,
        :type AS type,
        :createdAt AS created_at,
        :resourceId AS resource_id
      FROM dual
    ) source
    ON (target.id = source.id)
    WHEN MATCHED THEN UPDATE SET
      target.thread_id = source.thread_id,
      target.content = source.content,
      target.role = source.role,
      target.type = source.type,
      target.${MESSAGE_RESOURCE_ID} = source.resource_id
    WHEN NOT MATCHED THEN INSERT (
      id,
      thread_id,
      content,
      role,
      type,
      ${MESSAGE_CREATED_AT},
      ${MESSAGE_RESOURCE_ID}
    ) VALUES (
      source.id,
      source.thread_id,
      source.content,
      source.role,
      source.type,
      source.created_at,
      source.resource_id
    )`;
}

function messageOrderColumn(field: string): string {
  return field === 'createdAt' ? MESSAGE_CREATED_AT : quoteIdentifier(field, 'message order field');
}

function serializeContent(content: MastraDBMessage['content']): string {
  return typeof content === 'string' ? content : JSON.stringify(content);
}

function parseContent(value: unknown): MastraDBMessage['content'] {
  if (typeof value !== 'string') return value as MastraDBMessage['content'];
  try {
    return JSON.parse(value) as MastraDBMessage['content'];
  } catch {
    return value as unknown as MastraDBMessage['content'];
  }
}

function mergeMessageContent(
  existingContent: MastraDBMessage['content'],
  updateContent: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] },
): MastraDBMessage['content'] {
  if (typeof existingContent !== 'object' || existingContent === null || Array.isArray(existingContent)) {
    return updateContent as MastraDBMessage['content'];
  }

  return {
    ...existingContent,
    ...updateContent,
    ...('metadata' in existingContent && updateContent.metadata
      ? { metadata: { ...(existingContent.metadata ?? {}), ...updateContent.metadata } }
      : {}),
  } as MastraDBMessage['content'];
}
