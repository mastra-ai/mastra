import { randomUUID } from 'node:crypto';

import { MessageList } from '@mastra/core/agent';
import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, MastraMessageV1, StorageThreadType } from '@mastra/core/memory';
import {
  calculatePagination,
  MemoryStorage,
  normalizePerPage,
  TABLE_MESSAGES,
  TABLE_OBSERVATIONAL_MEMORY,
  TABLE_RESOURCES,
  TABLE_THREADS,
} from '@mastra/core/storage';
import type {
  BufferedObservationChunk,
  CreateObservationalMemoryInput,
  CreateReflectionGenerationInput,
  ObservationalMemoryHistoryOptions,
  ObservationalMemoryRecord,
  StorageCloneThreadInput,
  StorageCloneThreadOutput,
  StorageListMessagesByResourceIdInput,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsInput,
  StorageListThreadsOutput,
  StorageResourceType,
  SwapBufferedReflectionToActiveInput,
  SwapBufferedToActiveInput,
  SwapBufferedToActiveResult,
  ThreadCloneMetadata,
  UpdateActiveObservationsInput,
  UpdateBufferedObservationsInput,
  UpdateBufferedReflectionInput,
  UpdateObservationalMemoryConfigInput,
} from '@mastra/core/storage';
import oracledb from 'oracledb';
import type { Connection } from 'oracledb';

import {
  asBindParameters,
  clobBind,
  executeDdl,
  executeOptions,
  isOracleErrorCode,
  jsonBind,
  normalizeBatchSize,
  nullableClobBind,
  nullableJsonBind,
  rows,
} from '../../../shared/connection';
import type { ObjectRow } from '../../../shared/connection';
import { assertJsonPath, indexNameForTable, qualifyName, quoteIdentifier } from '../../../vector/identifiers';
import { OracleDB, createOracleIndex, filterIndexesForTables } from '../../db';
import type { OracleCreateIndexOptions, OracleTxClient } from '../../db';
import {
  createOracleStorageError,
  parseJsonValue,
  parseOptionalJsonObject,
  parseOptionalStringArray,
  toDate,
} from '../../domain-utils';
import type { OracleDomainConfig } from '../../types';

// Memory is the highest-traffic storage domain. It owns conversation threads,
// messages, resources/working memory, and observational memory state.
const STORE_NAME = 'ORACLEDB';
const DEFAULT_MESSAGE_SAVE_BATCH_SIZE = 200;
const MAX_MESSAGE_STRING_BIND_BYTES = 3900;

const THREAD_RESOURCE_ID = '"resourceId"';
const THREAD_CREATED_AT = '"createdAt"';
const THREAD_UPDATED_AT = '"updatedAt"';
const MESSAGE_RESOURCE_ID = '"resourceId"';
const MESSAGE_CREATED_AT = '"createdAt"';
const RESOURCE_WORKING_MEMORY = '"workingMemory"';
const RESOURCE_CREATED_AT = '"createdAt"';
const RESOURCE_UPDATED_AT = '"updatedAt"';
const OM_LOOKUP_KEY = '"lookupKey"';
const OM_SCOPE = '"scope"';
const OM_RESOURCE_ID = '"resourceId"';
const OM_THREAD_ID = '"threadId"';
const OM_ACTIVE_OBSERVATIONS = '"activeObservations"';
const OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE = '"activeObservationsPendingUpdate"';
const OM_ORIGIN_TYPE = '"originType"';
const OM_GENERATION_COUNT = '"generationCount"';
const OM_LAST_OBSERVED_AT = '"lastObservedAt"';
const OM_LAST_REFLECTION_AT = '"lastReflectionAt"';
const OM_PENDING_MESSAGE_TOKENS = '"pendingMessageTokens"';
const OM_TOTAL_TOKENS_OBSERVED = '"totalTokensObserved"';
const OM_OBSERVATION_TOKEN_COUNT = '"observationTokenCount"';
const OM_IS_OBSERVING = '"isObserving"';
const OM_IS_REFLECTING = '"isReflecting"';
const OM_OBSERVED_MESSAGE_IDS = '"observedMessageIds"';
const OM_OBSERVED_TIMEZONE = '"observedTimezone"';
const OM_BUFFERED_OBSERVATIONS = '"bufferedObservations"';
const OM_BUFFERED_OBSERVATION_TOKENS = '"bufferedObservationTokens"';
const OM_BUFFERED_MESSAGE_IDS = '"bufferedMessageIds"';
const OM_BUFFERED_REFLECTION = '"bufferedReflection"';
const OM_BUFFERED_REFLECTION_TOKENS = '"bufferedReflectionTokens"';
const OM_BUFFERED_REFLECTION_INPUT_TOKENS = '"bufferedReflectionInputTokens"';
const OM_REFLECTED_OBSERVATION_LINE_COUNT = '"reflectedObservationLineCount"';
const OM_BUFFERED_OBSERVATION_CHUNKS = '"bufferedObservationChunks"';
const OM_IS_BUFFERING_OBSERVATION = '"isBufferingObservation"';
const OM_IS_BUFFERING_REFLECTION = '"isBufferingReflection"';
const OM_LAST_BUFFERED_AT_TOKENS = '"lastBufferedAtTokens"';
const OM_LAST_BUFFERED_AT_TIME = '"lastBufferedAtTime"';
const OM_CREATED_AT = '"createdAt"';
const OM_UPDATED_AT = '"updatedAt"';
const ORACLE_IN_LIMIT = 900;
const EMPTY_STRING_SENTINEL = '__MASTRA_ORACLE_EMPTY_STRING__';
const STRING_SENTINEL_ESCAPE_PREFIX = '__MASTRA_ORACLE_ESCAPED__';

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

