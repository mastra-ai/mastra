import type { FactoryApprovalRecord, WorkItemRow } from '../storage/domains/work-items/base.js';

const MAX_PENDING_APPROVALS = 50;

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
  now: Date = new Date(),
): FactorySupervisorState {
  const byBoard: Record<string, number> = {};
  const byStage: Record<string, number> = {};
  const itemTitles = new Map(items.map(item => [item.id, item.title]));
  for (const item of items) {
    const board = item.externalSource?.type === 'pull-request' ? 'review' : 'work';
    byBoard[board] = (byBoard[board] ?? 0) + 1;
    const stage = item.stages.at(-1);
    if (stage) byStage[stage] = (byStage[stage] ?? 0) + 1;
  }
  return {
    factoryProjectId,
    totalItems: items.length,
    counts: { byBoard, byStage },
    pendingApprovalCount: pendingApprovals.length,
    pendingApprovals: pendingApprovals
      .slice(0, MAX_PENDING_APPROVALS)
      .map(approval => supervisorApprovalSummary(approval, itemTitles.get(approval.workItemId) ?? null, now)),
    snapshotAt: now.toISOString(),
  };
}
