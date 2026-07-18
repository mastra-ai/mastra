import { randomUUID } from 'node:crypto';

import type { MastraMessageContentV2 } from '@mastra/core/agent';
import { ErrorCategory, MastraError } from '@mastra/core/error';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import { MemoryStorage, TABLE_MESSAGES, TABLE_OBSERVATIONAL_MEMORY, TABLE_RESOURCES, TABLE_THREADS } from '@mastra/core/storage';
import type {
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

import { isOracleErrorCode, normalizeBatchSize } from '../../../shared/connection';
import { normalizeIdentifier } from '../../../vector/identifiers';
import { filterIndexesForTables, OracleDB } from '../../db';
import type { OracleCreateIndexOptions } from '../../db';
import type { OracleDomainConfig } from '../../types';
import {
  deleteMessages,
  insertMessageBatch,
  listMessages,
  listMessagesByResourceId,
  listMessagesById,
  saveMessages,
  updateMessages,
} from './messages';
import {
  clearObservationalMemory,
  createReflectionGeneration,
  getObservationalMemory,
  getObservationalMemoryHistory,
  initializeObservationalMemory,
  insertObservationalMemoryRecord,
  setBufferingObservationFlag,
  setBufferingReflectionFlag,
  setObservingFlag,
  setPendingMessageTokens,
  setReflectingFlag,
  updateActiveObservations,
  updateObservationalMemoryConfig,
} from './observational';
import {
  swapBufferedReflectionToActive,
  swapBufferedToActive,
  updateBufferedObservations,
  updateBufferedReflection,
} from './observational-buffering';
import { getResourceById, saveResource, updateResource } from './resources';
import { clearAllMemoryTables, initMemorySchema } from './schema';
import { deleteThread, getThreadById, insertThreadRow, listThreads, saveThread, updateThread } from './threads';
import { storageError } from './utils';
import type { MemoryContext } from './utils';

// Memory is the highest-traffic storage domain. It owns conversation threads,
// messages, resources/working memory, and observational memory state. This
// file is a thin facade: `MemoryOracle` builds the shared `MemoryContext` and
// delegates to schema.ts / threads.ts / messages.ts / resources.ts /
// observational.ts / observational-buffering.ts, which hold the actual SQL.
const DEFAULT_MESSAGE_SAVE_BATCH_SIZE = 200;
const DEFAULT_VECTOR_REGISTRY_TABLE = 'MASTRA_VECTOR_INDEXES';

export class MemoryOracle extends MemoryStorage {
  readonly supportsObservationalMemory = true;
  // Memory owns all tables needed for normal message history plus observational memory state.
  static readonly MANAGED_TABLES = [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES, TABLE_OBSERVATIONAL_MEMORY] as const;

  private readonly db: OracleDB;
  private readonly schemaName?: string;
  private readonly messageBatchSize: number;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes: OracleCreateIndexOptions[];
  private readonly vectorRegistryTableName: string;

  constructor(config: OracleDomainConfig) {
    super();
    this.db = new OracleDB(config);
    this.schemaName = config.schemaName;
    this.messageBatchSize = normalizeBatchSize(config.messageBatchSize, 'messageBatchSize', DEFAULT_MESSAGE_SAVE_BATCH_SIZE);
    this.skipDefaultIndexes = config.skipDefaultIndexes;
    this.indexes = filterIndexesForTables(config.indexes, MemoryOracle.MANAGED_TABLES);
    this.vectorRegistryTableName = config.vectorRegistryTableName
      ? normalizeIdentifier(config.vectorRegistryTableName, 'vector registry table name')
      : DEFAULT_VECTOR_REGISTRY_TABLE;
  }

  // Built fresh on every call (not cached) so tests/callers that swap `db`
  // after construction, or a later `__setLogger`, are always honored.
  private get ctx(): MemoryContext {
    return {
      db: this.db,
      schemaName: this.schemaName,
      messageBatchSize: this.messageBatchSize,
      vectorRegistryTableName: this.vectorRegistryTableName,
      skipDefaultIndexes: this.skipDefaultIndexes,
      indexes: this.indexes,
      logger: this.logger,
      validatePaginationInput: this.validatePaginationInput.bind(this),
      validateMetadataKeys: this.validateMetadataKeys.bind(this),
      parseOrderBy: this.parseOrderBy.bind(this),
      deepMergeConfig: this.deepMergeConfig.bind(this),
      getThreadById: this.getThreadById.bind(this),
      listMessagesById: this.listMessagesById.bind(this),
      getResourceById: this.getResourceById.bind(this),
      saveResource: this.saveResource.bind(this),
    };
  }

  async init(): Promise<void> {
    await initMemorySchema(this.ctx);
  }

  async dangerouslyClearAll(): Promise<void> {
    await clearAllMemoryTables(this.ctx);
  }

  async getThreadById(args: { threadId: string; resourceId?: string }): Promise<StorageThreadType | null> {
    return getThreadById(this.ctx, args);
  }

  async saveThread(args: { thread: StorageThreadType }): Promise<StorageThreadType> {
    return saveThread(this.ctx, args);
  }

  async updateThread(args: { id: string; title: string; metadata: Record<string, unknown> }): Promise<StorageThreadType> {
    return updateThread(this.ctx, args);
  }

  async deleteThread(args: { threadId: string }): Promise<void> {
    return deleteThread(this.ctx, args);
  }

  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    return listThreads(this.ctx, args);
  }

  async listMessagesById(args: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return listMessagesById(this.ctx, args);
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    return listMessages(this.ctx, args);
  }

  async listMessagesByResourceId(args: StorageListMessagesByResourceIdInput): Promise<StorageListMessagesOutput> {
    return listMessagesByResourceId(this.ctx, args);
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return saveMessages(this.ctx, args);
  }

  async updateMessages(args: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
      content?: { metadata?: MastraMessageContentV2['metadata']; content?: MastraMessageContentV2['content'] };
    })[];
  }): Promise<MastraDBMessage[]> {
    return updateMessages(this.ctx, args);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return deleteMessages(this.ctx, messageIds);
  }

  async getResourceById(args: { resourceId: string }): Promise<StorageResourceType | null> {
    return getResourceById(this.ctx, args);
  }

  async saveResource(args: { resource: StorageResourceType }): Promise<StorageResourceType> {
    return saveResource(this.ctx, args);
  }

  async updateResource(args: {
    resourceId: string;
    workingMemory?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageResourceType> {
    return updateResource(this.ctx, args);
  }

  async cloneThread(args: StorageCloneThreadInput): Promise<StorageCloneThreadOutput> {
    const sourceThread = await this.getThreadById({ threadId: args.sourceThreadId });
    if (!sourceThread) {
      throw storageError('CLONE_THREAD', 'FAILED', { threadId: args.sourceThreadId }, new Error(`Thread ${args.sourceThreadId} not found`), ErrorCategory.USER);
    }

    const sourceMessages = await this.messagesForClone(args);
    const newThreadId = args.newThreadId ?? randomUUID();
    const existingDestination = await this.getThreadById({ threadId: newThreadId });
    if (existingDestination) {
      throw storageError(
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

    try {
      // Insert the destination thread and its cloned messages in one
      // transaction: a failure partway through (e.g. a message insert error)
      // must not leave an orphaned, message-less clone of the thread committed.
      await this.db.tx(async client => {
        try {
          // Insert-only, never MERGE: the existence check above is only a
          // friendly fast path, so a concurrent clone that won the race must
          // surface here as a unique-key violation instead of silently
          // updating the winner's thread and mixing both message batches.
          await insertThreadRow(this.ctx, client, thread);
        } catch (error) {
          if (isOracleErrorCode(error, [-1])) {
            throw storageError('CLONE_THREAD', 'DESTINATION_EXISTS', { threadId: newThreadId }, error, ErrorCategory.USER);
          }
          throw error;
        }
        if (clonedMessages.length) await insertMessageBatch(this.ctx, client, clonedMessages);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw storageError('CLONE_THREAD', 'FAILED', { threadId: newThreadId }, error);
    }

    return { thread, clonedMessages, messageIdMap };
  }

  private async messagesForClone(args: StorageCloneThreadInput): Promise<MastraDBMessage[]> {
    const options = args.options;
    const messageIds = options?.messageFilter?.messageIds;
    if (messageIds?.length) {
      return (await this.listMessagesById({ messageIds })).messages.filter(message => message.threadId === args.sourceThreadId);
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

  // ============================================
  // Observational Memory
  // ============================================

  async getObservationalMemory(threadId: string | null, resourceId: string): Promise<ObservationalMemoryRecord | null> {
    return getObservationalMemory(this.ctx, threadId, resourceId);
  }

  async getObservationalMemoryHistory(
    threadId: string | null,
    resourceId: string,
    limit = 10,
    options?: ObservationalMemoryHistoryOptions,
  ): Promise<ObservationalMemoryRecord[]> {
    return getObservationalMemoryHistory(this.ctx, threadId, resourceId, limit, options);
  }

  async initializeObservationalMemory(input: CreateObservationalMemoryInput): Promise<ObservationalMemoryRecord> {
    return initializeObservationalMemory(this.ctx, input);
  }

  async insertObservationalMemoryRecord(record: ObservationalMemoryRecord): Promise<void> {
    return insertObservationalMemoryRecord(this.ctx, record);
  }

  async updateActiveObservations(input: UpdateActiveObservationsInput): Promise<void> {
    return updateActiveObservations(this.ctx, input);
  }

  async createReflectionGeneration(input: CreateReflectionGenerationInput): Promise<ObservationalMemoryRecord> {
    return createReflectionGeneration(this.ctx, input);
  }

  async setReflectingFlag(id: string, isReflecting: boolean): Promise<void> {
    return setReflectingFlag(this.ctx, id, isReflecting);
  }

  async setObservingFlag(id: string, isObserving: boolean): Promise<void> {
    return setObservingFlag(this.ctx, id, isObserving);
  }

  async setBufferingObservationFlag(id: string, isBuffering: boolean, lastBufferedAtTokens?: number): Promise<void> {
    return setBufferingObservationFlag(this.ctx, id, isBuffering, lastBufferedAtTokens);
  }

  async setBufferingReflectionFlag(id: string, isBuffering: boolean): Promise<void> {
    return setBufferingReflectionFlag(this.ctx, id, isBuffering);
  }

  async clearObservationalMemory(threadId: string | null, resourceId: string): Promise<void> {
    return clearObservationalMemory(this.ctx, threadId, resourceId);
  }

  async setPendingMessageTokens(id: string, tokenCount: number): Promise<void> {
    return setPendingMessageTokens(this.ctx, id, tokenCount);
  }

  async updateObservationalMemoryConfig(input: UpdateObservationalMemoryConfigInput): Promise<void> {
    return updateObservationalMemoryConfig(this.ctx, input);
  }

  async updateBufferedObservations(input: UpdateBufferedObservationsInput): Promise<void> {
    return updateBufferedObservations(this.ctx, input);
  }

  async swapBufferedToActive(input: SwapBufferedToActiveInput): Promise<SwapBufferedToActiveResult> {
    return swapBufferedToActive(this.ctx, input);
  }

  async updateBufferedReflection(input: UpdateBufferedReflectionInput): Promise<void> {
    return updateBufferedReflection(this.ctx, input);
  }

  async swapBufferedReflectionToActive(input: SwapBufferedReflectionToActiveInput): Promise<ObservationalMemoryRecord> {
    return swapBufferedReflectionToActive(this.ctx, input);
  }
}