type ThreadRow = {
  id: string;
  resourceId: string;
  title?: string | null;
  metadata?: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ResourceRow = {
  id: string;
  workingMemory?: unknown;
  metadata?: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type ObservationalMemoryRow = {
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

export class MemoryOracle extends MemoryStorage {
  readonly supportsObservationalMemory = true;
  // Memory owns all tables needed for normal message history plus observational memory state.
  static readonly MANAGED_TABLES = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES, TABLE_OBSERVATIONAL_MEMORY] as const;

  private readonly db: OracleDB;
  private readonly schemaName?: string;
  private readonly messageBatchSize: number;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes: OracleCreateIndexOptions[];

  constructor(config: OracleDomainConfig) {
    super();
    this.db = new OracleDB(config);
    this.schemaName = config.schemaName;
    this.messageBatchSize = normalizeBatchSize(config.messageBatchSize, 'messageBatchSize', DEFAULT_MESSAGE_SAVE_BATCH_SIZE);
    this.skipDefaultIndexes = config.skipDefaultIndexes;
    this.indexes = filterIndexesForTables(config.indexes, MemoryOracle.MANAGED_TABLES);
  }

  async init(): Promise<void> {
    await this.db.withConnection(async connection => {
      // Use one connection for table, column, and index setup so schema-qualified
      // deployments see a consistent Oracle session throughout initialization.
      await this.createTables(connection);
      await this.createIndexes(connection);
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.tx(async client => {
      await client.none(`DELETE FROM ${this.table(TABLE_OBSERVATIONAL_MEMORY)}`);
      await client.none(`DELETE FROM ${this.table(TABLE_MESSAGES)}`);
      await client.none(`DELETE FROM ${this.table(TABLE_THREADS)}`);
      await client.none(`DELETE FROM ${this.table(TABLE_RESOURCES)}`);
    });
  }

  async getThreadById({
    threadId,
    resourceId,
  }: {
    threadId: string;
    resourceId?: string;
  }): Promise<StorageThreadType | null> {
    try {
      return await this.db.withConnection(async connection => {
        const binds: Record<string, unknown> = { threadId };
        const conditions = ['id = :threadId'];
        if (resourceId !== undefined) {
          conditions.push(`${THREAD_RESOURCE_ID} = :resourceId`);
          binds.resourceId = resourceId;
        }

        const result = await connection.execute<ObjectRow>(
          `${this.threadSelect()} FROM ${this.table(TABLE_THREADS)} WHERE ${conditions.join(' AND ')}`,
          asBindParameters(binds),
          executeOptions(),
        );
        const row = rows(result)[0] as ThreadRow | undefined;
        return row ? this.parseThread(row) : null;
      });
    } catch (error) {
      throw this.storageError('GET_THREAD_BY_ID', 'FAILED', { threadId }, error);
    }
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      // Upsert threads because titles and metadata are often produced after the
      // first message, while the thread id must remain stable for memory lookups.
      await this.db.none(
        `
            MERGE INTO ${this.table(TABLE_THREADS)} target
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
      return thread;
    } catch (error) {
      throw this.storageError('SAVE_THREAD', 'FAILED', { threadId: thread.id }, error);
    }
  }

  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    const existingThread = await this.getThreadById({ threadId: id });
    if (!existingThread) {
      throw this.storageError('UPDATE_THREAD', 'FAILED', { threadId: id, title }, new Error(`Thread ${id} not found`), ErrorCategory.USER);
    }

    const mergedMetadata = { ...(existingThread.metadata ?? {}), ...metadata };
    const updatedAt = new Date();

    try {
      await this.db.none(
        `
            UPDATE ${this.table(TABLE_THREADS)}
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

      const updatedThread = await this.getThreadById({ threadId: id });
      if (!updatedThread) {
        throw this.storageError('UPDATE_THREAD', 'FAILED', { threadId: id, title }, new Error(`Thread ${id} not found after update`));
      }
      return updatedThread;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('UPDATE_THREAD', 'FAILED', { threadId: id, title }, error);
    }
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      await this.db.tx(async client => {
        await client.none(`DELETE FROM ${this.table(TABLE_MESSAGES)} WHERE thread_id = :threadId`, { threadId });
        // Semantic recall stores embeddings outside the messages table; delete
        // those vector rows in the same transaction as thread/message cleanup.
        await this.deleteSemanticRecallVectors(client, threadId);
        await client.none(`DELETE FROM ${this.table(TABLE_THREADS)} WHERE id = :threadId`, { threadId });
      });
    } catch (error) {
      throw this.storageError('DELETE_THREAD', 'FAILED', { threadId }, error);
    }
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, filter } = args;

    try {
      this.validatePaginationInput(page, perPageInput ?? 100);
      this.validateMetadataKeys(filter?.metadata);
    } catch (error) {
      throw this.storageError('LIST_THREADS', 'INVALID_INPUT', { page }, error, ErrorCategory.USER);
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      return await this.db.withConnection(async connection => {
        const { field, direction } = this.parseOrderBy(orderBy);
        const { sql: whereClause, binds } = this.threadWhereClause(filter);
        const baseQuery = `FROM ${this.table(TABLE_THREADS)} ${whereClause}`;
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

        const pagination = this.paginationClause(perPageInput, perPage, offset);
        const result = await connection.execute<ObjectRow>(
          `${this.threadSelect()} ${baseQuery} ORDER BY ${this.threadOrderColumn(field)} ${direction} ${pagination}`,
          asBindParameters(binds),
          executeOptions(),
        );
        const threads = rows(result).map(row => this.parseThread(row as ThreadRow));

        return {
          threads,
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + perPage < total,
        };
      });
    } catch (error) {
      throw this.storageError('LIST_THREADS', 'FAILED', { page }, error);
    }
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messageIds.length === 0) return { messages: [] };

    try {
      return await this.db.withConnection(async connection => {
        const messageRows: MastraDBMessage[] = [];
        for (const [chunkIndex, chunk] of chunkValues(messageIds).entries()) {
          // Large include lists can exceed Oracle's bind limits. Chunking keeps
          // semantic recall and message include paths safe for long histories.
          const { sql, binds } = inClause(`messageId${chunkIndex}`, chunk);
          const result = await connection.execute<ObjectRow>(
            `${this.messageSelect()} FROM ${this.table(TABLE_MESSAGES)} WHERE id IN (${sql}) ORDER BY ${MESSAGE_CREATED_AT} DESC, id DESC`,
            asBindParameters(binds),
            executeOptions(),
          );
          messageRows.push(...rows(result).map(row => this.parseMessage(row as MessageRow)));
        }
        const list = new MessageList().add(
          this.sortMessages(messageRows, 'createdAt', 'DESC') as (MastraMessageV1 | MastraDBMessage)[],
          'memory',
        );
        return { messages: list.get.all.db() };
      });
    } catch (error) {
      throw this.storageError('LIST_MESSAGES_BY_ID', 'FAILED', { messageIds: messageIds.join(',') }, error);
    }
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    const { threadId, resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
    const threadIds = (Array.isArray(threadId) ? threadId : [threadId]).filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    );

    if (threadIds.length === 0) {
      throw this.storageError('LIST_MESSAGES', 'INVALID_THREAD_ID', { threadId: String(threadId) }, new Error('threadId must be a non-empty string or array of non-empty strings'), ErrorCategory.USER);
    }

    return this.listMessagesWithWhere({
      operation: 'LIST_MESSAGES',
      baseFilter: { threadIds, resourceId },
      include,
      filter,
      perPageInput,
      page,
      orderBy,
    });
  }

  async listMessagesByResourceId(args: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    const { resourceId, include, filter, perPage: perPageInput, page = 0, orderBy } = args;
    if (!resourceId || !resourceId.trim()) {
      throw this.storageError('LIST_MESSAGES_BY_RESOURCE_ID', 'INVALID_QUERY', { resourceId: resourceId ?? '' }, new Error('resourceId is required'), ErrorCategory.USER);
    }

    return this.listMessagesWithWhere({
      operation: 'LIST_MESSAGES_BY_RESOURCE_ID',
      baseFilter: { resourceId },
      include,
      filter,
      perPageInput,
      page,
      orderBy,
    });
  }

  async saveMessages({ messages }: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    if (messages.length === 0) return { messages: [] };

    const threadId = messages[0]?.threadId;
    if (!threadId) {
      throw this.storageError('SAVE_MESSAGES', 'FAILED', {}, new Error('Thread ID is required'), ErrorCategory.USER);
    }

    const thread = await this.getThreadById({ threadId });
    if (!thread) {
      throw this.storageError('SAVE_MESSAGES', 'FAILED', { threadId }, new Error(`Thread ${threadId} not found`), ErrorCategory.USER);
    }

    try {
      await this.db.tx(async client => {
        const threadIdsToUpdate = new Set<string>();
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
          if (!message.threadId || !message.resourceId) {
            throw new Error('Each message must include threadId and resourceId');
          }
          threadIdsToUpdate.add(message.threadId);
          const content = serializeContent(message.content);
          const bind = {
            id: message.id,
            threadId: message.threadId,
            content,
            role: message.role,
            type: message.type ?? 'v2',
            createdAt: message.createdAt ?? new Date(),
            resourceId: message.resourceId,
          };
          if (Buffer.byteLength(content, 'utf8') <= MAX_MESSAGE_STRING_BIND_BYTES) {
            stringMessageBinds.push(bind);
          } else {
            clobMessageBinds.push(bind);
          }
        }

        for (const chunk of chunkValues(stringMessageBinds, this.messageBatchSize)) {
          await client.executeMany(this.messageMergeSql(), chunk, stringExecuteManyOptions);
        }
        // Large or multipart messages still use CLOB binds; small messages take
        // the cheaper string path above, which avoids CLOB allocation overhead.
        for (const chunk of chunkValues(clobMessageBinds, this.messageBatchSize)) {
          await client.executeMany(this.messageMergeSql(), chunk, clobExecuteManyOptions);
        }

        const updatedAt = new Date();
        await client.executeMany(
          `UPDATE ${this.table(TABLE_THREADS)} SET ${THREAD_UPDATED_AT} = :updatedAt WHERE id = :threadId`,
          Array.from(threadIdsToUpdate, messageThreadId => ({ updatedAt, threadId: messageThreadId })),
        );
      });

      const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
      return { messages: list.get.all.db() };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('SAVE_MESSAGES', 'FAILED', { threadId }, error);
    }
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    if (messages.length === 0) return [];

    const messageIds = messages.map(message => message.id);
    const existingMessages = (await this.listMessagesById({ messageIds })).messages;
    if (existingMessages.length === 0) return [];

    const existingById = new Map(existingMessages.map(message => [message.id, message]));
    const threadIdsToUpdate = new Set<string>();

    try {
      await this.db.tx(async client => {
        for (const updatePayload of messages) {
          const existing = existingById.get(updatePayload.id);
          if (!existing) continue;

          const { id, ...fieldsToUpdate } = updatePayload;
          if (Object.keys(fieldsToUpdate).length === 0) continue;

          const setParts: string[] = [];
          const binds: Record<string, unknown> = { id };

          threadIdsToUpdate.add(existing.threadId!);
          if (fieldsToUpdate.threadId && fieldsToUpdate.threadId !== existing.threadId) {
            threadIdsToUpdate.add(fieldsToUpdate.threadId);
          }

          if (fieldsToUpdate.content) {
            setParts.push('content = :content');
            // Partial content updates merge into the stored V2 envelope instead
            // of overwriting metadata/content subfields independently.
            binds.content = clobBind(serializeContent(mergeMessageContent(existing.content, fieldsToUpdate.content)));
          }
          if (fieldsToUpdate.threadId) {
            setParts.push('thread_id = :threadId');
            binds.threadId = fieldsToUpdate.threadId;
          }
          if (fieldsToUpdate.resourceId) {
            setParts.push(`${MESSAGE_RESOURCE_ID} = :resourceId`);
            binds.resourceId = fieldsToUpdate.resourceId;
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
            await client.none(`UPDATE ${this.table(TABLE_MESSAGES)} SET ${setParts.join(', ')} WHERE id = :id`, binds);
          }
        }

        const updatedAt = new Date();
        await client.executeMany(
          `UPDATE ${this.table(TABLE_THREADS)} SET ${THREAD_UPDATED_AT} = :updatedAt WHERE id = :threadId`,
          Array.from(threadIdsToUpdate, updatedThreadId => ({ updatedAt, threadId: updatedThreadId })),
        );
      });

      return (await this.listMessagesById({ messageIds })).messages;
    } catch (error) {
      throw this.storageError('UPDATE_MESSAGES', 'FAILED', { messageIds: messageIds.join(',') }, error);
    }
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    if (!messageIds.length) return;

    try {
      await this.db.tx(async client => {
        const threadIds = new Set<string>();

        for (const [chunkIndex, chunk] of chunkValues(messageIds).entries()) {
          const { sql, binds } = inClause(`messageId${chunkIndex}`, chunk);
          const threadRows = await client.manyOrNone<ObjectRow>(
            `SELECT DISTINCT thread_id AS "threadId" FROM ${this.table(TABLE_MESSAGES)} WHERE id IN (${sql})`,
            binds,
          );
          for (const row of threadRows) {
            if (row.threadId) threadIds.add(String(row.threadId));
          }

          await client.none(`DELETE FROM ${this.table(TABLE_MESSAGES)} WHERE id IN (${sql})`, binds);
        }

        const updatedAt = new Date();
        await client.executeMany(
          `UPDATE ${this.table(TABLE_THREADS)} SET ${THREAD_UPDATED_AT} = :updatedAt WHERE id = :threadId`,
          Array.from(threadIds, updatedThreadId => ({ updatedAt, threadId: updatedThreadId })),
        );
      });
    } catch (error) {
      throw this.storageError('DELETE_MESSAGES', 'FAILED', { messageIds: messageIds.join(',') }, error);
    }
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    try {
      return await this.db.withConnection(async connection => {
        const result = await connection.execute<ObjectRow>(
          `${this.resourceSelect()} FROM ${this.table(TABLE_RESOURCES)} WHERE id = :resourceId`,
          { resourceId },
          executeOptions(),
        );
        const row = rows(result)[0] as ResourceRow | undefined;
        return row ? this.parseResource(row) : null;
      });
    } catch (error) {
      throw this.storageError('GET_RESOURCE_BY_ID', 'FAILED', { resourceId }, error);
    }
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    try {
      await this.db.none(
        `
            MERGE INTO ${this.table(TABLE_RESOURCES)} target
            USING (
              SELECT
                :id AS id,
                :workingMemory AS working_memory,
                :metadata AS metadata,
                :createdAt AS created_at,
                :updatedAt AS updated_at
              FROM dual
            ) source
            ON (target.id = source.id)
            WHEN MATCHED THEN UPDATE SET
              target.${RESOURCE_WORKING_MEMORY} = source.working_memory,
              target.metadata = source.metadata,
              target.${RESOURCE_UPDATED_AT} = source.updated_at
            WHEN NOT MATCHED THEN INSERT (
              id,
              ${RESOURCE_WORKING_MEMORY},
              metadata,
              ${RESOURCE_CREATED_AT},
              ${RESOURCE_UPDATED_AT}
            ) VALUES (
              source.id,
              source.working_memory,
              source.metadata,
              source.created_at,
              source.updated_at
            )`,
        {
          id: resource.id,
          workingMemory: optionalClobStringBind(resource.workingMemory),
          metadata: jsonBind(resource.metadata ?? {}),
          createdAt: resource.createdAt ?? new Date(),
          updatedAt: resource.updatedAt ?? new Date(),
        },
      );
      return resource;
    } catch (error) {
      throw this.storageError('SAVE_RESOURCE', 'FAILED', { resourceId: resource.id }, error);
    }
  }

  async updateResource({
    resourceId,
    workingMemory,
    metadata,
  }: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    const existing = await this.getResourceById({ resourceId });
    if (!existing) {
      const resource: StorageResourceType = {
        id: resourceId,
        workingMemory,
        metadata: metadata ?? {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return this.saveResource({ resource });
    }

    const updated = {
      ...existing,
      workingMemory: workingMemory !== undefined ? workingMemory : existing.workingMemory,
      metadata: metadata ? { ...(existing.metadata ?? {}), ...metadata } : existing.metadata,
      updatedAt: new Date(),
    };

    await this.saveResource({ resource: updated });
    return updated;
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const sourceThread = await this.getThreadById({ threadId: args.sourceThreadId });
    if (!sourceThread) {
      throw this.storageError('CLONE_THREAD', 'FAILED', { threadId: args.sourceThreadId }, new Error(`Thread ${args.sourceThreadId} not found`), ErrorCategory.USER);
    }

    const sourceMessages = await this.messagesForClone(args);
    const newThreadId = args.newThreadId ?? randomUUID();
    const existingDestination = await this.getThreadById({ threadId: newThreadId });
    if (existingDestination) {
      throw this.storageError(
        'CLONE_THREAD',
        'DESTINATION_EXISTS',
        { threadId: newThreadId },
        new Error(`Thread ${newThreadId} already exists`),
        ErrorCategory.USER,
      );
    }
    const now = new Date();
    const cloneMetadata: ThreadCloneMetadata = {
      sourceThreadId: sourceThread.id,
      clonedAt: now,
      lastMessageId: sourceMessages.at(-1)?.id,
    };
    const thread: StorageThreadType = {
      id: newThreadId,
      resourceId: args.resourceId ?? sourceThread.resourceId,
      title: args.title ?? `${sourceThread.title ?? 'Thread'} (clone)`,
      metadata: { ...(sourceThread.metadata ?? {}), ...args.metadata, clone: cloneMetadata },
      createdAt: now,
      updatedAt: now,
    };

    const messageIdMap: Record<string, string> = {};
    // Preserve a source-to-clone id map so callers can reconnect tool calls,
    // UI selections, or traces to the cloned message ids.
    const clonedMessages = sourceMessages.map(message => {
      const newMessageId = randomUUID();
      messageIdMap[message.id] = newMessageId;
      return {
        ...message,
        id: newMessageId,
        threadId: newThreadId,
        resourceId: thread.resourceId,
        createdAt: new Date(message.createdAt),
      } satisfies MastraDBMessage;
    });

    await this.saveThread({ thread });
    if (clonedMessages.length) await this.saveMessages({ messages: clonedMessages });

    return { thread, clonedMessages, messageIdMap };
  }

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      // A resource can have global and thread-scoped observations. lookupKey
      // keeps those scopes independent while sharing one indexed table.
      return await this.db.withConnection(async connection => {
        const result = await connection.execute<ObjectRow>(
          `${this.omSelect()} FROM ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
           WHERE ${OM_LOOKUP_KEY} = :lookupKey
           ORDER BY ${OM_GENERATION_COUNT} DESC
           FETCH FIRST 1 ROWS ONLY`,
          asBindParameters({ lookupKey }),
          executeOptions(),
        );
        const row = rows(result)[0] as ObservationalMemoryRow | undefined;
        return row ? this.parseOMRow(row) : null;
      });
    } catch (error) {
      throw this.storageError('GET_OBSERVATIONAL_MEMORY', 'FAILED', { threadId: threadId ?? '', resourceId }, error);
    }
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit = 10,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    try {
      this.validatePaginationInput(options?.offset ?? 0, limit);
    } catch (error) {
      throw this.storageError('GET_OBSERVATIONAL_MEMORY_HISTORY', 'INVALID_INPUT', { resourceId, limit }, error, ErrorCategory.USER);
    }

    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
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

      return await this.db.withConnection(async connection => {
        const result = await connection.execute<ObjectRow>(
          `${this.omSelect()} FROM ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
           WHERE ${conditions.join(' AND ')}
           ORDER BY ${OM_GENERATION_COUNT} DESC
           OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
          asBindParameters({ offset: options?.offset ?? 0, ...binds }),
          executeOptions(),
        );
        return rows(result).map(row => this.parseOMRow(row as ObservationalMemoryRow));
      });
    } catch (error) {
      throw this.storageError('GET_OBSERVATIONAL_MEMORY_HISTORY', 'FAILED', { threadId: threadId ?? '', resourceId, limit }, error);
    }
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
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
      await this.db.tx(async (_client, connection) => {
        await this.insertOMRecord(connection, record);
      });
      return record;
    } catch (error) {
      throw this.storageError('INITIALIZE_OBSERVATIONAL_MEMORY', 'FAILED', { threadId: input.threadId ?? '', resourceId: input.resourceId }, error);
    }
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    try {
      await this.db.tx(async (_client, connection) => {
        await this.insertOMRecord(connection, record);
      });
    } catch (error) {
      throw this.storageError('INSERT_OBSERVATIONAL_MEMORY_RECORD', 'FAILED', { id: record.id, resourceId: record.resourceId }, error);
    }
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    try {
      await this.db.tx(async (_client, connection) => {
        const result = await connection.execute(
          `
            UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
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
        this.assertRowsAffected(result.rowsAffected, 'UPDATE_ACTIVE_OBSERVATIONS', input.id);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('UPDATE_ACTIVE_OBSERVATIONS', 'FAILED', { id: input.id }, error);
    }
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
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
      await this.db.tx(async (_client, connection) => {
        await this.insertOMRecord(connection, record, now);
      });
      return record;
    } catch (error) {
      throw this.storageError('CREATE_REFLECTION_GENERATION', 'FAILED', { id: input.currentRecord.id }, error);
    }
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    await this.updateOMFlag(id, OM_IS_REFLECTING, isReflecting, 'SET_REFLECTING_FLAG');
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    await this.updateOMFlag(id, OM_IS_OBSERVING, isObserving, 'SET_OBSERVING_FLAG');
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    try {
      await this.db.tx(async (_client, connection) => {
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
          `UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
             SET ${OM_IS_BUFFERING_OBSERVATION} = :isBuffering,
                 ${OM_UPDATED_AT} = :updatedAt
                 ${setTokens}
             WHERE id = :id`,
          asBindParameters(binds),
        );
        this.assertRowsAffected(result.rowsAffected, 'SET_BUFFERING_OBSERVATION_FLAG', id);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('SET_BUFFERING_OBSERVATION_FLAG', 'FAILED', { id, isBuffering }, error);
    }
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    await this.updateOMFlag(id, OM_IS_BUFFERING_REFLECTION, isBuffering, 'SET_BUFFERING_REFLECTION_FLAG');
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    try {
      const lookupKey = this.getOMKey(threadId, resourceId);
      await this.db.none(`DELETE FROM ${this.table(TABLE_OBSERVATIONAL_MEMORY)} WHERE ${OM_LOOKUP_KEY} = :lookupKey`, {
        lookupKey,
      });
    } catch (error) {
      throw this.storageError('CLEAR_OBSERVATIONAL_MEMORY', 'FAILED', { threadId: threadId ?? '', resourceId }, error);
    }
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    try {
      await this.updateOMColumns(id, 'SET_PENDING_MESSAGE_TOKENS', {
        [OM_PENDING_MESSAGE_TOKENS]: Math.round(tokenCount),
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('SET_PENDING_MESSAGE_TOKENS', 'FAILED', { id, tokenCount }, error);
    }
  }

  async updateObservationalMemoryConfig(input: UpdateObservationalMemoryConfigInput): Promise<void> {
    try {
      await this.db.tx(async (_client, connection) => {
        // Lock current config before deep-merging so concurrent observers do not
        // drop nested config keys written by another request.
        const result = await connection.execute<ObjectRow>(
          `SELECT config AS "config" FROM ${this.table(TABLE_OBSERVATIONAL_MEMORY)} WHERE id = :id FOR UPDATE`,
          { id: input.id },
          executeOptions(),
        );
        const row = rows(result)[0];
        if (!row) {
          this.assertRowsAffected(0, 'UPDATE_OM_CONFIG', input.id);
        }

        const existing = parseJson(row?.config);
        const merged = this.deepMergeConfig(existing, input.config);
        const updateResult = await connection.execute(
          `UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
             SET config = :config,
                 ${OM_UPDATED_AT} = :updatedAt
             WHERE id = :id`,
          { id: input.id, config: jsonBind(merged), updatedAt: new Date() },
        );
        this.assertRowsAffected(updateResult.rowsAffected, 'UPDATE_OM_CONFIG', input.id);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('UPDATE_OM_CONFIG', 'FAILED', { id: input.id }, error);
    }
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    try {
      await this.db.tx(async (_client, connection) => {
        const row = await this.lockOMRow(connection, input.id, 'UPDATE_BUFFERED_OBSERVATIONS');
        const existingChunks = parseBufferedChunks(row.bufferedObservationChunks);
        // Buffer chunks let long observation cycles append safely without
        // rewriting the active observation CLOB on every small update.
        const newChunk: BufferedObservationChunk = {
          id: `ombuf-${randomUUID()}`,
          cycleId: input.chunk.cycleId,
          observations: input.chunk.observations,
          tokenCount: Math.round(input.chunk.tokenCount),
          messageIds: input.chunk.messageIds,
          messageTokens: Math.round(input.chunk.messageTokens ?? 0),
          lastObservedAt: input.chunk.lastObservedAt,
          createdAt: new Date(),
          suggestedContinuation: input.chunk.suggestedContinuation,
          currentTask: input.chunk.currentTask,
          threadTitle: input.chunk.threadTitle,
        };
        const updatedChunks = [...existingChunks, newChunk];
        const lastBufferedAtTimeSql =
          input.lastBufferedAtTime === undefined || input.lastBufferedAtTime === null
            ? ''
            : `,\n                 ${OM_LAST_BUFFERED_AT_TIME} = :lastBufferedAtTime`;
        const binds: Record<string, unknown> = {
          id: input.id,
          bufferedObservationChunks: jsonBind(updatedChunks),
          updatedAt: new Date(),
        };
        if (input.lastBufferedAtTime !== undefined && input.lastBufferedAtTime !== null) {
          binds.lastBufferedAtTime = toDate(input.lastBufferedAtTime);
        }

        const result = await connection.execute(
          `UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
             SET ${OM_BUFFERED_OBSERVATION_CHUNKS} = :bufferedObservationChunks,
                 ${OM_UPDATED_AT} = :updatedAt${lastBufferedAtTimeSql}
             WHERE id = :id`,
          asBindParameters(binds),
        );
        this.assertRowsAffected(result.rowsAffected, 'UPDATE_BUFFERED_OBSERVATIONS', input.id);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('UPDATE_BUFFERED_OBSERVATIONS', 'FAILED', { id: input.id }, error);
    }
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    try {
      return await this.db.tx(async (_client, connection) => {
        const row = await this.lockOMRow(connection, input.id, 'SWAP_BUFFERED_TO_ACTIVE');
        const chunks = input.bufferedChunks?.length ? input.bufferedChunks : parseBufferedChunks(row.bufferedObservationChunks);

        if (chunks.length === 0) {
          return emptySwapResult();
        }

        const activation = calculateBufferedActivation(chunks, input);
        const lastObservedAt =
          input.lastObservedAt ??
          (activation.activatedChunks.at(-1)?.lastObservedAt
            ? toDate(activation.activatedChunks.at(-1)!.lastObservedAt)
            : new Date());
        const boundary = `\n\n--- message boundary (${lastObservedAt.toISOString()}) ---\n\n`;
        // Keep each activated chunk readable inside one CLOB while preserving the observation timestamp boundary.
        const existingActive = stringOrEmpty(row.activeObservations);
        const newActive = existingActive
          ? `${existingActive}${boundary}${activation.activatedContent}`
          : activation.activatedContent;
        const pendingTokens = Math.max(
          0,
          numberOrZero(row.pendingMessageTokens) - activation.activatedMessageTokens,
        );

        const result = await connection.execute(
          `UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
             SET ${OM_ACTIVE_OBSERVATIONS} = :activeObservations,
                 ${OM_OBSERVATION_TOKEN_COUNT} = COALESCE(${OM_OBSERVATION_TOKEN_COUNT}, 0) + :observationTokens,
                 ${OM_PENDING_MESSAGE_TOKENS} = :pendingMessageTokens,
                 ${OM_BUFFERED_OBSERVATION_CHUNKS} = :bufferedObservationChunks,
                 ${OM_LAST_OBSERVED_AT} = :lastObservedAt,
                 ${OM_UPDATED_AT} = :updatedAt
             WHERE id = :id`,
            {
              id: input.id,
              activeObservations: nullableClobBind(newActive),
              observationTokens: activation.activatedTokens,
              pendingMessageTokens: pendingTokens,
              bufferedObservationChunks: nullableJsonBind(activation.remainingChunks.length > 0 ? activation.remainingChunks : null),
              lastObservedAt,
              updatedAt: new Date(),
            },
        );
        this.assertRowsAffected(result.rowsAffected, 'SWAP_BUFFERED_TO_ACTIVE', input.id);

        return activation.result;
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('SWAP_BUFFERED_TO_ACTIVE', 'FAILED', { id: input.id }, error);
    }
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    try {
      await this.db.tx(async (_client, connection) => {
        const result = await connection.execute(
          `UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
             SET ${OM_BUFFERED_REFLECTION} = CASE
                   WHEN ${OM_BUFFERED_REFLECTION} IS NOT NULL AND DBMS_LOB.GETLENGTH(${OM_BUFFERED_REFLECTION}) > 0
                   THEN ${OM_BUFFERED_REFLECTION} || CHR(10) || CHR(10) || :reflection
                   ELSE :reflection
                 END,
                 ${OM_BUFFERED_REFLECTION_TOKENS} = COALESCE(${OM_BUFFERED_REFLECTION_TOKENS}, 0) + :tokenCount,
                 ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = COALESCE(${OM_BUFFERED_REFLECTION_INPUT_TOKENS}, 0) + :inputTokenCount,
                 ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = :reflectedObservationLineCount,
                 ${OM_UPDATED_AT} = :updatedAt
             WHERE id = :id`,
            {
              id: input.id,
              reflection: nullableClobBind(input.reflection),
              tokenCount: Math.round(input.tokenCount),
              inputTokenCount: Math.round(input.inputTokenCount),
              reflectedObservationLineCount: Math.round(input.reflectedObservationLineCount),
              updatedAt: new Date(),
            },
        );
        this.assertRowsAffected(result.rowsAffected, 'UPDATE_BUFFERED_REFLECTION', input.id);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('UPDATE_BUFFERED_REFLECTION', 'FAILED', { id: input.id }, error);
    }
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    try {
      return await this.db.tx(async (_client, connection) => {
        const row = await this.lockOMRow(connection, input.currentRecord.id, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE');
        const bufferedReflection = stringOrEmpty(row.bufferedReflection);
        if (!bufferedReflection) {
          throw this.storageError(
            'SWAP_BUFFERED_REFLECTION_TO_ACTIVE',
            'NO_CONTENT',
            { id: input.currentRecord.id },
            new Error('No buffered reflection to swap'),
            ErrorCategory.USER,
          );
        }

        const reflectedLineCount = numberOrZero(row.reflectedObservationLineCount);
        const currentObservations = stringOrEmpty(row.activeObservations);
        // The buffered reflection replaces the lines it summarized, but any
        // observations added after reflection started are preserved below it.
        const unreflectedContent = currentObservations.split('\n').slice(reflectedLineCount).join('\n').trim();
        const newObservations = unreflectedContent
          ? `${bufferedReflection}\n\n${unreflectedContent}`
          : bufferedReflection;
        const now = new Date();
        const newRecord: ObservationalMemoryRecord = {
          id: randomUUID(),
          scope: input.currentRecord.scope,
          threadId: input.currentRecord.threadId,
          resourceId: input.currentRecord.resourceId,
          createdAt: now,
          updatedAt: now,
          lastObservedAt: input.currentRecord.lastObservedAt,
          originType: 'reflection',
          generationCount: input.currentRecord.generationCount + 1,
          activeObservations: newObservations,
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

        await this.insertOMRecord(connection, newRecord, now);
        const updateResult = await connection.execute(
          `UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
             SET ${OM_BUFFERED_REFLECTION} = NULL,
                 ${OM_BUFFERED_REFLECTION_TOKENS} = NULL,
                 ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} = NULL,
                 ${OM_REFLECTED_OBSERVATION_LINE_COUNT} = NULL,
                 ${OM_UPDATED_AT} = :updatedAt
             WHERE id = :id`,
          { id: input.currentRecord.id, updatedAt: now },
        );
        this.assertRowsAffected(updateResult.rowsAffected, 'SWAP_BUFFERED_REFLECTION_TO_ACTIVE', input.currentRecord.id);

        return newRecord;
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('SWAP_BUFFERED_REFLECTION_TO_ACTIVE', 'FAILED', { id: input.currentRecord.id }, error);
    }
  }

  private getOMKey(threadId: string | null, resourceId: string): string {
    return threadId ? `thread:${threadId}` : `resource:${resourceId}`;
  }

  private async lockOMRow(
    connection: Connection,
    id: string,
    operation: string,
  ): Promise<ObservationalMemoryRow> {
    // Observational memory updates are incremental and order-sensitive, so
    // mutating paths derive their next state from a locked row.
    const result = await connection.execute<ObjectRow>(
      `${this.omSelect()} FROM ${this.table(TABLE_OBSERVATIONAL_MEMORY)} WHERE id = :id FOR UPDATE`,
      { id },
      executeOptions(),
    );
    const row = rows(result)[0] as ObservationalMemoryRow | undefined;
    if (!row) {
      this.assertRowsAffected(0, operation, id);
      throw new Error(`Observational memory record not found: ${id}`);
    }
    return row;
  }

  private async insertOMRecord(connection: Connection, record: ObservationalMemoryRecord, timestamp = record.createdAt): Promise<void> {
    // Store free-form observations/reflections as CLOBs while keeping config,
    // ids, chunks, and counters typed for runtime queries and state transitions.
    await connection.execute(
      `
      INSERT INTO ${this.table(TABLE_OBSERVATIONAL_MEMORY)} (
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
        lookupKey: this.getOMKey(record.threadId, record.resourceId),
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

  private async updateOMFlag(id: string, column: string, value: boolean, operation: string): Promise<void> {
    try {
      await this.updateOMColumns(id, operation, { [column]: boolToNumber(value) });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError(operation, 'FAILED', { id, value }, error);
    }
  }

  private async updateOMColumns(id: string, operation: string, columns: Record<string, unknown>): Promise<void> {
    await this.db.tx(async (_client, connection) => {
      const setParts = Object.keys(columns).map((column, index) => `${column} = :value${index}`);
      const binds = Object.fromEntries(Object.values(columns).map((value, index) => [`value${index}`, value]));
      const result = await connection.execute(
        `UPDATE ${this.table(TABLE_OBSERVATIONAL_MEMORY)}
           SET ${setParts.join(', ')},
               ${OM_UPDATED_AT} = :updatedAt
           WHERE id = :id`,
        { ...binds, id, updatedAt: new Date() },
      );
      this.assertRowsAffected(result.rowsAffected, operation, id);
    });
  }

  private assertRowsAffected(rowsAffected: number | undefined, operation: string, id: string): void {
    if (rowsAffected && rowsAffected > 0) return;
    throw this.storageError(
      operation,
      'NOT_FOUND',
      { id },
      new Error(`Observational memory record not found: ${id}`),
      ErrorCategory.THIRD_PARTY,
    );
  }

  private omSelect(): string {
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

  private parseOMRow(row: ObservationalMemoryRow): ObservationalMemoryRecord {
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

  private async listMessagesWithWhere({
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
  }): Promise<StorageListMessagesOutput> {
    try {
      this.validatePaginationInput(page, perPageInput ?? 40);
    } catch (error) {
      throw this.storageError(operation, 'INVALID_PAGE', { page }, error, ErrorCategory.USER);
    }

    const perPage = normalizePerPage(perPageInput, 40);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      return await this.db.withConnection(async connection => {
        const { field, direction } = this.parseOrderBy(orderBy, 'ASC');
        const { whereClause, binds } = this.messageWhereClause(baseFilter, filter);

        if (perPage === 0 && (!include || include.length === 0)) {
          return { messages: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
        }

        if (perPage === 0 && include && include.length > 0) {
          const includeMessages = await this.getIncludedMessages(connection, include);
          const list = new MessageList().add(includeMessages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
          return {
            messages: this.sortMessages(list.get.all.db(), field, direction),
            total: 0,
            page,
            perPage: perPageForResponse,
            hasMore: false,
          };
        }

        const countResult = await connection.execute<ObjectRow>(
          `SELECT COUNT(*) AS "count" FROM ${this.table(TABLE_MESSAGES)} ${whereClause}`,
          asBindParameters(binds),
          executeOptions(),
        );
        const total = Number(rows(countResult)[0]?.count ?? 0);

        const pagination = this.paginationClause(perPageInput, perPage, offset);
        const result = await connection.execute<ObjectRow>(
          `${this.messageSelect()} FROM ${this.table(TABLE_MESSAGES)} ${whereClause} ORDER BY ${this.messageOrderColumn(field)} ${direction}, id ${direction} ${pagination}`,
          asBindParameters(binds),
          executeOptions(),
        );
        const messages = rows(result).map(row => this.parseMessage(row as MessageRow));

        const messageIds = new Set(messages.map(message => message.id));
        if (include && include.length > 0) {
          // Included messages may fall outside the paged query. Merge by id,
          // then let MessageList normalize ordering and provider shape.
          const includeMessages = await this.getIncludedMessages(connection, include);
          for (const message of includeMessages) {
            if (!messageIds.has(message.id)) {
              messages.push(message);
              messageIds.add(message.id);
            }
          }
        }

        const list = new MessageList().add(messages as (MastraMessageV1 | MastraDBMessage)[], 'memory');
        const finalMessages = this.sortMessages(list.get.all.db(), field, direction);
        const baseThreadIds = new Set(baseFilter.threadIds ?? []);
        const returnedThreadMessageIds = new Set(
          finalMessages
            .filter(message => baseThreadIds.size === 0 || (message.threadId !== undefined && baseThreadIds.has(message.threadId)))
            .map(message => message.id),
        );
        const hasMore =
          perPageInput !== false && returnedThreadMessageIds.size < total && offset + perPage < total;

        return {
          messages: finalMessages,
          total,
          page,
          perPage: perPageForResponse,
          hasMore,
        };
      });
    } catch (error) {
      throw this.storageError(operation, 'FAILED', { page }, error);
    }
  }

  private async createTables(connection: Connection): Promise<void> {
    // Memory table DDL is kept manual instead of relying only on TABLE_SCHEMAS
    // because Oracle-specific CLOB/JSON choices are central to this provider.
    await executeDdl(
      connection,
      `
      CREATE TABLE ${this.table(TABLE_RESOURCES)} (
        id VARCHAR2(512) PRIMARY KEY,
        ${RESOURCE_WORKING_MEMORY} CLOB,
        metadata JSON,
        ${RESOURCE_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
        ${RESOURCE_UPDATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL
      )`,
      [-955],
    );

    await executeDdl(
      connection,
      `
      CREATE TABLE ${this.table(TABLE_THREADS)} (
        id VARCHAR2(512) PRIMARY KEY,
        ${THREAD_RESOURCE_ID} VARCHAR2(512) NOT NULL,
        title VARCHAR2(1024),
        metadata JSON,
        ${THREAD_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
        ${THREAD_UPDATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL
      )`,
      [-955],
    );

    await this.relaxThreadTitleNullability(connection);

    await executeDdl(
      connection,
      `
      CREATE TABLE ${this.table(TABLE_MESSAGES)} (
        id VARCHAR2(512) PRIMARY KEY,
        thread_id VARCHAR2(512) NOT NULL,
        content CLOB NOT NULL,
        role VARCHAR2(64) NOT NULL,
        type VARCHAR2(64) NOT NULL,
        ${MESSAGE_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
        ${MESSAGE_RESOURCE_ID} VARCHAR2(512)
      )`,
      [-955],
    );
    await executeDdl(
      connection,
      `ALTER TABLE ${this.table(TABLE_MESSAGES)} ADD (${MESSAGE_RESOURCE_ID} VARCHAR2(512))`,
      [-1430],
    );

    await executeDdl(
      connection,
      `
      CREATE TABLE ${this.table(TABLE_OBSERVATIONAL_MEMORY)} (
        id VARCHAR2(512) PRIMARY KEY,
        ${OM_LOOKUP_KEY} VARCHAR2(1024) NOT NULL,
        ${OM_SCOPE} VARCHAR2(32) NOT NULL,
        ${OM_RESOURCE_ID} VARCHAR2(512) NOT NULL,
        ${OM_THREAD_ID} VARCHAR2(512),
        ${OM_ACTIVE_OBSERVATIONS} CLOB,
        ${OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE} CLOB,
        ${OM_ORIGIN_TYPE} VARCHAR2(32) NOT NULL,
        config JSON NOT NULL,
        ${OM_GENERATION_COUNT} NUMBER(10) DEFAULT 0 NOT NULL,
        ${OM_LAST_OBSERVED_AT} TIMESTAMP WITH TIME ZONE,
        ${OM_LAST_REFLECTION_AT} TIMESTAMP WITH TIME ZONE,
        ${OM_PENDING_MESSAGE_TOKENS} NUMBER(20) DEFAULT 0 NOT NULL,
        ${OM_TOTAL_TOKENS_OBSERVED} NUMBER(20) DEFAULT 0 NOT NULL,
        ${OM_OBSERVATION_TOKEN_COUNT} NUMBER(20) DEFAULT 0 NOT NULL,
        ${OM_IS_OBSERVING} NUMBER(1) DEFAULT 0 NOT NULL,
        ${OM_IS_REFLECTING} NUMBER(1) DEFAULT 0 NOT NULL,
        ${OM_OBSERVED_MESSAGE_IDS} JSON,
        ${OM_OBSERVED_TIMEZONE} VARCHAR2(128),
        ${OM_BUFFERED_OBSERVATIONS} CLOB,
        ${OM_BUFFERED_OBSERVATION_TOKENS} NUMBER(20),
        ${OM_BUFFERED_MESSAGE_IDS} JSON,
        ${OM_BUFFERED_REFLECTION} CLOB,
        ${OM_BUFFERED_REFLECTION_TOKENS} NUMBER(20),
        ${OM_BUFFERED_REFLECTION_INPUT_TOKENS} NUMBER(20),
        ${OM_REFLECTED_OBSERVATION_LINE_COUNT} NUMBER(20),
        ${OM_BUFFERED_OBSERVATION_CHUNKS} JSON,
        ${OM_IS_BUFFERING_OBSERVATION} NUMBER(1) DEFAULT 0 NOT NULL,
        ${OM_IS_BUFFERING_REFLECTION} NUMBER(1) DEFAULT 0 NOT NULL,
        ${OM_LAST_BUFFERED_AT_TOKENS} NUMBER(20) DEFAULT 0 NOT NULL,
        ${OM_LAST_BUFFERED_AT_TIME} TIMESTAMP WITH TIME ZONE,
        metadata JSON,
        ${OM_CREATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL,
        ${OM_UPDATED_AT} TIMESTAMP WITH TIME ZONE NOT NULL
      )`,
      [-955],
    );

    await this.ensureObservationalMemoryColumns(connection);
    await this.relaxObservationalMemoryNullability(connection);
  }

  private async ensureObservationalMemoryColumns(connection: Connection): Promise<void> {
    // Observational memory evolved after basic memory storage. This additive
    // pass lets older Oracle schemas upgrade in place without dropping data.
    const columns = [
      { name: OM_LOOKUP_KEY, type: 'VARCHAR2(1024)' },
      { name: OM_SCOPE, type: 'VARCHAR2(32)' },
      { name: OM_RESOURCE_ID, type: 'VARCHAR2(512)' },
      { name: OM_THREAD_ID, type: 'VARCHAR2(512)' },
      { name: OM_ACTIVE_OBSERVATIONS, type: 'CLOB' },
      { name: OM_ACTIVE_OBSERVATIONS_PENDING_UPDATE, type: 'CLOB' },
      { name: OM_ORIGIN_TYPE, type: 'VARCHAR2(32)' },
      { name: 'config', type: 'JSON' },
      { name: OM_GENERATION_COUNT, type: 'NUMBER(10) DEFAULT 0' },
      { name: OM_LAST_OBSERVED_AT, type: 'TIMESTAMP WITH TIME ZONE' },
      { name: OM_LAST_REFLECTION_AT, type: 'TIMESTAMP WITH TIME ZONE' },
      { name: OM_PENDING_MESSAGE_TOKENS, type: 'NUMBER(20) DEFAULT 0' },
      { name: OM_TOTAL_TOKENS_OBSERVED, type: 'NUMBER(20) DEFAULT 0' },
      { name: OM_OBSERVATION_TOKEN_COUNT, type: 'NUMBER(20) DEFAULT 0' },
      { name: OM_IS_OBSERVING, type: 'NUMBER(1) DEFAULT 0' },
      { name: OM_IS_REFLECTING, type: 'NUMBER(1) DEFAULT 0' },
      { name: OM_OBSERVED_MESSAGE_IDS, type: 'JSON' },
      { name: OM_OBSERVED_TIMEZONE, type: 'VARCHAR2(128)' },
      { name: OM_BUFFERED_OBSERVATIONS, type: 'CLOB' },
      { name: OM_BUFFERED_OBSERVATION_TOKENS, type: 'NUMBER(20)' },
      { name: OM_BUFFERED_MESSAGE_IDS, type: 'JSON' },
      { name: OM_BUFFERED_REFLECTION, type: 'CLOB' },
      { name: OM_BUFFERED_REFLECTION_TOKENS, type: 'NUMBER(20)' },
      { name: OM_BUFFERED_REFLECTION_INPUT_TOKENS, type: 'NUMBER(20)' },
      { name: OM_REFLECTED_OBSERVATION_LINE_COUNT, type: 'NUMBER(20)' },
      { name: OM_BUFFERED_OBSERVATION_CHUNKS, type: 'JSON' },
      { name: OM_IS_BUFFERING_OBSERVATION, type: 'NUMBER(1) DEFAULT 0' },
      { name: OM_IS_BUFFERING_REFLECTION, type: 'NUMBER(1) DEFAULT 0' },
      { name: OM_LAST_BUFFERED_AT_TOKENS, type: 'NUMBER(20) DEFAULT 0' },
      { name: OM_LAST_BUFFERED_AT_TIME, type: 'TIMESTAMP WITH TIME ZONE' },
      { name: 'metadata', type: 'JSON' },
      { name: OM_CREATED_AT, type: 'TIMESTAMP WITH TIME ZONE' },
      { name: OM_UPDATED_AT, type: 'TIMESTAMP WITH TIME ZONE' },
    ];

    for (const column of columns) {
      await executeDdl(
        connection,
        `ALTER TABLE ${this.table(TABLE_OBSERVATIONAL_MEMORY)} ADD (${column.name} ${column.type})`,
        [-1430],
      );
    }
  }

  private async relaxThreadTitleNullability(connection: Connection): Promise<void> {
    const tableName = TABLE_THREADS.toUpperCase();
    const result = this.schemaName
      ? await connection.execute<ObjectRow>(
          `SELECT nullable AS "nullable" FROM all_tab_columns WHERE owner = :owner AND table_name = :tableName AND column_name = 'TITLE'`,
          asBindParameters({ owner: this.schemaName, tableName }),
          executeOptions(),
        )
      : await connection.execute<ObjectRow>(
          `SELECT nullable AS "nullable" FROM user_tab_columns WHERE table_name = :tableName AND column_name = 'TITLE'`,
          asBindParameters({ tableName }),
          executeOptions(),
        );

    if (String(rows(result)[0]?.nullable ?? 'Y').toUpperCase() !== 'N') return;

    await executeDdl(connection, `ALTER TABLE ${this.table(TABLE_THREADS)} MODIFY (title NULL)`, [-1451, -54]);
  }

  private async relaxObservationalMemoryNullability(connection: Connection): Promise<void> {
    await executeDdl(
      connection,
      `ALTER TABLE ${this.table(TABLE_OBSERVATIONAL_MEMORY)} MODIFY (${OM_ACTIVE_OBSERVATIONS} NULL)`,
      [-1451, -54],
    );
  }

  private async createIndexes(connection: Connection): Promise<void> {
    if (!this.skipDefaultIndexes) {
      for (const index of this.defaultIndexes()) {
        try {
          await createOracleIndex(connection, index, this.schemaName);
        } catch (error) {
          this.logger?.warn?.(`Failed to create Oracle default index ${index.name}:`, error);
        }
      }
    }

    for (const index of this.indexes) {
      await createOracleIndex(connection, index, this.schemaName);
    }
  }

  private defaultIndexes(): OracleCreateIndexOptions[] {
    return [
      {
        name: this.indexName('MASTRA_THREADS_RESOURCE_CREATED_IDX'),
        table: TABLE_THREADS,
        columns: ['resourceId', 'createdAt'],
      },
      {
        name: this.indexName('MASTRA_MESSAGES_THREAD_CREATED_IDX'),
        table: TABLE_MESSAGES,
        columns: ['thread_id', 'createdAt'],
      },
      {
        name: this.indexName('MASTRA_MESSAGES_RESOURCE_CREATED_IDX'),
        table: TABLE_MESSAGES,
        columns: ['resourceId', 'createdAt'],
      },
      {
        name: this.indexName('MASTRA_OM_LOOKUP_GENERATION_IDX'),
        table: TABLE_OBSERVATIONAL_MEMORY,
        columns: ['lookupKey', 'generationCount'],
      },
      {
        name: this.indexName('MASTRA_OM_RESOURCE_CREATED_IDX'),
        table: TABLE_OBSERVATIONAL_MEMORY,
        columns: ['resourceId', 'createdAt'],
      },
      {
        name: this.indexName('MASTRA_OM_THREAD_CREATED_IDX'),
        table: TABLE_OBSERVATIONAL_MEMORY,
        columns: ['threadId', 'createdAt'],
      },
    ];
  }

  private async getIncludedMessages(
    connection: Connection,
    include: NonNullable<StorageListMessagesInput['include']>,
  ): Promise<MastraDBMessage[]> {
    const targetIds = include.map(item => item.id).filter(Boolean);
    if (targetIds.length === 0) return [];

    const { sql, binds } = inClause('targetId', targetIds);
    const targetResult = await connection.execute<ObjectRow>(
      `SELECT id AS "id", thread_id AS "threadId", ${MESSAGE_CREATED_AT} AS "createdAt" FROM ${this.table(TABLE_MESSAGES)} WHERE id IN (${sql})`,
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
      const previousRows = await this.queryMessageWindow(connection, {
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
        const nextRows = await this.queryMessageWindow(connection, {
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

  private async queryMessageWindow(
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
      `${this.messageSelect()} FROM ${this.table(TABLE_MESSAGES)} WHERE thread_id = :${params.bindPrefix}_threadId AND ${MESSAGE_CREATED_AT} ${params.operator} :${params.bindPrefix}_createdAt ORDER BY ${MESSAGE_CREATED_AT} ${params.direction}, id ${params.direction} FETCH FIRST ${params.limit} ROWS ONLY`,
      asBindParameters({
        [`${params.bindPrefix}_threadId`]: params.threadId,
        [`${params.bindPrefix}_createdAt`]: params.createdAt,
      }),
      executeOptions(),
    );
    return rows(result).map(row => this.parseMessage(row as MessageRow));
  }

  private async deleteSemanticRecallVectors(client: OracleTxClient, threadId: string): Promise<void> {
    let vectorTables: Array<{ tableName: string }>;
    try {
      vectorTables = await client.manyOrNone<{ tableName: string }>(
        `
        SELECT table_name AS "tableName"
        FROM ${qualifyName('MASTRA_VECTOR_INDEXES', this.schemaName)}
        WHERE LOWER(index_name) = 'memory_messages'
           OR LOWER(index_name) LIKE 'memory_messages\\_%' ESCAPE '\\'
           OR LOWER(index_name) LIKE 'mastra_memory\\_%' ESCAPE '\\'`,
      );
    } catch (error) {
      if (isOracleErrorCode(error, [-942])) return;
      throw error;
    }

    for (const { tableName } of vectorTables) {
      try {
        await client.none(
          `DELETE FROM ${qualifyName(tableName, this.schemaName)}
           WHERE JSON_VALUE(metadata, '$.thread_id' RETURNING VARCHAR2(512) NULL ON ERROR) = :threadId`,
          { threadId },
        );
      } catch (error) {
        if (!isOracleErrorCode(error, [-942])) throw error;
      }
    }
  }

  private async messagesForClone(args: StorageCloneThreadInput): Promise<MastraDBMessage[]> {
    const options = args.options;
    const messageIds = options?.messageFilter?.messageIds;
    if (messageIds?.length) {
      return (await this.listMessagesById({ messageIds })).messages.filter(
        message => message.threadId === args.sourceThreadId,
      );
    }

    const output = await this.listMessages({
      threadId: args.sourceThreadId,
      perPage: false,
      filter: {
        dateRange: {
          start: options?.messageFilter?.startDate,
          end: options?.messageFilter?.endDate,
        },
      },
      orderBy: { field: 'createdAt', direction: 'ASC' },
    });

    if (options?.messageLimit && options.messageLimit > 0) {
      return output.messages.slice(-options.messageLimit);
    }
    return output.messages;
  }

  private messageWhereClause(
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

  private threadWhereClause(filter?: StorageListThreadsInput['filter']): { sql: string; binds: Record<string, unknown> } {
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

  private parseMessage(row: MessageRow): MastraDBMessage {
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

  private parseThread(row: ThreadRow): StorageThreadType {
    return {
      id: String(row.id),
      resourceId: String(row.resourceId),
      title: parseOptionalString(row.title),
      metadata: parseJson(row.metadata),
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    };
  }

  private parseResource(row: ResourceRow): StorageResourceType {
    const workingMemory = parseOptionalString(row.workingMemory);
    return {
      id: String(row.id),
      workingMemory,
      metadata: parseJson(row.metadata),
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    };
  }


  private sortMessages(messages: MastraDBMessage[], field: string, direction: string): MastraDBMessage[] {
    return messages.sort((a, b) => {
      const aValue = field === 'createdAt' ? new Date(a.createdAt).getTime() : (a as Record<string, unknown>)[field];
      const bValue = field === 'createdAt' ? new Date(b.createdAt).getTime() : (b as Record<string, unknown>)[field];
      if (aValue === bValue) return a.id.localeCompare(b.id);
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return direction === 'ASC' ? aValue - bValue : bValue - aValue;
      }
      return direction === 'ASC'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });
  }

  private paginationClause(perPageInput: number | false | undefined, perPage: number, offset: number): string {
    if (perPageInput === false) return '';
    return `OFFSET ${offset} ROWS FETCH NEXT ${perPage} ROWS ONLY`;
  }

  private threadSelect(): string {
    return `SELECT id AS "id", ${THREAD_RESOURCE_ID} AS "resourceId", title AS "title", metadata AS "metadata", ${THREAD_CREATED_AT} AS "createdAt", ${THREAD_UPDATED_AT} AS "updatedAt"`;
  }

  private messageSelect(): string {
    return `SELECT id AS "id", content AS "content", role AS "role", type AS "type", ${MESSAGE_CREATED_AT} AS "createdAt", thread_id AS "threadId", ${MESSAGE_RESOURCE_ID} AS "resourceId"`;
  }

  private messageMergeSql(): string {
    return `
      MERGE INTO ${this.table(TABLE_MESSAGES)} target
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

  private resourceSelect(): string {
    return `SELECT id AS "id", ${RESOURCE_WORKING_MEMORY} AS "workingMemory", metadata AS "metadata", ${RESOURCE_CREATED_AT} AS "createdAt", ${RESOURCE_UPDATED_AT} AS "updatedAt"`;
  }

  private threadOrderColumn(field: string): string {
    return field === 'updatedAt' ? THREAD_UPDATED_AT : THREAD_CREATED_AT;
  }

  private messageOrderColumn(field: string): string {
    return field === 'createdAt' ? MESSAGE_CREATED_AT : quoteIdentifier(field, 'message order field');
  }

  private table(tableName: string): string {
    return qualifyName(tableName, this.schemaName);
  }

  private indexName(indexName: string): string {
    return indexNameForTable(indexName, 'IDX');
  }

  private storageError(
    operation: string,
    reason: string,
    details: Record<string, string | number | boolean | undefined>,
    cause: unknown,
    category: ErrorCategory = ErrorCategory.THIRD_PARTY,
  ): MastraError {
    return createOracleStorageError({ storeName: STORE_NAME, operation, reason, details, cause, category });
  }
}

function inClause(prefix: string, values: string[]): { sql: string; binds: Record<string, unknown> } {
  const binds: Record<string, unknown> = {};
  const placeholders = values.map((value, index) => {
    const key = `${prefix}${index}`;
    binds[key] = value;
    return `:${key}`;
  });
  return { sql: placeholders.join(', '), binds };
}

function chunkValues<T>(values: T[], size = ORACLE_IN_LIMIT): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function boolToNumber(value: boolean | undefined): number {
  return value ? 1 : 0;
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true' || value === 'TRUE';
}

function numberOrZero(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function optionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return numberOrZero(value);
}

function stringOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function emptyToUndefined(value: unknown): string | undefined {
  const stringValue = stringOrEmpty(value);
  return stringValue.length === 0 ? undefined : stringValue;
}

function parseBufferedChunks(value: unknown): BufferedObservationChunk[] {
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
    };
  });
}

function emptySwapResult(): SwapBufferedToActiveResult {
  return {
    chunksActivated: 0,
    messageTokensActivated: 0,
    observationTokensActivated: 0,
    messagesActivated: 0,
    activatedCycleIds: [],
    activatedMessageIds: [],
  };
}

function calculateBufferedActivation(chunks: BufferedObservationChunk[], input: SwapBufferedToActiveInput): {
  activatedChunks: BufferedObservationChunk[];
  remainingChunks: BufferedObservationChunk[];
  activatedContent: string;
  activatedTokens: number;
  activatedMessageTokens: number;
  result: SwapBufferedToActiveResult;
} {
  const retentionFloor = input.messageTokensThreshold * (1 - input.activationRatio);
  const targetMessageTokens = Math.max(0, input.currentPendingTokens - retentionFloor);

  let cumulativeMessageTokens = 0;
  let bestOverBoundary = 0;
  let bestOverTokens = 0;
  let bestUnderBoundary = 0;
  let bestUnderTokens = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    cumulativeMessageTokens += chunks[index]?.messageTokens ?? 0;
    const boundary = index + 1;

    if (cumulativeMessageTokens >= targetMessageTokens) {
      if (bestOverBoundary === 0 || cumulativeMessageTokens < bestOverTokens) {
        bestOverBoundary = boundary;
        bestOverTokens = cumulativeMessageTokens;
      }
    } else if (cumulativeMessageTokens > bestUnderTokens) {
      bestUnderBoundary = boundary;
      bestUnderTokens = cumulativeMessageTokens;
    }
  }

  const maxOvershoot = retentionFloor * 0.95;
  const overshoot = bestOverTokens - targetMessageTokens;
  const remainingAfterOver = input.currentPendingTokens - bestOverTokens;
  const remainingAfterUnder = input.currentPendingTokens - bestUnderTokens;
  const minRemaining = Math.min(1000, retentionFloor);

  let chunksToActivate: number;
  if (input.forceMaxActivation && bestOverBoundary > 0 && remainingAfterOver >= minRemaining) {
    chunksToActivate = bestOverBoundary;
  } else if (bestOverBoundary > 0 && overshoot <= maxOvershoot && remainingAfterOver >= minRemaining) {
    chunksToActivate = bestOverBoundary;
  } else if (bestUnderBoundary > 0 && remainingAfterUnder >= minRemaining) {
    chunksToActivate = bestUnderBoundary;
  } else if (bestOverBoundary > 0) {
    chunksToActivate = bestOverBoundary;
  } else {
    chunksToActivate = 1;
  }

  const activatedChunks = chunks.slice(0, chunksToActivate);
  const remainingChunks = chunks.slice(chunksToActivate);
  const activatedContent = activatedChunks.map(chunk => chunk.observations).join('\n\n');
  const activatedTokens = Math.round(activatedChunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0));
  const activatedMessageTokens = Math.round(
    activatedChunks.reduce((sum, chunk) => sum + (chunk.messageTokens ?? 0), 0),
  );
  const activatedMessageIds = activatedChunks.flatMap(chunk => chunk.messageIds ?? []);
  const latestChunkHints = activatedChunks.at(-1);

  return {
    activatedChunks,
    remainingChunks,
    activatedContent,
    activatedTokens,
    activatedMessageTokens,
    result: {
      chunksActivated: activatedChunks.length,
      messageTokensActivated: activatedMessageTokens,
      observationTokensActivated: activatedTokens,
      messagesActivated: activatedChunks.reduce((sum, chunk) => sum + (chunk.messageIds?.length ?? 0), 0),
      activatedCycleIds: activatedChunks.map(chunk => chunk.cycleId).filter(Boolean),
      activatedMessageIds,
      observations: activatedContent,
      perChunk: activatedChunks.map(chunk => ({
        cycleId: chunk.cycleId ?? '',
        messageTokens: chunk.messageTokens ?? 0,
        observationTokens: chunk.tokenCount,
        messageCount: chunk.messageIds?.length ?? 0,
        observations: chunk.observations,
      })),
      suggestedContinuation: latestChunkHints?.suggestedContinuation,
      currentTask: latestChunkHints?.currentTask,
    },
  };
}

function optionalStringBind(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return EMPTY_STRING_SENTINEL;
  if (value.startsWith(EMPTY_STRING_SENTINEL) || value.startsWith(STRING_SENTINEL_ESCAPE_PREFIX)) {
    return `${STRING_SENTINEL_ESCAPE_PREFIX}${value}`;
  }
  return value;
}

function optionalClobStringBind(value: string | null | undefined) {
  const encoded = optionalStringBind(value);
  return encoded === null ? null : clobBind(encoded);
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const stringValue = String(value);
  if (stringValue === EMPTY_STRING_SENTINEL) return '';
  if (stringValue.startsWith(STRING_SENTINEL_ESCAPE_PREFIX)) {
    return stringValue.slice(STRING_SENTINEL_ESCAPE_PREFIX.length);
  }
  return stringValue;
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

function parseJson(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  if (Buffer.isBuffer(value)) return JSON.parse(value.toString('utf8')) as Record<string, unknown>;
  if (typeof value === 'object') return value as Record<string, unknown>;
  return {};
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
