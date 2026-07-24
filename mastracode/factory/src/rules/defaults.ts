import type {
  FactoryBoardRuleLeaf,
  FactoryBoardRules,
  FactoryGithubRuleLeaf,
  FactoryGithubEventName,
  FactoryGithubRuleContext,
  FactoryLinearEventName,
  FactoryLinearRuleContext,
  FactoryLinearRuleLeaf,
  FactoryRules,
  FactoryRulesOverrides,
  FactoryRuleSource,
  FactoryRuleStage,
  FactoryStageRuleContext,
  FactoryToolResultRuleContext,
  FactoryToolRuleLeaf,
} from './types.js';
import { assertFactoryRules, FactoryRuleValidationError } from './validation.js';

export const DEFAULT_FACTORY_RULE_VERSION = 'factory-default-v1';

export function requireSupervisorApproval(
  context: Pick<FactoryStageRuleContext, 'actor' | 'ingress'>,
  options: { reason: string; summary?: string; idempotencyKey?: string },
) {
  if (context.actor.type !== 'agent') return;
  return {
    type: 'requestApproval',
    idempotencyKey: options.idempotencyKey ?? `${context.ingress.id}:supervisor-approval`,
    reason: options.reason,
    ...(options.summary ? { summary: options.summary } : {}),
  } as const;
}

function trustedGithubActor(context: Pick<FactoryStageRuleContext, 'actor'>): boolean {
  return context.actor.type === 'github' && context.actor.trusted;
}

function invokeIssueInvestigation(context: FactoryStageRuleContext) {
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-triage`,
    role: 'triage',
    skillName: 'factory-triage',
    arguments: context.item.url ? `GitHub issue (${context.item.url})` : context.item.title,
  } as const;
}

function investigateTriagedIssue(context: FactoryStageRuleContext) {
  return invokeIssueInvestigation(context);
}

function investigateTriagedLinearIssue(context: FactoryStageRuleContext) {
  const identifier = context.item.sourceKey?.startsWith('linear:')
    ? context.item.sourceKey.slice('linear:'.length)
    : context.item.title;
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-triage-linear`,
    role: 'triage',
    skillName: 'factory-triage',
    arguments: `Linear issue ${identifier}${context.item.url ? ` (${context.item.url})` : ''}`,
  } as const;
}

function planWorkItem(context: FactoryStageRuleContext) {
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-plan`,
    role: 'plan',
    skillName: 'factory-plan',
    arguments: context.item.url ? `Work item (${context.item.url})` : context.item.title,
  } as const;
}

function reviewPullRequest(context: FactoryStageRuleContext) {
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-review`,
    role: 'review',
    skillName: 'factory-review',
    arguments: context.item.url ? `GitHub pull request (${context.item.url})` : context.item.title,
  } as const;
}

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

function createdAfterFactory(createdAt: string | undefined, factoryCreatedAt: string): boolean {
  if (!createdAt) return false;
  const sourceCreatedAt = Date.parse(createdAt);
  const projectCreatedAt = Date.parse(factoryCreatedAt);
  return Number.isFinite(sourceCreatedAt) && Number.isFinite(projectCreatedAt) && sourceCreatedAt > projectCreatedAt;
}

