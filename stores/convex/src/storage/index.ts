import type { SaveScorePayload, ScoreRowData, ScoringEntityType, ScoringSource } from '@mastra/core/evals';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
  StorageColumn,
  StorageResourceType,
  PaginationInfo,
  StorageListMessagesInput,
  StorageListMessagesOutput,
  StorageListThreadsByResourceIdInput,
  StorageListThreadsByResourceIdOutput,
  StorageListWorkflowRunsInput,
  StoragePagination,
  WorkflowRun,
  WorkflowRuns,
  TABLE_NAMES,
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import { MastraStorage } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';

import type { ConvexAdminClientConfig } from './client';
import { ConvexAdminClient } from './client';
import { MemoryConvex } from './domains/memory';
import { ScoresConvex } from './domains/scores';
import { WorkflowsConvex } from './domains/workflows';
import { StoreOperationsConvex } from './operations';

export type ConvexStoreConfig = ConvexAdminClientConfig & {
  id: string;
  name?: string;
  /**
   * When true, automatic initialization (table creation/migrations) is disabled.
   * This is useful for CI/CD pipelines where you want to:
   * 1. Run migrations explicitly during deployment (not at runtime)
   * 2. Use different credentials for schema changes vs runtime operations
   *
   * When disableInit is true:
   * - The storage will not automatically create/alter tables on first use
   * - You must call `storage.init()` explicitly in your CI/CD scripts
   *
   * @example
   * // In CI/CD script:
   * const storage = new ConvexStore({ ...config, disableInit: false });
   * await storage.init(); // Explicitly run migrations
   *
   * // In runtime application:
   * const storage = new ConvexStore({ ...config, disableInit: true });
   * // No auto-init, tables must already exist
   */
  disableInit?: boolean;
};

export class ConvexStore extends MastraStorage {
  private readonly operations: StoreOperationsConvex;
  private readonly memory: MemoryConvex;
  private readonly workflows: WorkflowsConvex;
  private readonly scores: ScoresConvex;

  constructor(config: ConvexStoreConfig) {
    super({ id: config.id, name: config.name ?? 'ConvexStore', disableInit: config.disableInit });

    const client = new ConvexAdminClient(config);
    this.operations = new StoreOperationsConvex(client);
    this.memory = new MemoryConvex(this.operations);
    this.workflows = new WorkflowsConvex(this.operations);
    this.scores = new ScoresConvex(this.operations);

    this.stores = {
      operations: this.operations,
      memory: this.memory,
      workflows: this.workflows,
      scores: this.scores,
    };
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: true,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      observabilityInstance: false,
      listScoresBySpan: false,
    };
  }

  async createTable(_args: { tableName: TABLE_NAMES; schema: Record<string, StorageColumn> }): Promise<void> {
    // No-op
  }

  async clearTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.operations.clearTable({ tableName });
  }

  async dropTable({ tableName }: { tableName: TABLE_NAMES }): Promise<void> {
    await this.operations.dropTable({ tableName });
  }

  async alterTable(_args: {
    tableName: TABLE_NAMES;
    schema: Record<string, StorageColumn>;
    ifNotExists: string[];
  }): Promise<void> {
    // No-op
  }

  async insert({ tableName, record }: { tableName: TABLE_NAMES; record: Record<string, any> }): Promise<void> {
    await this.operations.insert({ tableName, record });
  }

  async batchInsert({ tableName, records }: { tableName: TABLE_NAMES; records: Record<string, any>[] }): Promise<void> {
    await this.operations.batchInsert({ tableName, records });
  }

  async load<R>({ tableName, keys }: { tableName: TABLE_NAMES; keys: Record<string, any> }): Promise<R | null> {
    return this.operations.load<R>({ tableName, keys });
  }

  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.memory.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    return this.memory.saveThread({ thread });
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
    return this.memory.updateThread({ id, title, metadata });
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    await this.memory.deleteThread({ threadId });
  }

  async listMessages(args: StorageListMessagesInput): Promise<StorageListMessagesOutput> {
    return this.memory.listMessages(args);
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.memory.listMessagesById({ messageIds });
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.memory.saveMessages(args);
  }

  async updateMessages({
    messages,
  }: {
    messages: (Partial<Omit<MastraDBMessage, 'createdAt'>> & {
      id: string;
    })[];
  }): Promise<MastraDBMessage[]> {
    return this.memory.updateMessages({ messages });
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    await this.memory.deleteMessages(messageIds);
  }

  async listThreadsByResourceId(
    args: StorageListThreadsByResourceIdInput,
  ): Promise<StorageListThreadsByResourceIdOutput> {
    return this.memory.listThreadsByResourceId(args);
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    return this.memory.getResourceById({ resourceId });
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    return this.memory.saveResource({ resource });
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
    return this.memory.updateResource({ resourceId, workingMemory, metadata });
  }

  async updateWorkflowResults(params: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    return this.workflows.updateWorkflowResults(params);
  }

  async updateWorkflowState(params: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    return this.workflows.updateWorkflowState(params);
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string | undefined;
    snapshot: WorkflowRunState;
  }): Promise<void> {
    await this.workflows.persistWorkflowSnapshot({ workflowName, runId, resourceId, snapshot });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.workflows.loadWorkflowSnapshot({ workflowName, runId });
  }

  async listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns> {
    return this.workflows.listWorkflowRuns(args);
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string | undefined;
  }): Promise<WorkflowRun | null> {
    return this.workflows.getWorkflowRunById({ runId, workflowName });
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    return this.workflows.deleteWorkflowRunById({ runId, workflowName });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.scores.getScoreById({ id });
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    return this.scores.saveScore(score);
  }

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string | undefined;
    entityType?: ScoringEntityType | undefined;
    source?: ScoringSource | undefined;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.scores.listScoresByScorerId({ scorerId, pagination, entityId, entityType, source });
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.scores.listScoresByRunId({ runId, pagination });
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: ScoringEntityType;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    return this.scores.listScoresByEntityId({ entityId, entityType, pagination });
  }
}
