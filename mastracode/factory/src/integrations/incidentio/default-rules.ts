import type {
  FactoryIncidentioEventName,
  FactoryIncidentioRuleContext,
  FactoryRuleHandler,
} from '../../rules/types.js';
import { incidentioClaimKey } from './claim.js';

export type IncidentioRuleOverrides = Partial<
  Record<FactoryIncidentioEventName, FactoryRuleHandler<FactoryIncidentioRuleContext> | null | undefined>
>;
export type IncidentioEventRules = Readonly<
  Record<FactoryIncidentioEventName, FactoryRuleHandler<FactoryIncidentioRuleContext> | null>
>;

function incidentioFollowUpObserved(context: FactoryIncidentioRuleContext) {
  if (context.item) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:follow-up-triage`,
    // A source bound to a custom board lands on that board's initial phase;
    // otherwise Work auto-triages the new follow-up.
    board: context.intake?.board ?? 'work',
    source: 'incidentio-follow-up',
    sourceKey: context.issue.id,
    claimKey: incidentioClaimKey(context.issue.id),
    title: context.issue.title,
    url: context.issue.url,
    stage: context.intake?.initialPhase ?? 'triage',
    metadata: {
      identifier: context.issue.identifier,
      issueRef: context.issue.id,
      sourceCreatedAt: context.issue.createdAt,
      state: context.issue.state,
      stateType: context.issue.stateType,
      priority: context.issue.priorityLabel,
      incident: context.issue.incident,
      assignee: context.issue.assignee,
      assignees: (context.issue.assignee ? [context.issue.assignee] : []) as string[],
      creator: context.issue.author,
      author: context.issue.author,
      labels: [...context.issue.labels] as string[],
      createdAt: context.issue.createdAt,
      updatedAt: context.issue.updatedAt,
    },
  } as const;
}

function incidentioFollowUpClosed(context: FactoryIncidentioRuleContext) {
  if (!context.item || context.item.source !== 'incidentio-follow-up') return;
  if (context.board !== 'work') return;
  // Already off the board: nothing to reconcile.
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  // Only terminal state types trigger close.
  const stateType = context.issue.stateType;
  if (stateType !== 'completed' && stateType !== 'canceled') return;
  const canceled = stateType === 'canceled';
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:follow-up-closed`,
    board: 'work',
    stage: canceled ? 'canceled' : 'done',
    message: {
      text: `incident.io follow-up ${context.issue.identifier} was ${canceled ? 'canceled' : 'completed'}; this Work card was moved to ${canceled ? 'Canceled' : 'Done'}.`,
    },
  } as const;
}

export const defaultIncidentioRules = Object.freeze({
  followUpObserved: incidentioFollowUpObserved,
  followUpClosed: incidentioFollowUpClosed,
} satisfies IncidentioEventRules);

export function resolveIncidentioRules(overrides?: IncidentioRuleOverrides): IncidentioEventRules {
  if (
    overrides !== undefined &&
    (overrides === null ||
      typeof overrides !== 'object' ||
      Array.isArray(overrides) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(overrides)))
  ) {
    throw new Error('incident.io rules must be a plain object.');
  }
  const rules: Record<string, FactoryRuleHandler<FactoryIncidentioRuleContext> | null> = {
    ...defaultIncidentioRules,
  };
  for (const key of Reflect.ownKeys(overrides ?? {})) {
    if (typeof key !== 'string' || !Object.hasOwn(defaultIncidentioRules, key)) {
      throw new Error(`Unknown incident.io rule event: ${String(key)}.`);
    }
    const handler = overrides?.[key as FactoryIncidentioEventName];
    if (handler !== undefined && handler !== null && typeof handler !== 'function') {
      throw new Error(`incident.io rule ${key} must be a function, null, or undefined.`);
    }
    if (handler !== undefined) rules[key] = handler;
  }
  return Object.freeze(rules) as IncidentioEventRules;
}
