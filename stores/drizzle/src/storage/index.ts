import { MastraStorage } from '@mastra/core/storage';
import type { StorageDomains, TABLE_NAMES, StorageColumn } from '@mastra/core/storage';
import { BaseDialect } from './dialects/base.js';
import { DialectFactory } from './dialects/factory.js';
import { DialectConfig, SchemaDefinition, SupportedDialect } from './dialects/types.js';
import { createMastraSchema } from './dialects/schema-builder.js';

export interface DrizzleConfig {
  dialect: SupportedDialect;
  connection: DialectConfig['connection'];
  schema?: SchemaDefinition;
  pool?: DialectConfig['pool'];
  schemaName?: string;
  logger?:
    | boolean
    | {
        logQuery?: (query: string, params: any[], duration: number) => void;
        logError?: (error: Error) => void;
      }
    | Console;
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
  private dialect?: BaseDialect;
  private config: DrizzleConfig;
  private schema: SchemaDefinition;

  declare stores: StorageDomains;

  constructor(config: DrizzleConfig) {
    super({ name: 'DrizzleStore' });
    this.config = config;
    this.schema = config.schema || createMastraSchema();
  }

  /**
   * Initialize the store and all its components
   */
  async init(): Promise<void> {
    this.logger.info('Initializing DrizzleStore', { dialect: this.config.dialect });

    try {
      const dialectConfig: DialectConfig = {
        type: this.config.dialect,
        connection: this.config.connection,
        pool: this.config.pool,
        drizzleConfig: {
          logger: this.config.logger === true ? true : false,
        },
      };

      this.dialect = await DialectFactory.create(dialectConfig);
      await this.dialect.connect();

      // Create schema
      this.dialect.createSchema(this.schema);

      // TODO: Initialize domain stores
      // this.stores = this.initializeDomains();

      // Run migrations if configured
      if (this.config.migrations?.autoRun) {
        await this.runMigrations();
      }

      this.logger.info('DrizzleStore initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize DrizzleStore', error);
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.dialect) {
      await this.dialect.disconnect();
      this.dialect = undefined;
      this.logger.info('DrizzleStore closed');
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    // TODO: Implement migration logic
    this.logger.info('Running migrations...');
  }

  // ============================================================================
  // Storage Operations Implementation
  // ============================================================================

  async createTable({
    tableName,
    schema,
  }: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
  }): Promise<void> {
    this.ensureConnected();

    // TODO: Convert StorageColumn schema to dialect schema and create table
    void schema;
    this.logger.info(`Creating table ${tableName}`);

    // For now, tables are created through the schema definition
    // In a full implementation, we would dynamically create tables here
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.ensureConnected();

    // Clear all rows from the table
    await this.dialect!.delete(tableName as string, {});
    this.logger.info(`Cleared table ${tableName}`);
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    this.ensureConnected();

    await this.dialect!.dropTable(tableName as string);
    this.logger.info(`Dropped table ${tableName}`);
  }

  async alterTable(args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // TODO: Implement table alteration
    void args;
    throw new Error('alterTable not yet implemented');
  }

  async hasColumn(args: { tableName: TABLE_NAMES; columnName: string }): Promise<boolean> {
    // TODO: Implement column checking
    void args;
    return false;
  }

  async hasTable({ tableName }: { tableName: TABLE_NAMES }): Promise<boolean> {
    this.ensureConnected();

    return await this.dialect!.tableExists(tableName as string);
  }

  // ============================================================================
  // Connection Management (for Mastra connections, not DB connections)
  // ============================================================================

