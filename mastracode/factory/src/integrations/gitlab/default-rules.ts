import type {
  FactoryGitLabEventName,
  FactoryGitLabRuleContext,
  FactoryRuleHandler,
} from '../../rules/types.js';

export type GitLabRuleOverrides = Partial<
  Record<FactoryGitLabEventName, FactoryRuleHandler<FactoryGitLabRuleContext> | null | undefined>
>;
export type GitLabEventRules = Readonly<
  Record<FactoryGitLabEventName, FactoryRuleHandler<FactoryGitLabRuleContext> | null>
>;


function actorUsername(context: Pick<FactoryGitLabRuleContext, 'actor'>): string | undefined {
  return context.actor.type === 'gitlab' ? context.actor.username : undefined;
}

function createdAfterFactory(createdAt: string | undefined, factoryCreatedAt: string): boolean {
  if (!createdAt) return false;
  const sourceCreatedAt = Date.parse(createdAt);
  const projectCreatedAt = Date.parse(factoryCreatedAt);
  return Number.isFinite(sourceCreatedAt) && Number.isFinite(projectCreatedAt) && sourceCreatedAt > projectCreatedAt;
}

function issueOpened(context: FactoryGitLabRuleContext) {
  if (!context.issue) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-intake`,
    board: context.intake?.board ?? 'work',
    source: 'gitlab-issue',
    sourceKey: context.issue.sourceKey,
    title: context.issue.title,
    url: context.issue.url,
    stage: context.intake?.initialPhase ?? 'intake',
    metadata: {
      gitlabHost: context.repository.host,
      gitlabProjectId: context.repository.id,
      gitlabIssueIid: context.issue.number,
      identifier: `${context.repository.fullName}#${context.issue.number}`,
      ...(context.issue.createdAt ? { sourceCreatedAt: context.issue.createdAt } : {}),
      ...(context.issue.author ?? actorUsername(context)
        ? { author: context.issue.author ?? actorUsername(context) }
        : {}),
      authorTrusted: context.issue.authorTrusted,
      autoStartCandidate:
        context.issue.authorTrusted && createdAfterFactory(context.issue.createdAt, context.factory.createdAt),
      assignees: context.issue.assignees ?? [],
      labels: context.issue.labels ?? [],
      labelColors: context.issue.labelColors ?? {},
    },
  } as const;
}

function retriageIssue(context: FactoryGitLabRuleContext) {
  if (!context.item || context.item.source !== 'gitlab-issue' || !context.item.url) return;
  if (context.actor.type === 'gitlab' && context.actor.factoryAuthored) return;
  const reason = context.event === 'issueCommented' ? 'a comment was added' : 'the issue changed';
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-triage`,
    role: 'triage',
    skillName: 'factory-triage',
    arguments: `Re-triage GitLab issue (${context.item.url}) after ${reason}.`,
  } as const;
}

function issueClosed(context: FactoryGitLabRuleContext) {
  if (!context.item || context.item.source !== 'gitlab-issue' || context.board !== 'work') return;
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:issue-closed`,
    board: 'work',
    stage: 'done',
    message: {
      text: `GitLab issue #${context.issue?.number ?? ''} was closed; this Work card was moved to Done.`,
    },
  } as const;
}

function materializeMergeRequest(context: FactoryGitLabRuleContext) {
  if (!context.mergeRequest) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:merge-request-intake`,
    board: 'review',
    source: 'gitlab-pr',
    sourceKey: context.mergeRequest.sourceKey,
    title: context.mergeRequest.title,
    url: context.mergeRequest.url,
    stage: 'intake',
    metadata: {
      gitlabHost: context.repository.host,
      gitlabProjectId: context.repository.id,
      gitlabMergeRequestIid: context.mergeRequest.number,
      ...(context.mergeRequest.createdAt ? { sourceCreatedAt: context.mergeRequest.createdAt } : {}),
      factoryAuthored: context.mergeRequest.factoryAuthored,
      authorTrusted: context.mergeRequest.authorTrusted,
      autoStartCandidate:
        (context.mergeRequest.authorTrusted || context.mergeRequest.factoryAuthored) &&
        createdAfterFactory(context.mergeRequest.createdAt, context.factory.createdAt),
      state: context.mergeRequest.state,
      draft: context.mergeRequest.draft,
      merged: context.mergeRequest.merged,
      assignees: context.mergeRequest.assignees ?? [],
      requestedReviewers: context.mergeRequest.reviewers ?? [],
      labels: context.mergeRequest.labels ?? [],
      headBranch: context.mergeRequest.headBranch,
      baseBranch: context.mergeRequest.baseBranch,
      ...(context.mergeRequest.author ? { author: context.mergeRequest.author } : {}),
    },
  } as const;
}

function mergeRequestUpdated(context: FactoryGitLabRuleContext) {
  if (!context.item || context.item.source !== 'gitlab-pr' || context.board !== 'review') return;
  if (!context.mergeRequest || context.mergeRequest.state !== 'open' || context.mergeRequest.merged) return;
  if (context.item.stages.some(stage => stage === 'intake')) return;
  const alreadyReviewing = context.item.stages.some(stage => stage === 'review');
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:re-review-updated`,
    board: 'review',
    stage: 'review',
    ...(alreadyReviewing ? { reenter: true } : {}),
  } as const;
}

