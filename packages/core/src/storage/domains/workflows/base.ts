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

  async persistWorkflowTimer({
    workflowId,
    runId,
    timer,
  }: {
    workflowId: string;
    runId: string;
    timer: WorkflowSleepTimer;
  }): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const snapshot = await this.loadWorkflowSnapshot({ workflowName: workflowId, runId });
      if (!snapshot) throw new Error(`Workflow snapshot not found for runId ${runId}`);

      const expectedSleepTimers = snapshot.sleepTimers ?? {};
      const updated = await this.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: snapshot.status,
          sleepTimers: { ...expectedSleepTimers, [timer.id]: timer },
          expectedStatus: snapshot.status,
          expectedSleepTimers,
        },
      });
      if (updated) return;
    }

    throw new Error(`Failed to persist workflow sleep timer ${timer.id} for runId ${runId}`);
  }

  async listDueWorkflowTimers({
    dueAt,
    limit,
    page,
  }: {
    dueAt: number;
    limit: number;
    page: number;
  }): Promise<{ timers: StoredWorkflowTimer[]; nextPage: number }> {
    const timers: StoredWorkflowTimer[] = [];
    const perPage = Math.max(limit, 1);
    const result = await this.listWorkflowRuns({ status: 'running', page, perPage });

    for (const run of result.runs) {
      const snapshot = await this.loadWorkflowSnapshot({ workflowName: run.workflowName, runId: run.runId });
      for (const timer of Object.values(snapshot?.sleepTimers ?? {})) {
        if (timer.dueAt <= dueAt) {
          timers.push({ ...timer, workflowId: run.workflowName, runId: run.runId });
          if (timers.length === limit) break;
        }
      }
      if (timers.length === limit) break;
    }

    const nextPage = result.runs.length > 0 && (page + 1) * perPage < result.total ? page + 1 : 0;
    return { timers, nextPage };
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
        expectedSleepTimers: snapshot.sleepTimers ?? {},
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
          expectedSleepTimers: snapshot.sleepTimers ?? {},
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
          expectedSleepTimers: snapshot.sleepTimers ?? {},
        },
      }),
    );
  }
}