  async saveConnection(connection: any): Promise<any> {
    this.ensureConnected();

    const data = {
      id: connection.id,
      name: connection.name,
      connection_id: connection.connectionId,
      provider: connection.provider,
      config: connection.config || {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    return await this.dialect!.insert('connections', data);
  }

  async getConnection(connectionId: string): Promise<any> {
    this.ensureConnected();

    const results = await this.dialect!.select('connections', { connection_id: connectionId });
    return results[0] || null;
  }

  async listConnections(): Promise<any[]> {
    this.ensureConnected();

    return await this.dialect!.select('connections');
  }

  async updateConnection(connectionId: string, connection: any): Promise<any> {
    this.ensureConnected();

    const data = {
      ...connection,
      updated_at: new Date(),
    };

    return await this.dialect!.update('connections', data, { connection_id: connectionId });
  }

  async deleteConnection(connectionId: string): Promise<void> {
    this.ensureConnected();

    await this.dialect!.delete('connections', { connection_id: connectionId });
  }

  // ============================================================================
  // Entity Methods
  // ============================================================================

  async saveEntity(entity: any): Promise<any> {
    this.ensureConnected();

    const data = {
      id: entity.id,
      entity_id: entity.entityId,
      entity_type: entity.entityType,
      connection_id: entity.connectionId,
      data: entity.data || {},
      created_at: new Date(),
      updated_at: new Date(),
    };

    return await this.dialect!.insert('entities', data);
  }

  async getEntity(entityId: string): Promise<any> {
    this.ensureConnected();

    const results = await this.dialect!.select('entities', { entity_id: entityId });
    return results[0] || null;
  }

  async listEntities(params?: any): Promise<any[]> {
    this.ensureConnected();

    const where: any = {};
    if (params?.connectionId) {
      where.connection_id = params.connectionId;
    }
    if (params?.entityType) {
      where.entity_type = params.entityType;
    }

    return await this.dialect!.select('entities', where, {
      limit: params?.limit,
      offset: params?.offset,
    });
  }

  async updateEntity(entityId: string, entity: any): Promise<any> {
    this.ensureConnected();

    const data = {
      ...entity,
      updated_at: new Date(),
    };

    return await this.dialect!.update('entities', data, { entity_id: entityId });
  }

  async deleteEntity(entityId: string): Promise<void> {
    this.ensureConnected();

    await this.dialect!.delete('entities', { entity_id: entityId });
  }

  async upsertEntity(entity: any): Promise<any> {
    this.ensureConnected();

    const existing = await this.getEntity(entity.entityId);
    if (existing) {
      return await this.updateEntity(entity.entityId, entity);
    }
    return await this.saveEntity(entity);
  }

  // ============================================================================
  // Sync Methods
  // ============================================================================

  async saveSync(sync: any): Promise<any> {
    this.ensureConnected();

    const data = {
      id: sync.id,
      sync_id: sync.syncId,
      connection_id: sync.connectionId,
      entity_type: sync.entityType,
      status: sync.status,
      error: sync.error,
      entities_synced: sync.entitiesSynced || 0,
      started_at: sync.startedAt,
      completed_at: sync.completedAt,
      created_at: new Date(),
      updated_at: new Date(),
    };

    return await this.dialect!.insert('syncs', data);
  }

  async getSync(syncId: string): Promise<any> {
    this.ensureConnected();

    const results = await this.dialect!.select('syncs', { sync_id: syncId });
    return results[0] || null;
  }

  async listSyncs(params?: any): Promise<any[]> {
    this.ensureConnected();

    const where: any = {};
    if (params?.connectionId) {
      where.connection_id = params.connectionId;
    }
    if (params?.status) {
      where.status = params.status;
    }

    return await this.dialect!.select('syncs', where, {
      limit: params?.limit,
      offset: params?.offset,
    });
  }

  async updateSync(syncId: string, sync: any): Promise<any> {
    this.ensureConnected();

    const data = {
      ...sync,
      updated_at: new Date(),
    };

    return await this.dialect!.update('syncs', data, { sync_id: syncId });
  }

  async deleteSync(syncId: string): Promise<void> {
    this.ensureConnected();

    await this.dialect!.delete('syncs', { sync_id: syncId });
  }

  // ============================================================================
  // Temporarily stub all required abstract methods
  // These will be implemented when we create the domain implementations
  // ============================================================================

  async insert(...args: any[]): Promise<any> {
    void args;
    throw new Error('Use domain-specific methods instead');
  }

  async batchInsert(...args: any[]): Promise<any> {
    void args;
    throw new Error('Use domain-specific methods instead');
  }

  async load(...args: any[]): Promise<any> {
    void args;
    throw new Error('Use domain-specific methods instead');
  }

  async getThreadById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async saveThread(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async updateThread(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async getMessagesById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async saveMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async updateMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async deleteMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async getThreadByResourceId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async getThreadsByResourceId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async getResourceById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async saveResources(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async updateResources(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async deleteResource(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async saveTracesAsSpans(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in TracesDrizzle');
  }

  async saveThreadEval(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async saveRunWorkflowSnapshot(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async getWorkflowSnapshots(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async updateRunWorkflowSnapshotStatus(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async deleteWorkflowSnapshot(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async listWorkflowSnapshots(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async getEvaluations(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in LegacyEvalsDrizzle');
  }

  async deleteThread(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async getMessages(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async getTraces(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in TracesDrizzle');
  }

  async getTracesPaginated(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in TracesDrizzle');
  }

  async getTrace(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in TracesDrizzle');
  }

  async saveTraces(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in TracesDrizzle');
  }

  async getAllThreadEvals(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getThreadEvals(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getEvalsByRunId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getWorkflowRuns(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async getWorkflowRun(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async updateWorkflowRun(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async getToolCalls(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ObservabilityDrizzle');
  }

  async saveAISpans(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ObservabilityDrizzle');
  }

  async getAISpans(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ObservabilityDrizzle');
  }

  async getLatestAISpans(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ObservabilityDrizzle');
  }

  async updateWorkflowResults(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async updateWorkflowState(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async getScoreById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async saveScore(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getScoresInPeriod(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getScoresByTargetId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getScores(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getAllScores(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async updateScore(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async deleteScore(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getToolCallsBySpanId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ObservabilityDrizzle');
  }

  async getDistinctTargets(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getScoresByScorerId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getScoresByRunId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getScoresByEntityId(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in ScoresDrizzle');
  }

  async getEvals(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in LegacyEvalsDrizzle');
  }

  async saveEval(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in LegacyEvalsDrizzle');
  }

  async getEvalById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in LegacyEvalsDrizzle');
  }

  async updateEval(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in LegacyEvalsDrizzle');
  }

  async deleteEval(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in LegacyEvalsDrizzle');
  }

  async getEvalsByAgentName(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in LegacyEvalsDrizzle');
  }

  async getWorkflowRunById(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in WorkflowsDrizzle');
  }

  async getThreadsByResourceIdPaginated(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  async getMessagesPaginated(...args: any[]): Promise<any> {
    void args;
    throw new Error('Not implemented yet - will be in MemoryDrizzle');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Get the raw Drizzle database instance
   */
  getDb(): any {
    this.ensureConnected();
    return this.dialect!.getDb();
  }

  /**
   * Get the current dialect instance
   */
  getDialect(): BaseDialect | undefined {
    return this.dialect;
  }

  /**
   * Get all schema definitions
   */
  getSchemas(): any {
    this.ensureConnected();
    return this.dialect!.getSchemas();
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    this.ensureConnected();
    return await this.dialect!.transaction(callback);
  }

  /**
   * Execute raw SQL query
   */
  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    this.ensureConnected();
    const result = await this.dialect!.query<T>(sql, params);
    return result.rows;
  }

  /**
   * Ensure database is connected
   */
  private ensureConnected(): void {
    if (!this.dialect || !this.dialect.isConnected()) {
      throw new Error('DrizzleStore is not connected. Call init() first.');
    }
  }

  /**
   * Get feature support flags
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
      transactions: true,
      rawQueries: true,
      multiDialect: true,
    };
  }
}
