import type { MastraDBMessage } from '../agent';
import type { StorageThreadType } from '../memory/types';
import type { StepResult, WorkflowRunState } from '../workflows/types';
import { MastraStorage } from './base';
import type { StorageDomains } from './base';
import { EvalsStorage } from './domains/evals/inmemory';
import { MemoryStorage } from './domains/memory/inmemory';
import { ObservabilityStorage } from './domains/observability/inmemory';
import { WorkflowsStorage } from './domains/workflows/inmemory';

import type {
  SpanRecord,
  TraceRecord,
  StorageResourceType,
  WorkflowRun,
} from './types';

export class InMemoryStore extends MastraStorage {
  stores: StorageDomains;

  constructor({ id = 'in-memory' }: { id?: string } = {}) {
    super({ id, name: 'InMemoryStorage' });
    // MockStore doesn't need async initialization
    this.hasInitialized = Promise.resolve(true);

    const evalsStorage = new EvalsStorage();

    const workflowsStorage = new WorkflowsStorage();

    const memoryStorage = new MemoryStorage();

    const observabilityStorage = new ObservabilityStorage();

    this.stores = {
      workflows: workflowsStorage,
      evals: evalsStorage,
      memory: memoryStorage,
      observability: observabilityStorage,
    };
  }

  public get supports() {
    return {
      selectByIncludeResourceScope: false,
      resourceWorkingMemory: false,
      hasColumn: false,
      createTable: false,
      deleteMessages: true,
      observabilityInstance: true,
      indexManagement: false,
      listScoresBySpan: true,
    };
  }

  async getWorkflowSnapshot({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null> {
    return this.stores.workflows.getWorkflowSnapshot({ workflowId, runId });
  }

  async updateWorkflowResults({
    workflowId,
    runId,
    stepId,
    result,
    requestContext,
  }: {
    workflowId: string;
    runId: string;
    stepId: string;
    result: StepResult<any, any, any, any>;
    requestContext: Record<string, any>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    return this.stores.workflows.updateWorkflowResults({ workflowId, runId, stepId, result, requestContext });
  }

  async updateWorkflowState({
    workflowId,
    runId,
    opts,
  }: {
    workflowId: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined> {
    return this.stores.workflows.updateWorkflowState({ workflowId, runId, opts });
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

  async getWorkflowRunById({ runId, workflowId }: { runId: string; workflowId?: string }): Promise<WorkflowRun | null> {
    return this.stores.workflows.getWorkflowRunById({ runId, workflowId });
  }

  async createSpan(span: SpanRecord): Promise<void> {
    return this.stores.observability!.createSpan(span);
  }

  async updateSpan(params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    return this.stores.observability!.updateSpan(params);
  }

  async getTrace(traceId: string): Promise<TraceRecord | null> {
    return this.stores.observability!.getTrace(traceId);
  }

  async batchCreateSpans(args: { records: SpanRecord[] }): Promise<void> {
    return this.stores.observability!.batchCreateSpans(args);
  }

  async batchUpdateSpans(args: {
    records: { traceId: string; spanId: string; updates: Partial<Omit<SpanRecord, 'spanId' | 'traceId'>> }[];
  }): Promise<void> {
    return this.stores.observability!.batchUpdateSpans(args);
  }

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    return this.stores.observability!.batchDeleteTraces(args);
  }
}