function mergeRequestCommented(context: FactoryGitLabRuleContext) {
  if (!context.item || !context.mergeRequest || !context.note || context.board !== 'work') return;
  if (context.mergeRequest.state !== 'open' || context.mergeRequest.merged) return;
  if (context.actor.type === 'gitlab' && context.actor.factoryAuthored) return;
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:address-merge-request-comment`,
    role: 'work',
    priority: 'high',
    message:
      `${context.note.author ?? 'Someone'} commented on GitLab merge request !${context.mergeRequest.number} ` +
      `(${context.note.url ?? context.mergeRequest.url}). Read the comment, address it if you agree, and push ` +
      'the fixes to the merge-request branch. Reply in GitLab to anything you are deliberately not changing.',
  } as const;
}

function mergeRequestMerged(context: FactoryGitLabRuleContext) {
  if (!context.item || !context.mergeRequest?.merged) return;
  if (context.board === 'review') {
    return {
      type: 'transition',
      idempotencyKey: `${context.ingress.id}:merge-request-merged`,
      board: 'review',
      stage: 'done',
      message: {
        text: `GitLab merge request !${context.mergeRequest.number} merged; this Review card was moved to Done.`,
      },
    } as const;
  }
  if (context.board !== 'work') return;
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:assess-work-completion`,
    role: 'work',
    message:
      `GitLab merge request !${context.mergeRequest.number} merged. Assess whether the linked Work item is complete. ` +
      'Do not mark it Done solely because this merge request merged.',
  } as const;
}

function mergeRequestClosed(context: FactoryGitLabRuleContext) {
  if (!context.item || !context.mergeRequest || context.mergeRequest.merged || context.board !== 'review') return;
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:merge-request-closed`,
    board: 'review',
    stage: 'canceled',
    message: {
      text:
        `GitLab merge request !${context.mergeRequest.number} was closed without merging; ` +
        'this Review card was moved to Canceled.',
    },
  } as const;
}

export const defaultGitLabRules = Object.freeze({
  issueOpened,
  issueUpdated: retriageIssue,
  issueClosed,
  issueCommented: retriageIssue,
  mergeRequestOpened: materializeMergeRequest,
  mergeRequestUpdated,
  mergeRequestCommented,
  mergeRequestMerged,
  mergeRequestClosed,
} satisfies GitLabEventRules);

export function resolveGitLabRules(overrides?: GitLabRuleOverrides): GitLabEventRules {
  if (overrides !== undefined && (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides))) {
    throw new Error('GitLab rules must be an object.');
  }
  const rules: Record<string, FactoryRuleHandler<FactoryGitLabRuleContext> | null> = { ...defaultGitLabRules };
  for (const key of Reflect.ownKeys(overrides ?? {})) {
    if (typeof key !== 'string' || !Object.hasOwn(defaultGitLabRules, key)) {
      throw new Error(`Unknown GitLab rule event: ${String(key)}.`);
    }
    const handler = overrides?.[key as FactoryGitLabEventName];
    if (handler !== undefined && handler !== null && typeof handler !== 'function') {
      throw new Error(`GitLab rule ${key} must be a function, null, or undefined.`);
    }
    if (handler !== undefined) rules[key] = handler;
  }
  return Object.freeze(rules) as GitLabEventRules;
}
