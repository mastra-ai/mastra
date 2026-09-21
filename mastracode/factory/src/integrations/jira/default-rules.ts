import type { FactoryJiraEventName, FactoryJiraRuleContext, FactoryRuleHandler } from '../../rules/types.js';
import { jiraClaimKey } from './claim.js';

export type JiraRuleOverrides = Partial<
  Record<FactoryJiraEventName, FactoryRuleHandler<FactoryJiraRuleContext> | null | undefined>
>;
export type JiraEventRules = Readonly<Record<FactoryJiraEventName, FactoryRuleHandler<FactoryJiraRuleContext> | null>>;

function jiraIssueObserved(context: FactoryJiraRuleContext) {
  if (context.item) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-triage`,
    // A source bound to a custom board lands on that board's initial phase;
    // otherwise Work auto-triages the new issue.
    board: context.intake?.board ?? 'work',
    source: 'jira-issue',
    sourceKey: context.issue.id,
    claimKey: jiraClaimKey(context.issue.id),
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
      project: context.issue.project,
      site: context.issue.site,
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

function jiraIssueClosed(context: FactoryJiraRuleContext) {
  if (!context.item || context.item.source !== 'jira-issue') return;
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
      text: `Jira issue ${context.issue.identifier} was ${canceled ? 'canceled' : 'completed'}; this Work card was moved to ${canceled ? 'Canceled' : 'Done'}.`,
    },
  } as const;
}

export const defaultJiraRules = Object.freeze({
  issueObserved: jiraIssueObserved,
  issueClosed: jiraIssueClosed,
} satisfies JiraEventRules);

export function resolveJiraRules(overrides?: JiraRuleOverrides): JiraEventRules {
  if (
    overrides !== undefined &&
    (overrides === null ||
      typeof overrides !== 'object' ||
      Array.isArray(overrides) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(overrides)))
  ) {
    throw new Error('Jira rules must be a plain object.');
  }
  const rules: Record<string, FactoryRuleHandler<FactoryJiraRuleContext> | null> = { ...defaultJiraRules };
  for (const key of Reflect.ownKeys(overrides ?? {})) {
    if (typeof key !== 'string' || !Object.hasOwn(defaultJiraRules, key)) {
      throw new Error(`Unknown Jira rule event: ${String(key)}.`);
    }
    const handler = overrides?.[key as FactoryJiraEventName];
    if (handler !== undefined && handler !== null && typeof handler !== 'function') {
      throw new Error(`Jira rule ${key} must be a function, null, or undefined.`);
    }
    if (handler !== undefined) rules[key] = handler;
  }
  return Object.freeze(rules) as JiraEventRules;
}
