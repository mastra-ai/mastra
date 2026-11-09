import {
  isPullRequestCard,
  newestOpenPullRequestNumber,
  PULL_REQUEST_REVIEW_PHASE,
  pullRequestReviewPhase,
  pullRequestSourceNumber,
  pullRequestSources,
  reviewedChangeRequest,
  reviewsPullRequest,
} from '../../boards/index.js';
import { closedByRoutes, recordExplicitRuleOverrides } from '../../rules/event-rules.js';
import type { FactoryGitLabEventName, FactoryGitLabRuleContext, FactoryRuleHandler } from '../../rules/types.js';

export type GitLabRuleOverrides = Partial<
  Record<FactoryGitLabEventName, FactoryRuleHandler<FactoryGitLabRuleContext> | null | undefined>
>;
export type GitLabEventRules = Readonly<
  Record<FactoryGitLabEventName, FactoryRuleHandler<FactoryGitLabRuleContext> | null>
>;

function actorUsername(context: Pick<FactoryGitLabRuleContext, 'actor'>): string | undefined {
  return context.actor.type === 'gitlab' ? context.actor.username : undefined;
}

function trustedGitLabActor(context: Pick<FactoryGitLabRuleContext, 'actor'>): boolean {
  return context.actor.type === 'gitlab' && context.actor.trusted;
}

function createdAfterFactory(createdAt: string | undefined, factoryCreatedAt: string): boolean {
  if (!createdAt) return false;
  const sourceCreatedAt = Date.parse(createdAt);
  const projectCreatedAt = Date.parse(factoryCreatedAt);
  return Number.isFinite(sourceCreatedAt) && Number.isFinite(projectCreatedAt) && sourceCreatedAt > projectCreatedAt;
}

/** The Work card whose session authored the merge request, as opposed to the merge request's own card. */
/** The board holding the merge request's own card: Work, or Review for a card a project still keeps there. */
function mergeRequestCardBoard(context: FactoryGitLabRuleContext): 'work' | 'review' {
  return context.board === 'review' ? 'review' : 'work';
}

function mergeRequestCardNoun(context: FactoryGitLabRuleContext): string {
  return context.board === 'review' ? 'Review card' : 'merge request card';
}

function authoringCard(context: FactoryGitLabRuleContext): boolean {
  return context.board === 'work' && context.item !== undefined && !isPullRequestCard(context.item);
}

/** Whether the rule's card carries the event's merge request as one of its sources, attached to its issue. */
function attachedMergeRequest(context: FactoryGitLabRuleContext): boolean {
  const { item, mergeRequest } = context;
  if (!item || !mergeRequest || isPullRequestCard(item)) return false;
  return pullRequestSources(item).some(
    source => source.integrationId === 'gitlab' && pullRequestSourceNumber(source) === mergeRequest.number,
  );
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
      ...((context.issue.author ?? actorUsername(context))
        ? { author: context.issue.author ?? actorUsername(context) }
        : {}),
      authorTrusted: context.issue.authorTrusted,
      autoStartCandidate:
        trustedGitLabActor(context) &&
        context.issue.authorTrusted &&
        createdAfterFactory(context.issue.createdAt, context.factory.createdAt),
      assignees: context.issue.assignees ?? [],
      labels: context.issue.labels ?? [],
      labelColors: context.issue.labelColors ?? {},
    },
  } as const;
}

function issueClosed(context: FactoryGitLabRuleContext) {
  if (!context.item || context.item.source !== 'gitlab-issue') return;
  // The project's intake routes decide where a closed source sends the card. The board's
  // `sourceClosed` mapping applies only when no route on the board handles closes; without
  // one the close goes to the routes alone (see `routeEventDecision`).
  const closure = context.boardClosure;
  if (!context.board || !closure || closure.itemTerminal) return;
  // GitLab reports no close reason, so every closure counts as completed.
  return closedByRoutes(false, {
    idempotencyKey: `${context.ingress.id}:issue-closed`,
    board: context.board,
    stage: closure.completed.phase,
    message: {
      text: `GitLab issue #${context.issue?.number ?? ''} was closed; this ${closure.boardTitle} card was moved to ${closure.completed.title}.`,
    },
  });
}

