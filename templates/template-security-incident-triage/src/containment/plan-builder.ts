import { DomainError } from '../domain/errors.js';
import { sha256 } from '../mastra/knowledge/hashes.js';
import { ContainmentActionSchema, type ContainmentAction } from '../schemas/containment.js';
import type { DecisionContext } from '../triage/decision-context.js';
import {
  CONTAINMENT_PLAN_HASH_VERSION,
  CONTAINMENT_PLAN_TTL_MS,
  ValidatedContainmentPlanSchema,
} from '../triage/decision-contracts.js';
import { calculatePlanHash, canonicalizePlanValue, verifyPlanHash } from './plan-canonicalization.js';

export function buildValidatedContainmentPlan(
  context: DecisionContext,
  unresolved: readonly Omit<ContainmentAction, 'actionId'>[],
) {
  if (unresolved.length < 1 || unresolved.length > 2) throw new DomainError('VALIDATION_FAILED');
  const sorted = [...unresolved].sort((left, right) => compareUtf16(semanticActionKey(left), semanticActionKey(right)));
  const actions = sorted.map((action, ordinal) =>
    ContainmentActionSchema.parse({
      ...action,
      // These namespaces are durable compatibility keys, not product-facing names.
      actionId: stableId('triage-action-v1', {
        incidentId: context.correlation.context.incidentId,
        workflowRunId: context.correlation.context.workflowRunId,
        ordinal,
        type: action.type,
        targetId: action.targetId,
        input: action.input,
      }),
    }),
  );
  if (new Set(actions.map(action => `${action.type}\0${action.targetId}`)).size !== actions.length)
    throw new DomainError('CONFLICT');
  const createdAtMs = Date.parse(context.startedAt);
  if (!Number.isFinite(createdAtMs)) throw new DomainError('VALIDATION_FAILED');
  const createdAt = new Date(createdAtMs).toISOString();
  const expiresAt = new Date(createdAtMs + CONTAINMENT_PLAN_TTL_MS).toISOString();
  const unsigned = {
    schemaVersion: 1 as const,
    planId: stableId('triage-plan-v1', {
      incidentId: context.correlation.context.incidentId,
      tenantId: context.correlation.context.tenantId,
      workflowRunId: context.correlation.context.workflowRunId,
      planVersion: 1,
      createdAt,
      expiresAt,
      actions,
    }),
    incidentId: context.correlation.context.incidentId,
    tenantId: context.correlation.context.tenantId,
    planVersion: 1,
    planHashVersion: CONTAINMENT_PLAN_HASH_VERSION,
    createdAt,
    expiresAt,
    actions,
  };
  const plan = ValidatedContainmentPlanSchema.parse({
    ...unsigned,
    planHash: calculatePlanHash(unsigned),
  });
  if (!verifyPlanHash(plan)) throw new DomainError('VALIDATION_FAILED');
  return plan;
}

function semanticActionKey(action: Omit<ContainmentAction, 'actionId'>): string {
  return `${action.type}\0${action.targetId.normalize('NFC')}\0${canonicalizePlanValue(action.input)}`;
}

function stableId(namespace: string, value: unknown): string {
  return `${namespace.includes('action') ? 'action' : 'plan'}_${sha256(
    `${namespace}\0${canonicalizePlanValue(value)}`,
  )}`;
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
