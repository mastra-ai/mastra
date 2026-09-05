import type { FactoryLinearEventName, FactoryLinearRuleContext, FactoryRuleHandler } from '../../rules/types.js';

export type LinearRuleOverrides = Partial<
  Record<FactoryLinearEventName, FactoryRuleHandler<FactoryLinearRuleContext> | null | undefined>
>;
export type LinearEventRules = Readonly<
  Record<FactoryLinearEventName, FactoryRuleHandler<FactoryLinearRuleContext> | null>
>;

function linearIssueObserved(context: FactoryLinearRuleContext) {
  if (context.item) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-triage`,
    board: 'work',
    source: 'linear-issue',
    sourceKey: `linear:${context.issue.identifier}`,
    title: `${context.issue.identifier}: ${context.issue.title}`,
    url: context.issue.url,
    stage: 'triage',
    metadata: {
      linearIssueId: context.issue.id,
      identifier: context.issue.identifier,
      sourceCreatedAt: context.issue.createdAt,
      linearState: context.issue.state,
      linearStateType: context.issue.stateType,
      linearPriority: context.issue.priorityLabel,
      linearAssignee: context.issue.assignee,
      linearCreator: context.issue.creator,
      linearTeam: context.issue.team,
      labels: [...context.issue.labels] as string[],
      ...(context.issue.assignee ? { assignee: context.issue.assignee } : {}),
      ...(context.issue.creator ? { creator: context.issue.creator, author: context.issue.creator } : {}),
    },
  } as const;
}

function linearIssueClosed(context: FactoryLinearRuleContext) {
  if (!context.item || context.item.source !== 'linear-issue') return;
  if (context.board !== 'work') return;
  // Already off the board: nothing to reconcile.
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  // Only terminal state types trigger close.
  const stateType = context.issue.stateType;
  if (stateType !== 'completed' && stateType !== 'canceled') return;
  const canceled = stateType === 'canceled';
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:issue-closed`,
    board: 'work',
    stage: canceled ? 'canceled' : 'done',
    message: {
      text: `Linear issue ${context.issue.identifier} was ${canceled ? 'canceled' : 'completed'}; this Work card was moved to ${canceled ? 'Canceled' : 'Done'}.`,
    },
  } as const;
}

export const defaultLinearRules = Object.freeze({
  issueObserved: linearIssueObserved,
  issueClosed: linearIssueClosed,
} satisfies LinearEventRules);

export function resolveLinearRules(overrides?: LinearRuleOverrides): LinearEventRules {
  if (
    overrides !== undefined &&
    (overrides === null ||
      typeof overrides !== 'object' ||
      Array.isArray(overrides) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(overrides)))
  ) {
    throw new Error('Linear rules must be a plain object.');
  }
  const rules: Record<string, FactoryRuleHandler<FactoryLinearRuleContext> | null> = { ...defaultLinearRules };
  for (const key of Reflect.ownKeys(overrides ?? {})) {
    if (typeof key !== 'string' || !Object.hasOwn(defaultLinearRules, key)) {
      throw new Error(`Unknown Linear rule event: ${String(key)}.`);
    }
    const handler = overrides?.[key as FactoryLinearEventName];
    if (handler !== undefined && handler !== null && typeof handler !== 'function') {
      throw new Error(`Linear rule ${key} must be a function, null, or undefined.`);
    }
    if (handler !== undefined) rules[key] = handler;
  }
  return Object.freeze(rules) as LinearEventRules;
}