function materializeMergeRequest(context: FactoryGitLabRuleContext) {
  if (!context.mergeRequest) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:merge-request-intake`,
    board: 'work',
    source: 'gitlab-pr',
    sourceKey: context.mergeRequest.sourceKey,
    title: context.mergeRequest.title,
    url: context.mergeRequest.url,
    stage: 'intake',
    // A merge request for a card already on the board is filed on that card. For one that closes
    // an issue on the board, the project's intake routes decide whether it joins that card.
    ...(context.pullRequestHome
      ? context.pullRequestHome.reason === 'closes'
        ? { closesIssue: { workItemId: context.pullRequestHome.workItemId } }
        : { attachTo: { workItemId: context.pullRequestHome.workItemId } }
      : {}),
    metadata: {
      gitlabHost: context.repository.host,
      gitlabProjectId: context.repository.id,
      gitlabMergeRequestIid: context.mergeRequest.number,
      ...(context.mergeRequest.createdAt ? { sourceCreatedAt: context.mergeRequest.createdAt } : {}),
      factoryAuthored: context.mergeRequest.factoryAuthored,
      authorTrusted: context.mergeRequest.authorTrusted,
      autoStartCandidate:
        ((trustedGitLabActor(context) && context.mergeRequest.authorTrusted) || context.mergeRequest.factoryAuthored) &&
        createdAfterFactory(context.mergeRequest.createdAt, context.factory.createdAt),
      state: context.mergeRequest.state,
      draft: context.mergeRequest.draft,
      merged: context.mergeRequest.merged,
      assignees: context.mergeRequest.assignees ?? [],
      requestedReviewers: context.mergeRequest.reviewers ?? [],
      labels: context.mergeRequest.labels ?? [],
      labelColors: context.mergeRequest.labelColors ?? {},
      headBranch: context.mergeRequest.headBranch,
      baseBranch: context.mergeRequest.baseBranch,
      ...(context.mergeRequest.author ? { author: context.mergeRequest.author } : {}),
    },
  } as const;
}

function mergeRequestUpdated(context: FactoryGitLabRuleContext) {
  if (!context.item || !reviewsPullRequest(context)) return;
  if (!context.mergeRequest || context.mergeRequest.state !== 'open' || context.mergeRequest.merged) return;
  // An issue card re-reviews only while its PR review covers this merge request.
  if (
    context.item.source !== 'gitlab-pr' &&
    !(
      attachedMergeRequest(context) &&
      context.item.stages[0] === PULL_REQUEST_REVIEW_PHASE &&
      reviewedChangeRequest(context.item)?.number === context.mergeRequest.number
    )
  )
    return;
  if (context.item.stages.some(stage => stage === 'intake')) return;
  // An untrusted push must not start review passes on demand.
  if (!trustedGitLabActor(context) && !context.mergeRequest.factoryAuthored) return;
  const stage = pullRequestReviewPhase(context.board);
  const alreadyReviewing = context.item.stages.some(current => current === stage);
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:re-review-updated`,
    board: mergeRequestCardBoard(context),
    stage,
    ...(alreadyReviewing ? { reenter: true } : {}),
  } as const;
}

function mergeRequestCommented(context: FactoryGitLabRuleContext) {
  if (!context.item || !context.mergeRequest || !context.note || !authoringCard(context)) return;
  // Someone else's merge request attached to the issue is not the builder's to fix.
  if (attachedMergeRequest(context) && !context.mergeRequest.factoryAuthored) return;
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
  if (isPullRequestCard(context.item) && reviewsPullRequest(context)) {
    return {
      type: 'transition',
      idempotencyKey: `${context.ingress.id}:merge-request-merged`,
      board: mergeRequestCardBoard(context),
      stage: 'done',
      message: {
        text: `GitLab merge request !${context.mergeRequest.number} merged; this ${mergeRequestCardNoun(context)} was moved to Done.`,
      },
    } as const;
  }
  if (context.board !== 'work') return;
  // A merge request on the card itself finishes the work, unless another one it carries is still out.
  if (attachedMergeRequest(context)) {
    const recorded = context.item.metadata?.openPullRequestNumber;
    const open =
      typeof recorded === 'number' && recorded !== context.mergeRequest.number
        ? recorded
        : newestOpenPullRequestNumber(context.item, context.mergeRequest.number);
    if (typeof open === 'number' && open !== context.mergeRequest.number) {
      return {
        type: 'sendMessage',
        idempotencyKey: `${context.ingress.id}:work-merged`,
        role: 'work',
        message:
          `GitLab merge request !${context.mergeRequest.number} merged. Merge request !${open} is still open, ` +
          'so this Work card stays where it is until it merges.',
      } as const;
    }
    return {
      type: 'transition',
      idempotencyKey: `${context.ingress.id}:work-merged`,
      board: 'work',
      stage: 'done',
      message: { text: `GitLab merge request !${context.mergeRequest.number} merged; this Work card was moved to Done.` },
    } as const;
  }
  if (!authoringCard(context)) return;
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
  if (!context.item || !context.mergeRequest || context.mergeRequest.merged || !reviewsPullRequest(context)) return;
  if (!isPullRequestCard(context.item)) {
    // An issue card waiting in PR review on its last open merge request goes back to Intake.
    if (!attachedMergeRequest(context) || context.item.stages[0] !== PULL_REQUEST_REVIEW_PHASE) return;
    if (newestOpenPullRequestNumber(context.item, context.mergeRequest.number) !== null) return;
    return {
      type: 'transition',
      idempotencyKey: `${context.ingress.id}:merge-request-closed`,
      board: 'work',
      stage: 'intake',
      message: {
        text: `GitLab merge request !${context.mergeRequest.number} was closed without merging; this card was moved back to Intake.`,
      },
    } as const;
  }
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:merge-request-closed`,
    board: mergeRequestCardBoard(context),
    stage: 'canceled',
    message: {
      text:
        `GitLab merge request !${context.mergeRequest.number} was closed without merging; ` +
        `this ${mergeRequestCardNoun(context)} was moved to Canceled.`,
    },
  } as const;
}

export const defaultGitLabRules = Object.freeze({
  issueOpened,
  // Triage runs once, when a person moves the card into Triage or starts the run; later edits and
  // comments on the issue don't run it again.
  issueUpdated: null,
  issueClosed,
  // A reopen files a card when the issue has none, as an open does. A card the issue already has
  // is left to the project's intake routes.
  issueReopened: context => (context.item ? undefined : issueOpened(context)),
  issueCommented: null,
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
  return recordExplicitRuleOverrides(Object.freeze(rules) as GitLabEventRules, overrides);
}
