/**
 * Deterministic Factory health check.
 *
 * Every finding is computed from storage rows alone — no model, no controller —
 * so the supervisor agent explains findings rather than inventing them, and the
 * same list can be rendered by the UI or polled by a timer. Each finding names
 * the row it came from and the standard repair a person (or the supervisor's
 * write tools) would apply.
 */

import { NEEDS_APPROVAL_LABEL } from '../integrations/github/acceptance-labels.js';
import { FACTORY_ROLE_STAGES, factoryRuleStage, isTerminalFactoryRuleStage } from '../rules/types.js';
import type {
  FactoryDeferredDecisionRecord,
  FactoryPendingStartRecord,
  FactoryRunBindingRecord,
  WorkItemRow,
  WorkItemsStorage,
} from '../storage/domains/work-items/base.js';

export type FactoryHealthFindingKind =
  | 'decision-failed'
  | 'decision-stuck'
  | 'start-stalled'
  | 'seat-orphaned'
  | 'seat-missing'
  | 'proposal-waiting'
  | 'held-waiting'
  | 'label-drift';

export type FactoryHealthRepair =
  | { action: 'retry-decision'; decisionId: string }
  | { action: 'dismiss-decision'; decisionId: string }
  | { action: 'resolve-proposal'; decisionId: string }
  | { action: 'revoke-binding'; bindingId: string }
  | { action: 'accept-work-item'; workItemId: string }
  | { action: 'start-run'; workItemId: string; role: string }
  | { action: 'reconcile-labels'; workItemId: string };

export interface FactoryHealthFinding {
  kind: FactoryHealthFindingKind;
  /** Stable per (kind, subject) so the UI and attention inbox can dedupe. */
  id: string;
  workItemId: string | null;
  /** Card number as shown on the board, when the row carries one. */
  workItemNumber: number | null;
  title: string;
  /** One sentence of grounded evidence: ids, timestamps, error text. */
  evidence: string;
  /** How long the condition has held, in ms, when it is age-based. */
  ageMs: number | null;
  suggestedRepair: FactoryHealthRepair | null;
}

export interface FactoryHealthReport {
  checkedAt: string;
  findings: FactoryHealthFinding[];
  counts: Record<FactoryHealthFindingKind, number>;
}

