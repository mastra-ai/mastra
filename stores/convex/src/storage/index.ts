import type { StorageThreadType, MastraMessageV2, Trace } from '@mastra/core';
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
import { ConvexHttpClient } from 'convex/browser';

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
  private client: ConvexHttpClient;
  private api: any;

  /**
   * Create a new ConvexStorage instance
   * @param config Configuration options for Convex
   */
  constructor(config: ConvexStorageConfig) {
    super({
      name: 'convex',
    });
    this.client = new ConvexHttpClient(config.convexUrl);
    this.api = config.api;
  }

  /**
   * Retrieves a thread by its ID
   * @param params - The thread ID to retrieve
   * @returns The thread or null if not found
   */
  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    try {
      return await this.client.query(this.api.threads.getById, { threadId });
    } catch (error) {
      throw new Error(`Failed to get thread by ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets all threads associated with a resource ID
   * @param params - The resource ID to search for
   * @returns Array of threads linked to the resource
   */
  async getThreadsByResourceId({ resourceId }: { resourceId: string }): Promise<StorageThreadType[]> {
    try {
      return await this.client.query(this.api.threads.getByResourceId, { resourceId });
    } catch (error) {
      throw new Error(
        `Failed to get threads by resource ID: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Saves a new thread
   * @param params - Thread data to save
   * @returns The saved thread
   */
  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    try {
      return await this.client.mutation(this.api.threads.save, { thread });
    } catch (error) {
      throw new Error(`Failed to save thread: ${error instanceof Error ? error.message : String(error)}`);
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
      return await this.client.mutation(this.api.threads.update, { id, title, metadata });
    } catch (error) {
      throw new Error(`Failed to update thread: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Retrieves a message by ID
   * @param params - Message ID
   * @returns The message or null if not found
   */
  async getMessage({ id }: { id: string }): Promise<MastraMessageV2 | null> {
    try {
      return await this.client.query(this.api.messages.get, { id });
    } catch (error) {
      throw new Error(`Failed to get message: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets all messages for a thread
   * @param params - Thread ID
   * @returns Array of messages
   */
  async getMessages(args: StorageGetMessagesArg): Promise<MastraMessageV2[]> {
    try {
      return await this.client.query(this.api.messages.getByThreadId, args);
    } catch (error) {
      throw new Error(`Failed to get messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves a message
   * @param params - Message data
   * @returns The saved message
   */
  async saveMessage({ message }: { message: MastraMessageV2 }): Promise<MastraMessageV2> {
    try {
      return await this.client.mutation(this.api.messages.save, { message });
    } catch (error) {
      throw new Error(`Failed to save message: ${error instanceof Error ? error.message : String(error)}`);
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
      return await this.client.mutation(this.api.messages.update, args);
    } catch (error) {
      throw new Error(`Failed to update messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves multiple messages
   * @param params - Array of messages to save
   * @returns Array of saved messages
   */
  async saveMessages({ messages }: { messages: MastraMessageV2[] }): Promise<MastraMessageV2[]> {
    try {
      return await this.client.mutation(this.api.messages.save, { messages });
    } catch (error) {
      throw new Error(`Failed to save messages: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves a trace
   * @param params - Trace data
   * @returns The saved trace
   */
  async saveTrace({ trace }: { trace: Trace }): Promise<Trace> {
    try {
      return await this.client.mutation(this.api.traces.save, { trace });
    } catch (error) {
      throw new Error(`Failed to save trace: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets all traces for a thread
   * @param params - Thread ID
   * @returns Array of traces
   */
  async getTracesByThreadId({ threadId }: { threadId: string }): Promise<Trace[]> {
    try {
      return await this.client.query(this.api.traces.getByThreadId, { threadId });
    } catch (error) {
      throw new Error(`Failed to get traces: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets traces with pagination
   * @param args - Pagination parameters
   * @returns Paginated trace results
   */
  async getTracesPaginated(args: StorageGetTracesArg): Promise<PaginationInfo & { traces: Trace[] }> {
    try {
      return await this.client.query(this.api.traces.getPaginated, args);
    } catch (error) {
      throw new Error(`Failed to get paginated traces: ${error instanceof Error ? error.message : String(error)}`);
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
      return await this.client.query(this.api.threads.getByResourceIdPaginated, args);
    } catch (error) {
      throw new Error(`Failed to get paginated threads: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves an evaluation
   * @param params - Evaluation data
   * @returns Saved evaluation
   */
  async saveEval({ evalData }: { evalData: EvalRow }): Promise<EvalRow> {
    try {
      return await this.client.mutation(this.api.evals.save, { evalData });
    } catch (error) {
      throw new Error(`Failed to save eval: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets an evaluation by ID
   * @param params - Evaluation ID
   * @returns Evaluation data or null
   */
  async getEval({ evalId }: { evalId: string }): Promise<EvalRow | null> {
    try {
      return await this.client.query(this.api.evals.get, { evalId });
    } catch (error) {
      throw new Error(`Failed to get eval: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets evaluations for a thread
   * @param params - Thread ID
   * @returns Array of evaluations
   */
  async getEvalsByThreadId({ threadId }: { threadId: string }): Promise<EvalRow[]> {
    try {
      return await this.client.query(this.api.evals.getByThreadId, { threadId });
    } catch (error) {
      throw new Error(`Failed to get evals by thread ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Saves a workflow run
   * @param params - Workflow run data
   * @returns Saved workflow run
   */
  async saveWorkflowRun({ workflowRun }: { workflowRun: WorkflowRun }): Promise<WorkflowRun> {
    try {
      return await this.client.mutation(this.api.workflowRuns.save, { workflowRun });
    } catch (error) {
      throw new Error(`Failed to save workflow run: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets workflow runs by state type
   * @param params - State type to filter by
   * @returns Array of workflow runs
   */
  async getWorkflowRunsByStateType({ stateType }: { stateType: string }): Promise<WorkflowRun[]> {
    try {
      return await this.client.query(this.api.workflowRuns.getByStateType, { stateType });
    } catch (error) {
      throw new Error(
        `Failed to get workflow runs by state type: ${error instanceof Error ? error.message : String(error)}`,
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
      return await this.client.query(this.api.workflowRuns.get, { runId });
    } catch (error) {
      throw new Error(`Failed to get workflow run: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates workflow runs
   * @param params - Updates for workflow runs
   * @returns The number of runs updated
   */
  async updateWorkflowRuns({ runs }: { runs: WorkflowRuns }): Promise<number> {
    try {
      return await this.client.mutation(this.api.workflowRuns.update, { runs });
    } catch (error) {
      throw new Error(`Failed to update workflow runs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Drops tables and recreates them with new schema
   */
  async dropAllTables(): Promise<void> {
    try {
      await this.client.mutation(this.api.system.dropAllTables);
    } catch (error) {
      throw new Error(`Failed to drop tables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates schema tables if they don't exist
   */
  async ensureTables(): Promise<void> {
    try {
      await this.client.mutation(this.api.system.ensureTables);
    } catch (error) {
      throw new Error(`Failed to ensure tables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets storage columns for a table
   * @param params - Table name
   * @returns Array of column definitions
   */
  async getTableColumns({ tableName }: { tableName: TABLE_NAMES }): Promise<StorageColumn[] | null> {
    try {
      return await this.client.query(this.api.system.getTableColumns, { tableName });
    } catch (error) {
      throw new Error(`Failed to get table columns: ${error instanceof Error ? error.message : String(error)}`);
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
    const subscription = this.client.onQuery(this.api.threads.getById, { threadId }, callback);
    return () => subscription.localQueryLogs.clear();
  }

  /**
   * Subscribe to thread messages in real-time
   * @param threadId - Thread whose messages to subscribe to
   * @param callback - Function called when messages change
   * @returns Function to unsubscribe
   */
  subscribeToThreadMessages(threadId: string, callback: (messages: MastraMessageV2[]) => void): () => void {
    const subscription = this.client.onQuery(this.api.messages.getByThreadId, { threadId }, callback);
    return () => subscription.localQueryLogs.clear();
  }
}
