import {
  isPullRequestCard,
  newestOpenPullRequestNumber,
  pullRequestSourceNumber,
  pullRequestSources,
  reviewedChangeRequest,
  reviewsPullRequest,
} from '../../boards/index.js';
import {
  closedByRoutes,
  pullRequestMoveByRoutes,
  recordExplicitRuleOverrides,
  routedOnly,
  unreviewedPullRequestCard,
} from '../../rules/event-rules.js';
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

/**
 * The card whose session authored the merge request, as opposed to the merge request's own card,
 * on a board that reviews merge requests.
 */
function authoringCard(context: FactoryGitLabRuleContext): boolean {
  return (
    context.flow?.pullRequestReview !== undefined && context.item !== undefined && !isPullRequestCard(context.item)
  );
}

/** Whether the card sits in its board's pull request review phase, alone. */
function inPullRequestReview(context: FactoryGitLabRuleContext): boolean {
  const phase = context.flow?.pullRequestReview;
  return phase !== undefined && context.item?.stages.length === 1 && context.item.stages[0] === phase;
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
  if (!context.issue || !context.intake) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-intake`,
    board: context.intake.board,
    source: 'gitlab-issue',
    sourceKey: context.issue.sourceKey,
    title: context.issue.title,
    url: context.issue.url,
    stage: context.intake.initialPhase,
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
  if (!context.mergeRequest || !context.intake) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:merge-request-intake`,
    board: context.intake.board,
    source: 'gitlab-pr',
    sourceKey: context.mergeRequest.sourceKey,
    title: context.mergeRequest.title,
    url: context.mergeRequest.url,
    stage: context.intake.initialPhase,
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
  if (!context.item || !context.board || !reviewsPullRequest(context)) return;
  if (!context.mergeRequest || context.mergeRequest.state !== 'open' || context.mergeRequest.merged) return;
  const stage = context.flow?.pullRequestReview;
  if (!stage) return;
  const reviewing = inPullRequestReview(context);
  // An issue card re-reviews only while its PR review covers this merge request.
  if (
    context.item.source !== 'gitlab-pr' &&
    !(
      attachedMergeRequest(context) &&
      reviewing &&
      reviewedChangeRequest(context.item)?.number === context.mergeRequest.number
    )
  )
    return;
  // A resting card has not started a review pass yet.
  if (context.phase?.kind === 'resting') return;
  // An untrusted push must not start review passes on demand.
  if (!trustedGitLabActor(context) && !context.mergeRequest.factoryAuthored) return;
  return pullRequestMoveByRoutes('pull_request.synchronized', {
    idempotencyKey: `${context.ingress.id}:re-review-updated`,
    board: context.board,
    stage,
    ...(reviewing ? { reenter: true } : {}),
  });
}

function mergeRequestCommented(context: FactoryGitLabRuleContext) {
  const role = context.flow?.buildRole;
  if (!context.item || !context.mergeRequest || !context.note || !authoringCard(context) || !role) return;
  // Someone else's merge request attached to the issue is not the builder's to fix.
  if (attachedMergeRequest(context) && !context.mergeRequest.factoryAuthored) return;
  if (context.mergeRequest.state !== 'open' || context.mergeRequest.merged) return;
  if (context.actor.type === 'gitlab' && context.actor.factoryAuthored) return;
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:address-merge-request-comment`,
    role,
    priority: 'high',
    message:
      `${context.note.author ?? 'Someone'} commented on GitLab merge request !${context.mergeRequest.number} ` +
      `(${context.note.url ?? context.mergeRequest.url}). Read the comment, address it if you agree, and push ` +
      'the fixes to the merge-request branch. Reply in GitLab to anything you are deliberately not changing.',
  } as const;
}

function mergeRequestMerged(context: FactoryGitLabRuleContext) {
  if (!context.item || !context.board || !context.mergeRequest?.merged) return;
  if (unreviewedPullRequestCard(context)) return routedOnly(context, 'pull_request.merged');
  const done = context.boardClosure?.completed ?? context.flow?.completed;
  if (isPullRequestCard(context.item) && reviewsPullRequest(context)) {
    if (!done) return;
    return pullRequestMoveByRoutes('pull_request.merged', {
      idempotencyKey: `${context.ingress.id}:merge-request-merged`,
      board: context.board,
      stage: done.phase,
      message: {
        text: `GitLab merge request !${context.mergeRequest.number} merged; this merge request card was moved to ${done.title}.`,
      },
    });
  }
  if (!authoringCard(context)) return;
  const role = context.flow?.buildRole;
  // A merge request on the card itself finishes the work, unless another one it carries is still out.
  if (attachedMergeRequest(context)) {
    const recorded = context.item.metadata?.openPullRequestNumber;
    const open =
      typeof recorded === 'number' && recorded !== context.mergeRequest.number
        ? recorded
        : newestOpenPullRequestNumber(context.item, context.mergeRequest.number);
    if (typeof open === 'number' && open !== context.mergeRequest.number) {
      if (!role) return;
      return {
        type: 'sendMessage',
        idempotencyKey: `${context.ingress.id}:work-merged`,
        role,
        message:
          `GitLab merge request !${context.mergeRequest.number} merged. Merge request !${open} is still open, ` +
          'so this card stays where it is until it merges.',
      } as const;
    }
    if (!done) return;
    return pullRequestMoveByRoutes('pull_request.merged', {
      idempotencyKey: `${context.ingress.id}:work-merged`,
      board: context.board,
      stage: done.phase,
      message: {
        text: `GitLab merge request !${context.mergeRequest.number} merged; this card was moved to ${done.title}.`,
      },
    });
  }
  if (!role) return;
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:assess-work-completion`,
    role,
    message:
      `GitLab merge request !${context.mergeRequest.number} merged. Assess whether the linked work item is complete. ` +
      'Do not move it to a finished phase solely because this merge request merged.',
  } as const;
}

function mergeRequestClosed(context: FactoryGitLabRuleContext) {
  if (!context.item || !context.board || !context.mergeRequest || context.mergeRequest.merged) return;
  if (unreviewedPullRequestCard(context)) return routedOnly(context, 'pull_request.closed');
  if (!reviewsPullRequest(context)) return;
  if (!isPullRequestCard(context.item)) {
    // An issue card waiting in pull request review on its last open merge request goes back to
    // where its board's cards rest.
    const initialPhase = context.flow?.initialPhase;
    if (!initialPhase || !attachedMergeRequest(context) || !inPullRequestReview(context)) return;
    if (newestOpenPullRequestNumber(context.item, context.mergeRequest.number) !== null) return;
    return pullRequestMoveByRoutes('pull_request.closed', {
      idempotencyKey: `${context.ingress.id}:merge-request-closed`,
      board: context.board,
      stage: initialPhase,
      message: {
        text: `GitLab merge request !${context.mergeRequest.number} was closed without merging; this card was moved back to ${initialPhase}.`,
      },
    });
  }
  const canceled = context.boardClosure?.canceled ?? context.flow?.canceled;
  if (!canceled) return;
  return pullRequestMoveByRoutes('pull_request.closed', {
    idempotencyKey: `${context.ingress.id}:merge-request-closed`,
    board: context.board,
    stage: canceled.phase,
    message: {
      text:
        `GitLab merge request !${context.mergeRequest.number} was closed without merging; ` +
        `this merge request card was moved to ${canceled.title}.`,
    },
  });
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