export interface FactoryHealthThresholds {
  /** A retry/pending decision whose `availableAt` is this far in the past never got picked up. */
  stuckDecisionMs: number;
  /** A lease this far past its expiry belongs to a worker that died mid-dispatch. */
  expiredLeaseMs: number;
  /** A pending start this old is not "booting", it is stalled. */
  stalledStartMs: number;
  /** Proposals and held cards older than this are worth nudging a person about. */
  waitingOnPersonMs: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: FactoryHealthThresholds = {
  stuckDecisionMs: 10 * 60_000,
  expiredLeaseMs: 5 * 60_000,
  stalledStartMs: 10 * 60_000,
  waitingOnPersonMs: 24 * 60 * 60_000,
};

const FINDING_KINDS: FactoryHealthFindingKind[] = [
  'decision-failed',
  'decision-stuck',
  'start-stalled',
  'seat-orphaned',
  'seat-missing',
  'proposal-waiting',
  'held-waiting',
  'label-drift',
];

const IN_FLIGHT_DECISION_STATUSES = new Set(['pending', 'retry', 'leased', 'proposed']);

/** Working lane → the role whose seat carries a card through it. */
const ROLE_FOR_LANE = new Map<string, string>(Object.entries(FACTORY_ROLE_STAGES).map(([role, lane]) => [lane, role]));

function itemNumber(item: WorkItemRow | undefined): number | null {
  const number = item?.metadata?.number ?? item?.metadata?.githubIssueNumber ?? item?.metadata?.githubPullRequestNumber;
  return typeof number === 'number' ? number : null;
}

function itemLabels(item: WorkItemRow): string[] {
  const labels = item.metadata?.labels;
  return Array.isArray(labels) ? labels.filter((label): label is string => typeof label === 'string') : [];
}

function decisionType(decision: FactoryDeferredDecisionRecord): string {
  const type = decision.decision.type;
  return typeof type === 'string' ? type : 'decision';
}

function decisionRole(decision: FactoryDeferredDecisionRecord): string | null {
  const role = decision.decision.role;
  return typeof role === 'string' ? role : null;
}

function describeDecision(decision: FactoryDeferredDecisionRecord): string {
  const role = decisionRole(decision);
  return role ? `${decisionType(decision)} (${role})` : decisionType(decision);
}

function truncate(text: string, max = 200): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function stageEnteredAt(item: WorkItemRow): Date | null {
  const open = [...item.stageHistory].reverse().find(entry => !entry.exitedAt);
  const at = open ? Date.parse(open.enteredAt) : Number.NaN;
  return Number.isFinite(at) ? new Date(at) : null;
}

interface HealthInputs {
  items: WorkItemRow[];
  decisions: FactoryDeferredDecisionRecord[];
  bindings: FactoryRunBindingRecord[];
  pendingStarts: FactoryPendingStartRecord[];
}

/** Pure: findings from rows. Exported so tests can feed fixtures directly. */
export function computeFactoryHealth(
  inputs: HealthInputs,
  now: Date,
  thresholds: FactoryHealthThresholds = DEFAULT_HEALTH_THRESHOLDS,
): FactoryHealthReport {
  const itemsById = new Map(inputs.items.map(item => [item.id, item]));
  const findings: FactoryHealthFinding[] = [];
  const subject = (workItemId: string | null) => {
    const item = workItemId ? itemsById.get(workItemId) : undefined;
    return { workItemId, workItemNumber: itemNumber(item), title: item?.title ?? '' };
  };

  for (const decision of inputs.decisions) {
    const base = subject(decision.workItemId);
    if (decision.status === 'failed') {
      findings.push({
        kind: 'decision-failed',
        id: `decision-failed:${decision.id}`,
        ...base,
        evidence: `Decision ${decision.id} (${describeDecision(decision)}) failed after ${decision.attempts} attempt(s) at ${decision.updatedAt.toISOString()}${decision.failureCode ? ` [${decision.failureCode}]` : ''}: ${truncate(decision.lastError ?? 'no error recorded')}`,
        ageMs: now.getTime() - decision.updatedAt.getTime(),
        suggestedRepair: { action: 'retry-decision', decisionId: decision.id },
      });
      continue;
    }
    if (decision.status === 'retry' || decision.status === 'pending') {
      const overdue = now.getTime() - decision.availableAt.getTime();
      if (overdue > thresholds.stuckDecisionMs) {
        findings.push({
          kind: 'decision-stuck',
          id: `decision-stuck:${decision.id}`,
          ...base,
          evidence: `Decision ${decision.id} (${describeDecision(decision)}) has been ${decision.status} since ${decision.availableAt.toISOString()} with ${decision.attempts} attempt(s) and was never leased; is the dispatcher running?`,
          ageMs: overdue,
          suggestedRepair: null,
        });
      }
      continue;
    }
    if (decision.status === 'leased' && decision.leaseExpiresAt) {
      const expired = now.getTime() - decision.leaseExpiresAt.getTime();
      if (expired > thresholds.expiredLeaseMs) {
        findings.push({
          kind: 'decision-stuck',
          id: `decision-stuck:${decision.id}`,
          ...base,
          evidence: `Decision ${decision.id} (${describeDecision(decision)}) is still leased by ${decision.leaseOwner ?? 'unknown'} though the lease expired at ${decision.leaseExpiresAt.toISOString()}; the worker likely died mid-dispatch.`,
          ageMs: expired,
          suggestedRepair: null,
        });
      }
      continue;
    }
    if (decision.status === 'proposed') {
      const waiting = now.getTime() - decision.createdAt.getTime();
      if (waiting > thresholds.waitingOnPersonMs) {
        findings.push({
          kind: 'proposal-waiting',
          id: `proposal-waiting:${decision.id}`,
          ...base,
          evidence: `Proposed run ${decision.id} (${describeDecision(decision)}) has waited for a person since ${decision.createdAt.toISOString()}.`,
          ageMs: waiting,
          suggestedRepair: { action: 'resolve-proposal', decisionId: decision.id },
        });
      }
    }
  }

  const bindingsById = new Map(inputs.bindings.map(binding => [binding.id, binding]));
  for (const start of inputs.pendingStarts) {
    if (start.status === 'sent') continue;
    const binding = bindingsById.get(start.bindingId);
    const base = subject(binding?.workItemId ?? null);
    const age = now.getTime() - start.createdAt.getTime();
    if (start.status === 'failed' || age > thresholds.stalledStartMs) {
      findings.push({
        kind: 'start-stalled',
        id: `start-stalled:${start.id}`,
        ...base,
        evidence: `Pending start ${start.id}${binding ? ` for the ${binding.role} seat` : ''} is ${start.status} since ${start.createdAt.toISOString()} after ${start.attempts} attempt(s)${start.lastError ? `: ${truncate(start.lastError)}` : '.'}`,
        ageMs: age,
        suggestedRepair: binding ? { action: 'revoke-binding', bindingId: binding.id } : null,
      });
    }
  }

  const activeSeatsByItem = new Map<string, FactoryRunBindingRecord[]>();
  for (const binding of inputs.bindings) {
    if (binding.status !== 'active') continue;
    const item = itemsById.get(binding.workItemId);
    const stage = item ? factoryRuleStage(item.stages) : undefined;
    if (!item || !stage || isTerminalFactoryRuleStage([stage])) {
      findings.push({
        kind: 'seat-orphaned',
        id: `seat-orphaned:${binding.id}`,
        ...subject(item ? item.id : null),
        evidence: item
          ? `Binding ${binding.id} (${binding.role}) is still active though the card is in ${stage ?? item.stages.join('+')}.`
          : `Binding ${binding.id} (${binding.role}) is active for work item ${binding.workItemId}, which no longer exists.`,
        ageMs: now.getTime() - binding.createdAt.getTime(),
        suggestedRepair: { action: 'revoke-binding', bindingId: binding.id },
      });
      continue;
    }
    const seats = activeSeatsByItem.get(item.id) ?? [];
    seats.push(binding);
    activeSeatsByItem.set(item.id, seats);
  }

  const inFlightByItem = new Set(
    inputs.decisions.filter(d => d.workItemId && IN_FLIGHT_DECISION_STATUSES.has(d.status)).map(d => d.workItemId!),
  );
  for (const item of inputs.items) {
    const stage = factoryRuleStage(item.stages);
    if (!stage || stage === 'intake' || isTerminalFactoryRuleStage([stage])) continue;
    const base = subject(item.id);
    const enteredAt = stageEnteredAt(item);
    const inStageMs = enteredAt ? now.getTime() - enteredAt.getTime() : null;

    const held = stage === 'triage' && item.triageType !== null && item.triageType !== 'bug' && !item.acceptedAt;
    if (held) {
      if (inStageMs !== null && inStageMs > thresholds.waitingOnPersonMs) {
        findings.push({
          kind: 'held-waiting',
          id: `held-waiting:${item.id}`,
          ...base,
          evidence: `Triaged as "${item.triageType}" and waiting for a maintainer's decision since ${enteredAt!.toISOString()}.`,
          ageMs: inStageMs,
          suggestedRepair: { action: 'accept-work-item', workItemId: item.id },
        });
      }
    } else if (!activeSeatsByItem.has(item.id) && !inFlightByItem.has(item.id)) {
      const role = ROLE_FOR_LANE.get(stage);
      findings.push({
        kind: 'seat-missing',
        id: `seat-missing:${item.id}`,
        ...base,
        evidence: `In ${stage} since ${enteredAt?.toISOString() ?? 'unknown'} with no active seat and no decision in flight; nothing will move it.`,
        ageMs: inStageMs,
        suggestedRepair: role ? { action: 'start-run', workItemId: item.id, role } : null,
      });
    }

    if (item.acceptedAt && itemLabels(item).includes(NEEDS_APPROVAL_LABEL)) {
      findings.push({
        kind: 'label-drift',
        id: `label-drift:${item.id}`,
        ...base,
        evidence: `Accepted at ${item.acceptedAt.toISOString()} but the last observed labels still include "${NEEDS_APPROVAL_LABEL}".`,
        ageMs: now.getTime() - item.acceptedAt.getTime(),
        suggestedRepair: { action: 'reconcile-labels', workItemId: item.id },
      });
    }
  }

  findings.sort((a, b) => (b.ageMs ?? 0) - (a.ageMs ?? 0));
  const counts = Object.fromEntries(FINDING_KINDS.map(kind => [kind, 0])) as Record<FactoryHealthFindingKind, number>;
  for (const finding of findings) counts[finding.kind] += 1;
  return { checkedAt: now.toISOString(), findings, counts };
}

export async function runFactoryHealthCheck(
  workItems: WorkItemsStorage,
  scope: { orgId: string; factoryProjectId: string },
  options: { now?: Date; thresholds?: FactoryHealthThresholds } = {},
): Promise<FactoryHealthReport> {
  const [items, decisions, bindings, pendingStarts] = await Promise.all([
    workItems.list(scope),
    workItems.listDeferredDecisions(scope.orgId, scope.factoryProjectId),
    workItems.listRunBindings(scope.orgId, scope.factoryProjectId),
    workItems.listPendingStarts(scope.orgId, scope.factoryProjectId),
  ]);
  return computeFactoryHealth(
    { items, decisions, bindings, pendingStarts },
    options.now ?? new Date(),
    options.thresholds,
  );
}
