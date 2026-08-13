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

function trustedGithubActor(context: Pick<FactoryStageRuleContext, 'actor'>): boolean {
  return context.actor.type === 'github' && context.actor.trusted;
}

function githubActorLogin(context: Pick<FactoryStageRuleContext, 'actor'>): string | undefined {
  return context.actor.type === 'github' ? context.actor.login : undefined;
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
  if (
    context.cause === 'run_start' ||
    (context.cause === 'linked_item_materialized' && context.fromStage === 'intake' && context.toStage === 'triage')
  ) {
    return;
  }
  return invokeIssueInvestigation(context);
}

function retriageGithubIssue(context: FactoryGithubRuleContext) {
  if (!context.item || context.item.source !== 'github-issue' || !context.item.url) return;
  if (context.actor.type === 'github' && context.actor.factoryAuthored) return;

  const reason =
    context.event === 'issueEdited'
      ? context.issueChange?.title && context.issueChange.body
        ? 'issue title and body edited'
        : context.issueChange?.title
          ? 'issue title edited'
          : 'issue body edited'
      : context.event === 'issueCommentDeleted'
        ? 'comment deleted'
        : context.event === 'issueCommentEdited'
          ? 'comment edited'
          : 'comment created';
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-triage`,
    role: 'triage',
    skillName: 'factory-triage',
    arguments: `Re-triage GitHub issue (${context.item.url}) after ${reason}.`,
  } as const;
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
  // A re-entry into Review (from any post-intake stage) supersedes whichever
  // review pass previously ran on this card: cancel any in-flight run before
  // dispatching a fresh one so we don't burn tokens on the stale pass and race
  // two agents on the same card. Cancellation is safe when nothing is in flight.
  const supersedes = context.fromStage !== 'intake';
  // The re-review skill only applies when a prior review pass actually completed
  // (the card is returning from `done`). A cancelled first-time review that
  // re-enters Review from `review` itself still has no prior pass to reconcile —
  // it gets the regular factory-review skill.
  const priorReviewCompleted = context.fromStage === 'done';
  const skillName = priorReviewCompleted ? 'factory-rereview' : 'factory-review';
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:${skillName}`,
    role: 'review',
    skillName,
    arguments: context.item.url ? `GitHub pull request (${context.item.url})` : context.item.title,
    ...(supersedes ? { cancelInFlight: true } : {}),
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
      ...(githubActorLogin(context) ? { author: githubActorLogin(context) } : {}),
      assignees: context.issue.assignees ?? [],
      labels: context.issue.labels ?? [],
    },
  } as const;
}

function issueClosed(context: FactoryGithubRuleContext) {
  if (!context.item || context.item.source !== 'github-issue' || !context.issue) return;
  if (context.board !== 'work') return;
  // Already off the board: nothing to reconcile.
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  // Issue closure is a repository fact, not third-party input — no actor trust
  // gate. `not_planned` (and `duplicate`) means abandoned, everything else is
  // completed work.
  const canceled = context.issue.stateReason === 'not_planned' || context.issue.stateReason === 'duplicate';
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:issue-closed`,
    board: 'work',
    stage: canceled ? 'canceled' : 'done',
    message: {
      text:
        `GitHub issue #${context.issue.number} was closed` +
        `${context.issue.stateReason ? ` (${context.issue.stateReason})` : ''}; ` +
        `this Work card was moved to ${canceled ? 'Canceled' : 'Done'}.`,
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
      state: context.pullRequest.state,
      draft: context.pullRequest.draft,
      merged: context.pullRequest.merged,
      assignees: context.pullRequest.assignees ?? [],
      requestedReviewers: context.pullRequest.requestedReviewers ?? [],
      labels: context.pullRequest.labels ?? [],
      headBranch: context.pullRequest.headBranch,
      baseBranch: context.pullRequest.baseBranch,
      ...(githubActorLogin(context) ? { author: githubActorLogin(context) } : {}),
    },
  } as const;
}

function pullRequestMerged(context: FactoryGithubRuleContext) {
  if (!context.item || !context.pullRequest?.merged) return;
  if (context.board === 'review') {
    // The event is bound to the PR's own Review card: a merged PR is finished
    // review work, so always move the card to Done. The message only reaches
    // an active session (if any) — cards without one just move, instead of
    // failing retries against a binding that never existed.
    return {
      type: 'transition',
      idempotencyKey: `${context.ingress.id}:pull-request-merged`,
      board: 'review',
      stage: 'done',
      message: {
        text:
          `Pull request #${context.pullRequest.number} merged; this Review card was moved to Done. ` +
          'No further review is needed unless follow-up work was requested.',
      },
    } as const;
  }
  // Provenance bound the event to the originating Work item instead: remind
  // its agent to assess completion — never auto-complete the Work item.
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:assess-work-completion`,
    role: 'work',
    message:
      `Pull request #${context.pullRequest.number} merged. Assess whether the linked Work item is complete. ` +
      'Do not mark it Done solely because this PR merged; use factory_transition_work_item only after verifying the work.',
  } as const;
}

function pullRequestClosed(context: FactoryGithubRuleContext) {
  if (!context.item || !context.pullRequest || context.pullRequest.merged) return;
  if (context.board !== 'review') return;
  // A PR closed without merging is abandoned review work: clear the card off
  // the board instead of leaving it in Reviewing forever.
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:pull-request-closed`,
    board: 'review',
    stage: 'canceled',
    message: {
      text:
        `Pull request #${context.pullRequest.number} was closed without merging; ` +
        'this Review card was moved to Canceled.',
    },
  } as const;
}

function reReviewRequestedPullRequest(context: FactoryGithubRuleContext) {
  // Only a review re-requested *from Factory's own bot* restarts the review —
  // requesting a human reviewer is not Factory's signal.
  if (!context.item || context.board !== 'review' || !context.reviewRequest?.factoryReviewer) return;
  if (!context.pullRequest || context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // Trusted (write/admin) requesters only: re-entering review checks out and
  // executes PR code, the same bar pullRequestOpened applies to auto-review.
  if (!trustedGithubActor(context)) return;
  if (context.actor.type === 'github' && context.actor.factoryAuthored) return;
  // Already in Reviewing: a review pass is pending or running; re-entering
  // would be a same-stage no-op anyway (stage rules only fire on change).
  if (context.item.stages.length === 1 && context.item.stages[0] === 'review') return;
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:re-review-requested`,
    board: 'review',
    stage: 'review',
  } as const;
}

function reReviewUpdatedPullRequest(context: FactoryGithubRuleContext) {
  if (!context.item || context.board !== 'review') return;
  if (!context.pullRequest || context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // Intake and Reviewing have not completed a review pass yet. Only a push to a
  // card that already left Reviewing should start a fresh pass.
  if (context.item.stages.some(stage => stage === 'intake' || stage === 'review')) return;
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:re-review-updated`,
    board: 'review',
    stage: 'review',
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
    issueEdited: { onEvent: retriageGithubIssue },
    issueClosed: { onEvent: issueClosed },
    issueCommentCreated: { onEvent: retriageGithubIssue },
    issueCommentEdited: { onEvent: retriageGithubIssue },
    issueCommentDeleted: { onEvent: retriageGithubIssue },
    pullRequestOpened: { onEvent: pullRequestOpened },
    pullRequestUpdated: { onEvent: reReviewUpdatedPullRequest },
    pullRequestReviewRequested: { onEvent: reReviewRequestedPullRequest },
    pullRequestMerged: { onEvent: pullRequestMerged },
    pullRequestClosed: { onEvent: pullRequestClosed },
  },
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
