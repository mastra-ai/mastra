import type { StorageThreadType, MastraMessageV1, MastraMessageV2, Trace } from '@mastra/core';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type {
  EvalRow,
  PaginationInfo,
  StorageColumn,
  StorageGetMessagesArg,
  StorageGetTracesArg,
  TABLE_NAMES,
  WorkflowRun,
  WorkflowRuns,
} from '@mastra/core/storage';
import { MastraStorage } from '@mastra/core/storage';
import { ConvexClient, ConvexHttpClient } from 'convex/browser';

/**
 * Configuration options for ConvexStorage
 */
export interface ConvexStorageConfig {
  /**
   * Convex deployment URL (e.g., https://xxx.convex.cloud)
   */
  convexUrl: string;

  /**
   * Auto-generated API from Convex
   * Import from convex/_generated/api
   */
  api: any;
}

/**
 * Convex DB implementation of Mastra's storage interface.
 * Provides both standard storage operations and real-time subscription capabilities.
 */
export class ConvexStorage extends MastraStorage {
  private httpClient: ConvexHttpClient;
  private client: ConvexClient;
  private api: any;

  constructor(config: ConvexStorageConfig) {
    super({
      name: 'convex',
    });
    this.httpClient = new ConvexHttpClient(config.convexUrl);
    this.client = new ConvexClient(config.convexUrl);
    this.api = config.api;
  }

