import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains, TABLE_NAMES, StorageColumn } from '@mastra/core/storage';

export interface DrizzleConfig {
  dialect: 'postgresql' | 'mysql' | 'sqlite' | 'turso' | 'planetscale' | 'neon' | 'vercel-postgres';
  connection: any; // Will be refined based on dialect
  schemaName?: string;
  logger?:
    | boolean
    | {
        logQuery?: (query: string, params: any[], duration: number) => void;
        logError?: (error: Error) => void;
      };
  migrations?: {
    folder?: string;
    autoRun?: boolean;
    onError?: 'rollback' | 'ignore' | 'throw';
  };
  optimizer?: {
    connectionPoolSize?: number;
    statementCacheSize?: number;
    usePreparedStatements?: boolean;
  };
  cache?: {
    enabled?: boolean;
    ttl?: number;
    maxSize?: number;
    strategy?: 'lru' | 'lfu';
  };
}

export class DrizzleStore extends MastraStorage {
  private config: DrizzleConfig;
  private db: any; // Will be typed based on dialect
  stores!: StorageDomains;

  constructor(config: DrizzleConfig) {
    super({ name: 'DrizzleStore' });
    this.config = config;

    // Initialization will happen in init()
  }

  /**
   * Initialize the store and all its components
   */
  async init(): Promise<void> {
    this.logger.info('Initializing DrizzleStore', { dialect: this.config.dialect });

    // TODO: Initialize dialect
    // TODO: Initialize connection
    // TODO: Initialize domains
    // TODO: Run migrations if configured

    this.logger.info('DrizzleStore initialized successfully');
  }

  /**
   * Get the raw Drizzle database client
   */
  getDb() {
    if (!this.db) {
      throw new Error('DrizzleStore not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Get schema definitions
   */
  getSchemas() {
    // TODO: Return schema definitions
    return {};
  }

  /**
   * Capabilities supported by this adapter
   */
  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: true,
      createTable: true,
      deleteMessages: true,
      aiTracing: true,
      indexManagement: true,
    };
  }

  // Required abstract methods from MastraStorage
  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    // TODO: Implement table creation
    void tableName;
    void schema;
    throw new Error('Not implemented');
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    // TODO: Implement table clearing
    void tableName;
    throw new Error('Not implemented');
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    // TODO: Implement table dropping
    void tableName;
    throw new Error('Not implemented');
  }

  async alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // TODO: Implement table alteration
    void args;
    throw new Error('Not implemented');
  }

  async hasColumn(args: { tableName: TABLE_NAMES; columnName: string }): Promise<boolean> {
    // TODO: Implement column checking
    void args;
    throw new Error('Not implemented');
  }

  async hasTable({ tableName }: { tableName: TABLE_NAMES }): Promise<boolean> {
    // TODO: Implement table checking
    void tableName;
    throw new Error('Not implemented');
  }

  // Temporarily stub all required abstract methods
  // These will be implemented when we create the domain implementations
  async insert(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async batchInsert(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async load(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getThreadById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async saveThread(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async updateThread(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getMessagesById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async saveMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async updateMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async deleteMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getThreadByResourceId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getThreadsByResourceId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async createThread(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async deleteThread(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async createResource(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async deleteResource(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async createMessage(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async bulkDeleteMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async updateMessage(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getAllThreadsForResourceByParams(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getAllThreadsForResourceByParamsDeprecated(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getMessagesByResourceId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getMessagesCountsByThreadId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async searchMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async searchMessagesInThreads(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getFullContext(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async insertEvent(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async queryEvents(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getEvalsByAgentName(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getEvals(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async saveEvalRow(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getScoreById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async saveScore(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getScoresByScorerId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getScoresByRunId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getScoresByEntityId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getTraces(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getTracesPaginated(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async batchTraceInsert(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async updateWorkflowResults(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async updateWorkflowState(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async persistWorkflowSnapshot(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async queryWorkflowSnapshots(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async workflowRuns(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async deleteWorkflowRun(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getWorkflowRuns(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getWorkflowRunById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getThreadsByResourceIdPaginated(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }

  async getMessagesPaginated(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented');
  }
}
