import type { FactoryApprovalRecord, WorkItemRow } from '../storage/domains/work-items/base.js';

const MAX_PENDING_APPROVALS = 50;
const MAX_WORKERS = 100;

/**
 * Live activity of one active run binding: `running` means the bound session
 * has a run in flight right now; `idle` means it does not — whether the
 * session is loaded between runs or has to be rehydrated on the next signal
 * is a server implementation detail the supervisor never needs to reason
 * about, so both report as `idle`.
 */
export type FactorySupervisorWorkerActivity = 'running' | 'idle';

export interface FactorySupervisorWorkerBinding {
  workItemId: string;
  role: string;
  bindingId: string;
  activity: FactorySupervisorWorkerActivity;
}

export interface FactorySupervisorWorkerSummary extends FactorySupervisorWorkerBinding {
  workItemTitle: string | null;
  stage: string | null;
}

export interface FactorySupervisorApprovalSummary {
  id: string;
  workItemId: string;
  board: string;
  stage: string;
  expectedRevision: number;
  requestingRole: string | null;
  workItemTitle: string | null;
  reason: string;
  summary: string | null;
  createdAt: string;
  ageSeconds: number;
}

export interface FactorySupervisorState {
  factoryProjectId: string;
  totalItems: number;
  counts: {
    byBoard: Record<string, number>;
    byStage: Record<string, number>;
  };
  pendingApprovalCount: number;
  pendingApprovals: FactorySupervisorApprovalSummary[];
  workers: {
    running: number;
    idle: number;
    bindings: FactorySupervisorWorkerSummary[];
  };
  snapshotAt: string;
}

export function supervisorApprovalSummary(
  approval: FactoryApprovalRecord,
  workItemTitle: string | null = null,
  now: Date = new Date(),
): FactorySupervisorApprovalSummary {
  return {
    id: approval.id,
    workItemId: approval.workItemId,
    board: approval.requestedBoard,
    stage: approval.requestedStage,
    expectedRevision: approval.expectedRevision,
    requestingRole:
      typeof approval.requestingActor.role === 'string' ? approval.requestingActor.role.slice(0, 64) : null,
    workItemTitle,
    reason: approval.reason.slice(0, 1_000),
    summary: approval.summary?.slice(0, 1_000) ?? null,
    createdAt: approval.createdAt.toISOString(),
    ageSeconds: Math.max(0, Math.floor((now.getTime() - approval.createdAt.getTime()) / 1_000)),
  };
}

export function buildFactorySupervisorState(
  factoryProjectId: string,
  items: WorkItemRow[],
  pendingApprovals: FactoryApprovalRecord[],
  workerBindings: FactorySupervisorWorkerBinding[] = [],
  now: Date = new Date(),
): FactorySupervisorState {
  const byBoard: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const itemsById = new Map(items.map(item => [item.id, item]));
  const itemTitles = new Map(items.map(item => [item.id, item.title]));
  for (const item of items) {
    const board = item.externalSource?.type === 'pull-request' ? 'review' : 'work';
    byBoard[board] = (byBoard[board] ?? 0) + 1;
    const stage = item.stages.at(-1);
    if (stage) byStage[stage] = (byStage[stage] ?? 0) + 1;
  }
  const workers = {
    running: workerBindings.filter(worker => worker.activity === 'running').length,
    idle: workerBindings.filter(worker => worker.activity === 'idle').length,
    bindings: workerBindings.slice(0, MAX_WORKERS).map(worker => ({
      ...worker,
      workItemTitle: itemsById.get(worker.workItemId)?.title ?? null,
      stage: itemsById.get(worker.workItemId)?.stages.at(-1) ?? null,
    })),
  };
  return {
    factoryProjectId,
    totalItems: items.length,
    counts: { byBoard, byStage },
    pendingApprovalCount: pendingApprovals.length,
    pendingApprovals: pendingApprovals
      .slice(0, MAX_PENDING_APPROVALS)
      .map(approval => supervisorApprovalSummary(approval, itemTitles.get(approval.workItemId) ?? null, now)),
    workers,
    snapshotAt: now.toISOString(),
  };
}
