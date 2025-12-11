import type { MastraDBMessage } from '../agent';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '../evals/types';
import type { StorageThreadType } from '../memory/types';
import type { StepResult, WorkflowRunState } from '../workflows/types';
import { MastraStorage } from './base';
import type { StorageDomains } from './base';
import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  GetTraceResponse,
  UpdateSpanArgs,
  CreateSpanArgs,
  GetTraceArgs,
} from './domains';
import { InMemoryAgentsStorage } from './domains/agents/inmemory';
import { InMemoryDB } from './domains/inmemory-db';
import { InMemoryMemory } from './domains/memory/inmemory';
import { ObservabilityInMemory } from './domains/observability/inmemory';
import { ScoresInMemory } from './domains/scores/inmemory';
import { WorkflowsInMemory } from './domains/workflows/inmemory';

import type {
  StoragePagination,
  StorageResourceType,
  UpdateWorkflowStateOptions,
  WorkflowRun,
  StorageSupports,
} from './types';

export class InMemoryStore extends MastraStorage {
  stores: StorageDomains;

  /**
   * Internal database layer shared across all domains.
   * This is an implementation detail - domains interact with this
   * rather than managing their own data structures.
   */
  #db: InMemoryDB;

  constructor({ id = 'in-memory' }: { id?: string } = {}) {
    super({ id, name: 'InMemoryStorage' });
    // InMemoryStore doesn't need async initialization
    this.hasInitialized = Promise.resolve(true);

    // Create internal db layer - shared across all domains
    this.#db = new InMemoryDB();

    // Create all domain instances with the shared db
    this.stores = {
      memory: new InMemoryMemory({ db: this.#db }),
      workflows: new WorkflowsInMemory({ db: this.#db }),
      scores: new ScoresInMemory({ db: this.#db }),
      observability: new ObservabilityInMemory({ db: this.#db }),
      agents: new InMemoryAgentsStorage({ db: this.#db }),
    };
  }

  public get supports(): StorageSupports {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: true,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      observability: true,
      indexManagement: false,
      listScoresBySpan: true,
      agents: true,
    };
  }

  /**
   * Clears all data from the in-memory database.
   * Useful for testing.
   * @deprecated Use dangerouslyClearAll() on individual domains instead.
   */
  clear(): void {
    this.#db.clear();
  }

  async persistWorkflowSnapshot({
    workflowName,
    runId,
    resourceId,
    snapshot,
    createdAt,
    updatedAt,
  }: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<void> {
    await this.stores.workflows.persistWorkflowSnapshot({
      workflowName,
      runId,
      resourceId,
      snapshot,
      createdAt,
      updatedAt,
    });
  }

  async loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.loadWorkflowSnapshot({ workflowName, runId });
  }

  async updateWorkflowResults({
    workflowName,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowName: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    return this.stores.workflows.updateWorkflowResults({ workflowName, runId, stepId, result, requestContext });
  }

  async updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined> {
    return this.stores.workflows.updateWorkflowState({ workflowName, runId, opts });
  }
  async getThreadById({ threadId }: { threadId: string }): Promise<StorageThreadType | null> {
    return this.stores.memory.getThreadById({ threadId });
  }

  async saveThread({ thread }: { thread: StorageThreadType }): Promise<StorageThreadType> {
    return this.stores.memory.saveThread({ thread });
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
    return this.stores.memory.updateThread({ id, title, metadata });
  }

  async deleteThread({ threadId }: { threadId: string }): Promise<void> {
    return this.stores.memory.deleteThread({ threadId });
  }

  async getResourceById({ resourceId }: { resourceId: string }): Promise<StorageResourceType | null> {
    return this.stores.memory.getResourceById({ resourceId });
  }

  async saveResource({ resource }: { resource: StorageResourceType }): Promise<StorageResourceType> {
    return this.stores.memory.saveResource({ resource });
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
    return this.stores.memory.updateResource({ resourceId, workingMemory, metadata });
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.listMessagesById({ messageIds });
  }

  async saveMessages(args: { messages: MastraDBMessage[] }): Promise<{ messages: MastraDBMessage[] }> {
    return this.stores.memory.saveMessages(args);
  }

  async updateMessages(args: { messages: (Partial<MastraDBMessage> & { id: string })[] }): Promise<MastraDBMessage[]> {
    return this.stores.memory.updateMessages(args);
  }

  async deleteMessages(messageIds: string[]): Promise<void> {
    return this.stores.memory.deleteMessages(messageIds);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    return this.stores.scores.getScoreById({ id });
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    return this.stores.scores.saveScore(score);
  }

  async listScoresByScorerId({
    scorerId,
    entityId,
    entityType,
    source,
    pagination,
  }: {
    scorerId: string;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    return this.stores.scores.listScoresByScorerId({ scorerId, entityId, entityType, source, pagination });
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    return this.stores.scores.listScoresByRunId({ runId, pagination });
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    return this.stores.scores.listScoresByEntityId({ entityId, entityType, pagination });
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    return this.stores.scores.listScoresBySpan({ traceId, spanId, pagination });
  }

  async getWorkflowRunById({
    runId,
    workflowName,
  }: {
    runId: string;
    workflowName?: string;
  }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById({ runId, workflowName });
  }

  async deleteWorkflowRunById({ runId, workflowName }: { runId: string; workflowName: string }): Promise<void> {
    return this.stores.workflows.deleteWorkflowRunById({ runId, workflowName });
  }

  async createSpan(args: CreateSpanArgs): Promise<void> {
    return this.stores.observability!.createSpan(args);
  }

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    return this.stores.observability!.updateSpan(args);
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    return this.stores.observability!.getTrace(args);
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    return this.stores.observability!.batchCreateSpans(args);
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    return this.stores.observability!.batchUpdateSpans(args);
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    return this.stores.observability!.batchDeleteTraces(args);
  }
}

export const MockStore = InMemoryStore;