function issueOpened(context: FactoryGithubRuleContext) {
  if (!context.issue) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-intake`,
    board: 'work',
    source: 'github-issue',
    sourceKey: `github-issue:${context.issue.number}`,
    title: context.issue.title,
    url: context.issue.url,
    stage:
      trustedGithubActor(context) && createdAfterFactory(context.issue.createdAt, context.factory.createdAt)
        ? 'triage'
        : 'intake',
    metadata: {
      githubRepositoryId: context.repository.id,
      githubIssueNumber: context.issue.number,
    },
  } as const;
}

function pullRequestOpened(context: FactoryGithubRuleContext) {
  if (!context.pullRequest) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:pull-request-intake`,
    board: 'review',
    source: 'github-pr',
    sourceKey: `github-pr:${context.pullRequest.number}`,
    title: context.pullRequest.title,
    url: context.pullRequest.url,
    stage:
      trustedGithubActor(context) && createdAfterFactory(context.pullRequest.createdAt, context.factory.createdAt)
        ? 'review'
        : 'intake',
    metadata: {
      githubRepositoryId: context.repository.id,
      githubPullRequestNumber: context.pullRequest.number,
      factoryAuthored: context.actor.type === 'github' && context.actor.factoryAuthored,
      headBranch: context.pullRequest.headBranch,
      baseBranch: context.pullRequest.baseBranch,
    },
  } as const;
}

function pullRequestMerged(context: FactoryGithubRuleContext) {
  if (!context.item || !context.pullRequest?.merged) return;
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:assess-work-completion`,
    role: 'work',
    message:
      `Pull request #${context.pullRequest.number} merged. Assess whether the linked Work item is complete. ` +
      'Do not mark it Done solely because this PR merged; use factory_transition_work_item only after verifying the work.',
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
      linearIssueIdentifier: context.issue.identifier,
      linearState: context.issue.state,
      linearStateType: context.issue.stateType,
      linearPriority: context.issue.priorityLabel,
      linearAssignee: context.issue.assignee,
      linearTeam: context.issue.team,
    },
  } as const;
}

const BUILT_IN_DEFAULTS: FactoryRulesOverrides = {
  work: {
    triage: {
      issue: { onEnter: investigateTriagedIssue },
      linearIssue: { onEnter: investigateTriagedLinearIssue },
    },
    planning: {
      issue: { onEnter: planWorkItem },
      linearIssue: { onEnter: planWorkItem },
      manual: { onEnter: planWorkItem },
    },
  },
  review: { review: { pullRequest: { onEnter: reviewPullRequest } } },
  tools: { submit_plan: { onResult: advanceApprovedPlan } },
  github: {
    issueOpened: { onEvent: issueOpened },
    pullRequestOpened: { onEvent: pullRequestOpened },
    pullRequestMerged: { onEvent: pullRequestMerged },
  },
  linear: { issueObserved: { onEvent: linearIssueObserved } },
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
        ...(baseLeaf?.onEnter ? { onEnter: baseLeaf.onEnter } : {}),
        ...(baseLeaf?.onExit ? { onExit: baseLeaf.onExit } : {}),
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
      ...(baseLeaf?.onResult ? { onResult: baseLeaf.onResult } : {}),
      ...(overrideLeaf && 'onResult' in overrideLeaf ? { onResult: overrideLeaf.onResult } : {}),
    };
  }
  return result;
}

function mergeGithubRules(
  base: FactoryRulesOverrides['github'],
  overrides: FactoryRulesOverrides['github'],
): NonNullable<FactoryRulesOverrides['github']> {
  const result: Partial<Record<FactoryGithubEventName, FactoryGithubRuleLeaf>> = {};
  const events = new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})]) as Set<FactoryGithubEventName>;
  for (const event of events) {
    const baseLeaf = base?.[event];
    const overrideLeaf = overrides?.[event];
    result[event] = {
      ...(baseLeaf?.onEvent ? { onEvent: baseLeaf.onEvent } : {}),
      ...(overrideLeaf && 'onEvent' in overrideLeaf ? { onEvent: overrideLeaf.onEvent } : {}),
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
      ...(baseLeaf?.onEvent ? { onEvent: baseLeaf.onEvent } : {}),
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
    github: mergeGithubRules(base.github, overrides.github),
    linear: mergeLinearRules(base.linear, overrides.linear),
    supervisor: {
      observeIdleWithoutTransition:
        overrides.supervisor?.observeIdleWithoutTransition ?? base.supervisor?.observeIdleWithoutTransition ?? true,
    },
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
