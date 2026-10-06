import { randomUUID } from 'node:crypto';
import type { StepResult, WorkflowRunState, WorkflowSleepTimer } from '../../../workflows';
import type { UpdateWorkflowStateOptions, WorkflowRun, WorkflowRuns, StorageListWorkflowRunsInput } from '../../types';
import { StorageDomain } from '../base';

export interface StoredWorkflowTimer extends WorkflowSleepTimer {
  workflowId: string;
  runId: string;
}

export abstract class WorkflowsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'WORKFLOWS',
    });
  }

  abstract supportsConcurrentUpdates(): boolean;

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
    opts: UpdateWorkflowStateOptions;
  }): Promise<WorkflowRunState | undefined>;

  abstract persistWorkflowSnapshot(_: {
    workflowName: string;
    runId: string;
    resourceId?: string;
    snapshot: WorkflowRunState;
    createdAt?: Date;
    updatedAt?: Date;
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

  abstract deleteWorkflowRunById(args: { runId: string; workflowName: string }): Promise<void>;

  async listDueWorkflowTimers({ dueAt, limit }: { dueAt: number; limit: number }): Promise<StoredWorkflowTimer[]> {
    const timers: StoredWorkflowTimer[] = [];
    const perPage = Math.max(limit, 1);
    let page = 0;

    while (timers.length < limit) {
      const result = await this.listWorkflowRuns({ status: 'running', page, perPage });
      for (const run of result.runs) {
        const snapshot = await this.loadWorkflowSnapshot({ workflowName: run.workflowName, runId: run.runId });
        for (const timer of Object.values(snapshot?.sleepTimers ?? {})) {
          if (timer.dueAt <= dueAt) {
            timers.push({ ...timer, workflowId: run.workflowName, runId: run.runId });
            if (timers.length === limit) return timers;
          }
        }
      }
      if ((page + 1) * perPage >= result.total || result.runs.length === 0) break;
      page += 1;
    }

    return timers;
  }

  async claimWorkflowTimer({
    workflowId,
    runId,
    timerId,
    now,
    leaseDuration,
  }: {
    workflowId: string;
    runId: string;
    timerId: string;
    now: number;
    leaseDuration: number;
  }): Promise<(StoredWorkflowTimer & { claimToken: string }) | undefined> {
    const snapshot = await this.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    const timer = snapshot?.sleepTimers?.[timerId];
    if (!snapshot || !timer) return;
    if (timer.status === 'claimed' && (timer.claimedAt ?? 0) + leaseDuration > now) return;

    const claimToken = randomUUID();
    const updated = await this.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        status: snapshot.status,
        sleepTimers: {
          ...snapshot.sleepTimers,
          [timerId]: { ...timer, status: 'claimed', claimToken, claimedAt: now },
        },
        expectedStatus: snapshot.status,
        expectedSleepTimer: { id: timerId, status: timer.status, claimToken: timer.claimToken },
      },
    });
    if (!updated) return;
    return { ...timer, workflowId, runId, status: 'claimed', claimToken, claimedAt: now };
  }

  async completeWorkflowTimer({
    workflowId,
    runId,
    timerId,
    claimToken,
  }: {
    workflowId: string;
    runId: string;
    timerId: string;
    claimToken: string;
  }): Promise<boolean> {
    const snapshot = await this.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    if (!snapshot?.sleepTimers?.[timerId]) return false;
    const sleepTimers = { ...snapshot.sleepTimers };
    delete sleepTimers[timerId];
    return Boolean(
      await this.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: snapshot.status,
          sleepTimers,
          expectedStatus: snapshot.status,
          expectedSleepTimer: { id: timerId, status: 'claimed', claimToken },
        },
      }),
    );
  }

  async releaseWorkflowTimer({
    workflowId,
    runId,
    timerId,
    claimToken,
  }: {
    workflowId: string;
    runId: string;
    timerId: string;
    claimToken: string;
  }): Promise<boolean> {
    const snapshot = await this.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    const timer = snapshot?.sleepTimers?.[timerId];
    if (!snapshot || !timer) return false;
    return Boolean(
      await this.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: snapshot.status,
          sleepTimers: {
            ...snapshot.sleepTimers,
            [timerId]: { ...timer, status: 'pending', claimToken: undefined, claimedAt: undefined },
          },
          expectedStatus: snapshot.status,
          expectedSleepTimer: { id: timerId, status: 'claimed', claimToken },
        },
      }),
    );
  }
}
