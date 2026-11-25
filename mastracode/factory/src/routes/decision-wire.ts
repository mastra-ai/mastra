import type { BoardRegistry } from '../boards/index.js';
import { decisionRetryable } from '../rules/decision-applicability.js';
import type { WorkItemSource } from '../rules/types.js';
import type { FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';
import { factoryDecisionType } from './attention.js';

export function encodeDecisionCursor(decision: FactoryDeferredDecisionRecord): string {
  return Buffer.from(JSON.stringify([decision.createdAt.toISOString(), decision.id]), 'utf8').toString('base64url');
}

/** A proposed transition names the seat its lane addresses, so the card can label what approving starts. */
function summaryRole(boards: BoardRegistry, decision: Record<string, unknown>): string | null {
  if (typeof decision.role === 'string') return decision.role.slice(0, 32);
  if (decision.type !== 'transition') return null;
  const { board, stage } = decision;
  if (typeof board !== 'string' || typeof stage !== 'string') return null;
  return boards.get(board)?.roleForPhase(stage) ?? null;
}

/** A linked-card decision names where the card is synced from, so the UI can say "GitHub" rather than "a linked card". */
function summarySource(decision: Record<string, unknown>): WorkItemSource | null {
  if (decision.type !== 'upsertLinkedWorkItem') return null;
  const source = decision.source;
  return source === 'github-issue' ||
    source === 'github-pr' ||
    source === 'gitlab-issue' ||
    source === 'gitlab-pr' ||
    source === 'linear-issue' ||
    source === 'manual'
    ? source
    : null;
}

export function decisionSummary(boards: BoardRegistry, decision: FactoryDeferredDecisionRecord, overtaken = false) {
  return {
    id: decision.id,
    evaluationId: decision.evaluationId,
    workItemId: decision.workItemId,
    type: factoryDecisionType(decision),
    role: summaryRole(boards, decision.decision),
    source: summarySource(decision.decision),
    status: decision.status,
    attempts: decision.attempts,
    failureOccurrence: decision.failureOccurrence,
    failureCode: decision.failureCode,
    canRetry: decisionRetryable(decision, overtaken),
    lastError: decision.lastError?.slice(0, 512) ?? null,
    createdAt: decision.createdAt.toISOString(),
    updatedAt: decision.updatedAt.toISOString(),
    completedAt: decision.completedAt?.toISOString() ?? null,
  };
}
