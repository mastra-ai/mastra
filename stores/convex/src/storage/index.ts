import type { SaveScorePayload, ScoreRowData, ScoringEntityType, ScoringSource } from '@mastra/core/evals';
import type { MastraDBMessage, StorageThreadType } from '@mastra/core/memory';
import type {
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
  UpdateWorkflowStateOptions,
} from '@mastra/core/storage';
import { MastraStorage } from '@mastra/core/storage';
import type { StepResult, WorkflowRunState } from '@mastra/core/workflows';

import type { ConvexAdminClientConfig } from './client';
import { ConvexAdminClient } from './client';
import { MemoryConvex } from './domains/memory';
import { ScoresConvex } from './domains/scores';
import { WorkflowsConvex } from './domains/workflows';

/**
 * Convex configuration type.
 *
 * Accepts either:
 * - A pre-configured ConvexAdminClient: `{ id, client }`
 * - Deployment config: `{ id, deploymentUrl, adminAuthToken, storageFunction? }`
 */
export type ConvexStoreConfig = {
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
} & (
  | {
      /**
       * Pre-configured ConvexAdminClient.
       * Use this when you need to configure the client before initialization.
       *
       * @example
       * ```typescript
       * import { ConvexAdminClient } from '@mastra/convex/storage/client';
       *
       * const client = new ConvexAdminClient({
       *   deploymentUrl: 'https://your-deployment.convex.cloud',
       *   adminAuthToken: 'your-token',
       *   storageFunction: 'custom/storage:handle',
       * });
       *
       * const store = new ConvexStore({ id: 'my-store', client });
       * ```
       */
      client: ConvexAdminClient;
    }
  | ConvexAdminClientConfig
);

/**
 * Type guard for pre-configured client config
 */
const isClientConfig = (config: ConvexStoreConfig): config is ConvexStoreConfig & { client: ConvexAdminClient } => {
  return 'client' in config;
};

export class ConvexStore extends MastraStorage {
  private readonly memory: MemoryConvex;
  private readonly workflows: WorkflowsConvex;
  private readonly scores: ScoresConvex;

  constructor(config: ConvexStoreConfig) {
    super({ id: config.id, name: config.name ?? 'ConvexStore', disableInit: config.disableInit });

    // Handle pre-configured client vs creating new one
    const client = isClientConfig(config) ? config.client : new ConvexAdminClient(config);

    const domainConfig = { client };
    this.memory = new MemoryConvex(domainConfig);
    this.workflows = new WorkflowsConvex(domainConfig);
    this.scores = new ScoresConvex(domainConfig);

    this.stores = {
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
