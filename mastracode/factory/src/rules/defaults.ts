import { reviewBoard } from '../boards/review.js';
import { workBoard } from '../boards/work.js';
import type {
  FactoryBoardRuleLeaf,
  FactoryBoardRules,
  FactoryLinearEventName,
  FactoryLinearRuleContext,
  FactoryLinearRuleLeaf,
  FactoryRules,
  FactoryRulesOverrides,
  FactoryRuleSource,
  FactoryRuleStage,
  FactoryToolResultRuleContext,
  FactoryToolRuleLeaf,
} from './types.js';
import { assertFactoryRules, FactoryRuleValidationError } from './validation.js';

export const DEFAULT_FACTORY_RULE_VERSION = 'factory-default-v1';

function resultContent(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const content = (value as { content?: unknown }).content;
  return typeof content === 'string' ? content : undefined;
}

// Interactive-session path only: factory-plan never calls submit_plan — it
// advances planning → execute via factory_transition_work_item directly.
function advanceApprovedPlan(context: FactoryToolResultRuleContext) {
  if (
    context.result.status !== 'success' ||
    context.board !== 'work' ||
    context.item.stages.length !== 1 ||
    context.item.stages[0] !== 'planning' ||
    context.actor.type !== 'agent' ||
    context.actor.role !== 'plan' ||
    !resultContent(context.result.value)?.startsWith('Plan approved.')
  ) {
    return;
  }
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:approved-plan`,
    board: 'work',
    stage: 'execute',
  } as const;
}

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

const BUILT_IN_DEFAULTS: FactoryRulesOverrides = {
  work: workBoard.rules,
  review: reviewBoard.rules,
  tools: { submit_plan: { onResult: advanceApprovedPlan } },
  linear: { issueObserved: { onEvent: linearIssueObserved }, issueClosed: { onEvent: linearIssueClosed } },
};

function mergeBoardRules(
  base: FactoryBoardRules | undefined,
  overrides: FactoryBoardRules | undefined,
): FactoryBoardRules {
  const result: FactoryBoardRules = {};
  const stages = new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})]) as Set<FactoryRuleStage>;
  for (const stage of stages) {
    const baseSources = base?.[stage];
    const overrideSources = overrides?.[stage];
    const sources = new Set([
      ...Object.keys(baseSources ?? {}),
      ...Object.keys(overrideSources ?? {}),
    ]) as Set<FactoryRuleSource>;
    const mergedSources: Partial<Record<FactoryRuleSource, FactoryBoardRuleLeaf>> = {};
    for (const source of sources) {
      const baseLeaf = baseSources?.[source];
      const overrideLeaf = overrideSources?.[source];
      mergedSources[source] = {
        ...(baseLeaf && 'onEnter' in baseLeaf ? { onEnter: baseLeaf.onEnter } : {}),
        ...(baseLeaf && 'onExit' in baseLeaf ? { onExit: baseLeaf.onExit } : {}),
        ...(overrideLeaf && 'onEnter' in overrideLeaf ? { onEnter: overrideLeaf.onEnter } : {}),
        ...(overrideLeaf && 'onExit' in overrideLeaf ? { onExit: overrideLeaf.onExit } : {}),
      };
    }
    result[stage] = mergedSources;
  }
  return result;
}

function mergeToolRules(
  base: Record<string, FactoryToolRuleLeaf> | undefined,
  overrides: Record<string, FactoryToolRuleLeaf> | undefined,
): Record<string, FactoryToolRuleLeaf> {
  const result: Record<string, FactoryToolRuleLeaf> = {};
  for (const name of new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})])) {
    const baseLeaf = base?.[name];
    const overrideLeaf = overrides?.[name];
    result[name] = {
      ...(baseLeaf && 'onResult' in baseLeaf ? { onResult: baseLeaf.onResult } : {}),
      ...(overrideLeaf && 'onResult' in overrideLeaf ? { onResult: overrideLeaf.onResult } : {}),
    };
  }
  return result;
}

function mergeLinearRules(
  base: FactoryRulesOverrides['linear'],
  overrides: FactoryRulesOverrides['linear'],
): NonNullable<FactoryRulesOverrides['linear']> {
  const result: Partial<Record<FactoryLinearEventName, FactoryLinearRuleLeaf>> = {};
  const events = new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})]) as Set<FactoryLinearEventName>;
  for (const event of events) {
    const baseLeaf = base?.[event];
    const overrideLeaf = overrides?.[event];
    result[event] = {
      ...(baseLeaf && 'onEvent' in baseLeaf ? { onEvent: baseLeaf.onEvent } : {}),
      ...(overrideLeaf && 'onEvent' in overrideLeaf ? { onEvent: overrideLeaf.onEvent } : {}),
    };
  }
  return result;
}

export function mergeFactoryRuleOverrides(
  base: FactoryRulesOverrides,
  overrides: FactoryRulesOverrides = {},
): Omit<FactoryRules, 'version'> {
  return {
    work: mergeBoardRules(base.work, overrides.work),
    review: mergeBoardRules(base.review, overrides.review),
    tools: mergeToolRules(base.tools, overrides.tools),
    linear: mergeLinearRules(base.linear, overrides.linear),
  };
}

export function defaultFactoryRules(input: { version: string; overrides?: FactoryRulesOverrides }): FactoryRules {
  if (typeof input?.version !== 'string' || input.version.trim().length === 0) {
    throw new FactoryRuleValidationError('Factory rule version is required.');
  }

  const rules: FactoryRules = {
    version: input.version.trim(),
    ...mergeFactoryRuleOverrides(BUILT_IN_DEFAULTS, input.overrides),
  };
  assertFactoryRules(rules);
  return rules;
}

export function builtInFactoryRules(): FactoryRules {
  return defaultFactoryRules({ version: DEFAULT_FACTORY_RULE_VERSION });
}
