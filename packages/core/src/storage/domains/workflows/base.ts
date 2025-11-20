import { MastraBase } from '../../../base';
import type { StepResult, WorkflowRunState } from '../../../workflows';
import type { WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '../../types';

export abstract class WorkflowsStorage extends MastraBase {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  /**
   * Optional: Acquire a distributed lock for a workflow run to prevent
   * concurrent execution across multiple app instances.
   *
   * Default implementation is a no-op that returns true. Storage backends
   * that support locking (e.g., Postgres advisory locks) should override.
   */
  async tryAcquireRunLock(_args: { workflowName: string; runId: string }): Promise<boolean> {
    return true;
  }

  /**
   * Optional: Release a previously acquired lock. Default is a no-op.
   */
  async releaseRunLock(_args: { workflowName: string; runId: string }): Promise<void> {
    return;
  }

  /**
   * Optional: Renew/heartbeat a lock extending its expiry. Default is a no-op
   * that returns true. Backends without TTL can update metadata for observability.
   */
  async renewRunLock(_args: { workflowName: string; runId: string; ttlMs?: number }): Promise<boolean> {
    return true;
  }

  /**
   * Optional: Get lock info for debugging/observability. Default is null.
   */
  async getRunLock(_args: { workflowName: string; runId: string }): Promise<{
    holder?: string;
    expiresAt?: number;
    backend?: string;
  } | null> {
    return null;
  }

  abstract updateWorkflowResults({
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
  }): Promise<Record<string, StepResult<any, any, any, any>>>;

  abstract updateWorkflowState({
    workflowName,
    runId,
    opts,
  }: {
    workflowName: string;
    runId: string;
    opts: {
      status: string;
      result?: StepResult<any, any, any, any>;
      error?: string;
      suspendedPaths?: Record<string, number[]>;
      waitingPaths?: Record<string, number[]>;
    };
  }): Promise<WorkflowRunState | undefined>;

  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
  }): Promise<void>;

  abstract loadWorkflowSnapshot({
    workflowName,
    runId,
  }: {
    workflowName: string;
    runId: string;
  }): Promise<WorkflowRunState | null>;

  abstract listWorkflowRuns(args?: StorageListWorkflowRunsInput): Promise<WorkflowRuns>;

  abstract getWorkflowRunById(args: { runId: string; workflowName?: string }): Promise<WorkflowRun | null>;
}