  /**
   * Create a table in the database, Convex doesn't support dynamic table creation at runtime
   * @param params Table name and schema
   * @returns Promise that resolves when complete
   */
  async createTable({ tableName }: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    try {
      // Convex doesn't support dynamic table creation at runtime
      // Tables are defined in schema.ts and deployed with the application
      // This is a no-op for compatibility with the MastraStorage interface
      await this.ensureTables();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_CREATE_TABLE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }
  /**
   * Clear all data from a table, Convex doesn't support dynamic table deletion at runtime
   * @param params Table name
   * @returns Promise that resolves when complete
   */
  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    try {
      // Use system API to clear a specific table
      // In Convex, we simulate this by fetching all records and deleting them
      await this.client.mutation(this.api.system.clearTable, { tableName });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_CLEAR_TABLE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }
  /**
   * Alter table schema, Convex doesn't support dynamic schema changes at runtime
   * @param args Table name, schema, and columns to conditionally add
   * @returns Promise that resolves when complete
   */
  async alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    try {
      // Convex doesn't support dynamic schema changes at runtime
      // This is a no-op for compatibility with the MastraStorage interface
      await this.ensureTables();
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_ALTER_TABLE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName: args.tableName,
          },
        },
        error,
      );
    }
  }
  /**
   * Insert a record into a table
   * @param params Table name and record to insert
   * @returns Promise that resolves when complete
   */
  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    try {
      await this.httpClient.mutation(this.api.system.insert, { tableName, record });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_INSERT_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }
  /**
   * Insert multiple records into a table
   * @param params Table name and records to insert
   * @returns Promise that resolves when complete
   */
  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    try {
      await this.httpClient.mutation(this.api.system.batchInsert, { tableName, records });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_BATCH_INSERT_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            recordCount: records.length,
          },
        },
        error,
      );
    }
  }
  /**
   * Load a record by its keys
   * @param params Table name and key values
   * @returns Record if found, null otherwise
   */
  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, string> }): Promise<R | null> {
    try {
      return (await this.httpClient.query(this.api.system.load, { tableName, keys })) as R | null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_LOAD_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
            keys: JSON.stringify(keys),
          },
        },
        error,
      );
    }
  }
  /**
   * Delete a thread and all associated messages
   * @param params Thread ID
   * @returns Promise that resolves when complete
   */
  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    try {
      await this.client.mutation(this.api.threads.deleteThread, { threadId });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DELETE_THREAD_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }
  /**
   * Get traces with filtering
   * @param args Trace filter arguments
   * @returns Array of traces
   */
  async getTraces(args: StorageGetTracesArg): Promise<Trace[]> {
    try {
      const result = await this.httpClient.query(this.api.traces.getPaginated, args);
      return result.traces;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_TRACES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            args: JSON.stringify(args),
          },
        },
        error,
      );
    }
  }
  /**
   * Get evaluations by agent name
   * @param agentName Agent name to filter by
   * @param type Optional type to filter by ('test' or 'live')
   * @returns Array of evaluations
   */
  async getEvalsByAgentName(agentName: string, type?: 'test' | 'live'): Promise<EvalRow[]> {
    try {
      return await this.httpClient.query(this.api.evals.getByAgentName, { agentName, type });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_EVALS_BY_AGENT_NAME_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            agentName,
            type: type || 'live',
          },
        },
        error,
      );
    }
  }
  /**
   * Get workflow runs with filtering and pagination
   * @param args Optional filter and pagination parameters
   * @returns Workflow runs with pagination info
   */
  async getWorkflowRuns(args?: {
    workflowName?: string;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
    offset?: number;
    resourceId?: string;
  }): Promise<WorkflowRuns> {
    try {
      return await this.httpClient.query(this.api.workflowRuns.getPaginated, args || {});
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_WORKFLOW_RUNS_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            args: JSON.stringify(args || {}),
          },
        },
        error,
      );
    }
  }
  /**
   * Get a workflow run by ID
   * @param args Run ID and optional workflow name
   * @returns Workflow run if found, null otherwise
   */
  async getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null> {
    try {
      const run = await this.httpClient.query(this.api.workflowRuns.get, { runId: args.runId });

      // Filter by workflow name if provided
      if (run && args.workflowName && run.workflowName !== args.workflowName) {
        return null;
      }

      return run || null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_WORKFLOW_RUN_BY_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            args: JSON.stringify(args),
          },
        },
        error,
      );
    }
  }
  /**
   * Get messages with pagination
   * @param args Thread ID, pagination, and format options
   * @returns Paginated messages
   */
  async getMessagesPaginated(
    args: StorageGetMessagesArg & { format?: 'v1' | 'v2' },
  ): Promise<PaginationInfo & { messages: MastraMessageV2[] }> {
    try {
      // In Convex implementation we only support v2 format
      const result = await this.httpClient.query(this.api.messages.getPaginated, args);

      // Calculate hasMore based on total and current page info
      const hasMore = result.page * result.perPage < result.total;

      return {
        messages: result.messages,
        total: result.total,
        page: result.page,
        perPage: result.perPage,
        hasMore,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_MESSAGES_PAGINATED_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            args: JSON.stringify(args),
          },
        },
        error,
      );
    }
  }

  /**
   * Retrieves a thread by its ID
   * @param params - The thread ID to retrieve
   * @returns The thread or null if not found
   */
  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      const result = await this.httpClient.query(this.api.threads.getById, { threadId });

      // If the thread doesn't exist (was deleted or never existed), return null
      if (!result) {
        return null;
      }

      return {
        id: result.threadId,
        title: result.title,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        metadata: result.metadata,
        resourceId: result.resourceId,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_THREAD_BY_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  /**
   * Gets all threads associated with a resource ID
   * @param params - The resource ID to search for
   * @returns Array of threads linked to the resource
   */
  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      const result = await this.httpClient.query(this.api.threads.getByResourceId, { resourceId });

      return result.map((thread: any) => ({
        id: thread.threadId,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: thread.metadata,
        resourceId: thread.resourceId,
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_THREADS_BY_RESOURCE_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            resourceId,
          },
        },
        error,
      );
    }
  }

  /**
   * Saves a new thread
   * @param params - Thread data to save
   * @returns The saved thread
   */
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    const threadToSave = {
      ...thread,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try {
      return await this.client.mutation(this.api.threads.save, { thread: threadToSave });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_SAVE_THREAD_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: thread.id,
          },
        },
        error,
      );
    }
  }

  /**
   * Updates thread properties
   * @param params - Thread ID, title, and metadata
   * @returns The updated thread
   */
  async updateThread({
    id,
    title,
    metadata,
  }: {
    id: string;
    title: string;
    metadata: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    try {
      const updatedThread = await this.client.mutation(this.api.threads.update, { id, title, metadata });

      return {
        id: updatedThread.id,
        title: updatedThread.title,
        createdAt: updatedThread.createdAt,
        updatedAt: updatedThread.updatedAt,
        metadata: updatedThread.metadata,
        resourceId: updatedThread.resourceId,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPDATE_THREAD_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId: id,
          },
        },
        error,
      );
    }
  }

  /**
   * Retrieves a message by ID
   * @param params - Message ID
   * @returns The message or null if not found
   */
  async getMessage({ id }: { id: string }): Promise<MastraMessageV2 | null> {
    try {
      const message = await this.httpClient.query(this.api.messages.get, { id });
      if (!message) {
        return null;
      }

      return {
        id: message.messageId,
        threadId: message.threadId,
        content: message.content,
        role: message.messageType,
        createdAt: message.createdAt,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_MESSAGE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageId: id,
          },
        },
        error,
      );
    }
  }

  /**
   * Gets all messages for a thread with v1 format
   * @param params - Thread ID and optional format
   * @returns Array of v1 messages
   */
  async getMessages(args: StorageGetMessagesArg & { format?: 'v1' }): Promise<MastraMessageV1[]>;

  /**
   * Gets all messages for a thread with v2 format
   * @param params - Thread ID and format
   * @returns Array of v2 messages
   */
  async getMessages(args: StorageGetMessagesArg & { format: 'v2' }): Promise<MastraMessageV2[]>;

  /**
   * Gets all messages for a thread with either format
   * @param params - Thread ID and optional format
   * @returns Array of messages in the requested format
   */
  async getMessages({
    threadId,
    resourceId,
    selectBy,
    format = 'v2',
  }: StorageGetMessagesArg & { format?: 'v1' | 'v2' }): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      const result = await this.httpClient.query(this.api.messages.getByThreadId, { threadId, resourceId, selectBy });

      // Extract the messages array from the pagination result
      const rawMessages = result.page || [];

      // Transform the raw database messages to the expected MastraMessageV2 format
      const messages = rawMessages.map((rawMsg: Record<string, any>) => ({
        id: rawMsg.messageId,
        threadId: rawMsg.threadId,
        content: rawMsg.content.content,
        role: rawMsg.messageType,
        createdAt: rawMsg.createdAt,
      }));

      if (format === 'v1') {
        // Convert MastraMessageV2[] to MastraMessageV1[]
        return messages.map((msg: MastraMessageV2) => {
          // Create a basic MastraMessageV1 from a MastraMessageV2
          const contentV1 = msg.content.parts.map((part: any) => {
            return part.text.concat();
          });
          const contentString = contentV1.join('');
          const v1Msg: MastraMessageV1 = {
            id: msg.id,
            threadId: msg.threadId,
            createdAt: msg.createdAt,
            role: msg.role,
            // Convert structured content to string format
            content: contentString,
            // Default to 'text' type
            type: 'text',
          };

          // Copy optional resourceId if exists
          if (msg.resourceId) {
            v1Msg.resourceId = msg.resourceId;
          }

          return v1Msg;
        });
      }

      return messages;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_MESSAGES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
            resourceId: resourceId || 'N/A',
            format,
          },
        },
        error,
      );
    }
  }

  /**
   * Saves a message
   * @param params - Message data
   * @returns The saved message
   */
  async saveMessage({ message }: { message: MastraMessageV2 }): Promise<MastraMessageV2> {
    try {
      const messageToSave = {
        ...message,
        createdAt: message.createdAt.getTime(),
        updatedAt: Date.now(),
      };
      return await this.httpClient.mutation(this.api.messages.save, { message: messageToSave });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_SAVE_MESSAGE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageId: message.id || 'N/A',
            threadId: message.threadId || 'N/A',
            resourceId: message.resourceId || 'N/A',
          },
        },
        error,
      );
    }
  }

  /**
   * Updates multiple messages
   * @param params - Array of message updates
   * @returns Array of updated messages
   */
  async updateMessages(args: {
    messages: Partial<Omit<MastraMessageV2, 'createdAt'>> &
      { id: string; content?: { metadata?: Record<string, unknown> | undefined; content?: string | undefined } }[];
  }): Promise<MastraMessageV2[]> {
    try {
      return await this.httpClient.mutation(this.api.messages.update, args);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPDATE_MESSAGES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageCount: args.messages.length,
            messageIds: JSON.stringify(args.messages.map(msg => msg.id || 'N/A')),
          },
        },
        error,
      );
    }
  }

  /**
   * Saves multiple messages with format 'v1'
   * @param args - Object containing messages array and optional format
   * @returns Array of saved messages in v1 format
   */
  async saveMessages(args: { messages: MastraMessageV1[]; format?: undefined | 'v1' }): Promise<MastraMessageV1[]>;

  /**
   * Saves multiple messages with format 'v2'
   * @param args - Object containing messages array and format
   * @returns Array of saved messages in v2 format
   */
  async saveMessages(args: { messages: MastraMessageV2[]; format: 'v2' }): Promise<MastraMessageV2[]>;

  /**
   * Implementation of saveMessages
   * @param args - Object containing messages and optional format
   * @returns Array of saved messages in the requested format
   */
  async saveMessages(
    args: { messages: MastraMessageV1[]; format?: undefined | 'v1' } | { messages: MastraMessageV2[]; format: 'v2' },
  ): Promise<MastraMessageV1[] | MastraMessageV2[]> {
    try {
      const { messages, format = 'v1' } = args;

      if (format === 'v2') {
        // Save MastraMessageV2[] directly
        const messageToSave = messages.map(msg => {
          return {
            ...msg,
            createdAt: msg.createdAt.getTime(),
            updatedAt: Date.now(),
          };
        });
        return await this.httpClient.mutation(this.api.messages.save, { messages: messageToSave });
      } else {
        // Convert MastraMessageV1[] to MastraMessageV2[] for storage
        const v2Messages = (messages as MastraMessageV1[]).map(msg => {
          // Ensure role is compatible with MastraMessageV2
          const role = msg.role === 'system' || msg.role === 'tool' ? 'assistant' : msg.role;

          // Create basic v2 message
          const v2Msg: MastraMessageV2 = {
            id: msg.id,
            role: role as 'user' | 'assistant',
            createdAt: msg.createdAt,
            content: {
              format: 2,
              parts: typeof msg.content === 'string' ? [{ type: 'text', text: msg.content }] : [], // We'll need a more complex conversion for complex content types
            },
          };

          if (msg.threadId) v2Msg.threadId = msg.threadId;
          if (msg.resourceId) v2Msg.resourceId = msg.resourceId;
          if (msg.type) v2Msg.type = msg.type;

          return v2Msg;
        });

        const v2MessagesToSave = v2Messages.map(msg => {
          return {
            ...msg,
            createdAt: msg.createdAt.getTime(),
            updatedAt: Date.now(),
          };
        });

        // Save the converted messages
        const savedV2Messages = await this.httpClient.mutation(this.api.messages.save, { messages: v2MessagesToSave });

        // Convert back to MastraMessageV1[] for return
        return savedV2Messages.map((msg: MastraMessageV2) => {
          const content = msg.content.parts.map((part: any) => part.text).join('');

          // Create a basic MastraMessageV1 from a MastraMessageV2
          const v1Msg: MastraMessageV1 = {
            id: msg.id,
            // MastraMessageV1 supports more role types than MastraMessageV2
            role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
            createdAt: msg.createdAt,
            // Convert structured content to string format
            content,
            // Default to 'text' type if not specified
            type: 'text',
          };

          // Copy optional properties if they exist
          if (msg.threadId) v1Msg.threadId = msg.threadId;
          if (msg.resourceId) v1Msg.resourceId = msg.resourceId;

          return v1Msg;
        });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_SAVE_MESSAGES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            messageCount: args.messages.length,
            format: args.format || 'v2',
          },
        },
        error,
      );
    }
  }

  /**
   * Saves a trace
   * @param params - Trace data
   * @returns The saved trace
   */
  async saveTrace({ trace }: { trace: Trace }): Promise<Trace> {
    try {
      return await this.httpClient.mutation(this.api.traces.save, { trace });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_SAVE_TRACE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            traceId: trace.id,
          },
        },
        error,
      );
    }
  }

  /**
   * Gets all traces for a thread
   * @param params - Thread ID
   * @returns Array of traces
   */
  async getTracesByThreadId({ threadId }: { threadId: string }): Promise<Trace[]> {
    try {
      return await this.httpClient.query(this.api.traces.getByThreadId, { threadId });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_TRACES_BY_THREAD_ID_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            threadId,
          },
        },
        error,
      );
    }
  }

  /**
   * Gets traces with pagination
   * @param args - Pagination parameters
   * @returns Paginated trace results
   */
  async getTracesPaginated(args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
    try {
      return await this.httpClient.query(this.api.traces.getPaginated, args);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_TRACES_PAGINATED_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            args: JSON.stringify(args),
          },
        },
        error,
      );
    }
  }

  /**
   * Gets threads for a resource with pagination
   * @param args - Resource ID and pagination parameters
   * @returns Paginated thread results
   */
  async getThreadsByResourceIdPaginated(args: {
    resourceId: string;
    page: number;
    perPage: number;
  }): Promise<PaginationInfo & { threads: StorageThreadType[] }> {
    try {
      // Transform parameters to match the Convex API format
      // The API expects paginationOpts with cursor and numItems
      const { resourceId, page, perPage } = args;

      // Calculate cursor based on page and perPage
      // For the first page, use null cursor
      // For subsequent pages, we're simulating pagination by setting numItems
      // to handle the appropriate number of items
      const transformedArgs = {
        resourceId,
        paginationOpts: {
          cursor: null, // Using null for cursor as we're relying on numItems and skip
          numItems: perPage * page, // Get all items up to this page
        },
        sortDirection: 'desc', // Default sort direction
      };

      const result = await this.httpClient.query(this.api.threads.getByResourceIdPaginated, transformedArgs);

      // Process the result to match the expected format with correct pagination
      // We need to slice the results to get just the current page
      const startIndex = (page - 1) * perPage;
      const endIndex = startIndex + perPage;

      const paginatedThreads = result.page ? result.page.slice(startIndex, endIndex) : [];

      // Transform Convex thread format to StorageThreadType
      const threads = paginatedThreads.map((thread: any) => ({
        id: thread.threadId,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: thread.metadata,
        resourceId: thread.resourceId,
      }));

      return {
        threads,
        total: result.total || 0,
        page,
        perPage,
        hasMore: endIndex < (result.total || 0),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_THREADS_BY_RESOURCE_ID_PAGINATED_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            args: JSON.stringify(args),
          },
        },
        error,
      );
    }
  }

  /**
   * Saves an evaluation
   * @param params - Evaluation data
   * @returns Saved evaluation
   */
  async saveEval({ evalData }: { evalData: EvalRow }): Promise<EvalRow> {
    try {
      const evalToSave = {
        ...evalData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      return await this.httpClient.mutation(this.api.evals.save, { evalData: evalToSave });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_SAVE_EVAL_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            evalData: JSON.stringify(evalData),
          },
        },
        error,
      );
    }
  }

  /**
   * Gets an evaluation by ID
   * @param params - Evaluation ID
   * @returns Evaluation data or null
   */
  async getEval({ runId }: { runId: string }): Promise<EvalRow | null> {
    try {
      const evalData = await this.httpClient.query(this.api.evals.get, { runId });
      if (!evalData) {
        return null;
      }
      return evalData;
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_EVAL_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId,
          },
        },
        error,
      );
    }
  }

  /**
   * Saves a workflow run
   * @param params - Workflow run data
   * @returns Saved workflow run
   */
  async saveWorkflowRun({ workflowRun }: { workflowRun: WorkflowRun }): Promise<WorkflowRun> {
    try {
      return await this.httpClient.mutation(this.api.workflowRuns.save, { workflowRun });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_SAVE_WORKFLOW_RUN_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId: workflowRun.runId,
            workflowName: workflowRun.workflowName,
          },
        },
        error,
      );
    }
  }

  /**
   * Gets workflow runs by state type
   * @param params - State type to filter by
   * @returns Array of workflow runs
   */
  async getWorkflowRunsByStateType({ stateType }: { stateType: string }): Promise<WorkflowRun[]> {
    try {
      return await this.httpClient.query(this.api.workflowRuns.getByStateType, { stateType });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_WORKFLOW_RUNS_BY_STATE_TYPE_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            stateType: stateType,
          },
        },
        error,
      );
    }
  }

  /**
   * Gets a workflow run
   * @param params - Run ID
   * @returns Workflow run data
   */
  async getWorkflowRun({ runId }: { runId: string }): Promise<WorkflowRun | undefined> {
    try {
      return await this.httpClient.query(this.api.workflowRuns.get, { runId });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_WORKFLOW_RUN_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runId: runId,
          },
        },
        error,
      );
    }
  }

  /**
   * Updates workflow runs
   * @param params - Updates for workflow runs
   * @returns The number of runs updated
   */
  async updateWorkflowRuns({ runs }: { runs: WorkflowRuns }): Promise<number> {
    try {
      return await this.httpClient.mutation(this.api.workflowRuns.update, { runs });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPDATE_WORKFLOW_RUNS_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            runsCount: runs.runs.length,
          },
        },
        error,
      );
    }
  }

  /**
   * Drops tables and recreates them with new schema
   */
  async dropAllTables(): Promise<void> {
    try {
      await this.httpClient.mutation(this.api.system.dropAllTables);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DROP_ALL_TABLES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {},
        },
        error,
      );
    }
  }

  /**
   * Creates schema tables if they don't exist
   */
  async ensureTables(): Promise<void> {
    try {
      await this.httpClient.mutation(this.api.system.ensureTables);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_ENSURE_TABLES_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {},
        },
        error,
      );
    }
  }

  /**
   * Gets storage columns for a table
   * @param params - Table name
   * @returns Array of column definitions
   */
  async getTableColumns({ tableName }: { tableName: TABLE_NAMES }): Promise<StorageColumn[] | null> {
    try {
      return await this.httpClient.query(this.api.system.getTableColumns, { tableName });
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_GET_TABLE_COLUMNS_ERROR',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            tableName,
          },
        },
        error,
      );
    }
  }

  // ---- Reactive methods (ConvexDB-specific) ----

  /**
   * Subscribe to thread updates in real-time
   * @param threadId - Thread to subscribe to
   * @param callback - Function called when thread changes
   * @returns Function to unsubscribe
   */
  subscribeToThread(threadId: string, callback: (thread: StorageThreadType | null) => void): () => void {
    try {
      // Use ConvexClient's onUpdate for real-time subscription
      const unsubscribe = this.client.onUpdate(this.api.threads.getById, { threadId }, thread =>
        callback(thread as StorageThreadType | null),
      );

      return () => {
        try {
          unsubscribe();
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          this.logger.error('Error unsubscribing from thread', { threadId, error });
        }
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to create thread subscription', { threadId, error });
      // Return a no-op function in case of error
      return () => {};
    }
  }

  /**
   * Subscribe to thread messages in real-time
   * @param threadId - Thread whose messages to subscribe to
   * @param callback - Function called when messages change
   * @returns Function to unsubscribe
   */
  subscribeToThreadMessages(threadId: string, callback: (messages: MastraMessageV2[]) => void): () => void {
    try {
      // Use ConvexClient's onUpdate for real-time subscription
      const unsubscribe = this.client.onUpdate(this.api.messages.getByThreadId, { threadId }, messages =>
        callback(messages as MastraMessageV2[]),
      );

      return () => {
        try {
          unsubscribe();
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          this.logger.error('Error unsubscribing from thread messages', { threadId, error });
        }
      };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to create thread messages subscription', { threadId, error });
      // Return a no-op function in case of error
      return () => {};
    }
  }
}
