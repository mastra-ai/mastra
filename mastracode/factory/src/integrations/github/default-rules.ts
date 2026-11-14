import {
  isPullRequestCard,
  newestOpenPullRequestNumber,
  pullRequestSourceNumber,
  pullRequestSources,
  reviewedPullRequest,
  reviewsPullRequest,
} from '../../boards/index.js';
import { hasRecordedVerdict } from '../../boards/semantics.js';
import { requestsChangesVerdict } from '../../review-verdict.js';
import {
  closedByRoutes,
  pullRequestMoveByRoutes,
  recordExplicitRuleOverrides,
  routedOnly,
  unreviewedPullRequestCard,
} from '../../rules/event-rules.js';
import type { FactoryGithubEventName, FactoryGithubRuleContext, FactoryRuleHandler } from '../../rules/types.js';
import type { WorkItemSourceRow } from '../../storage/domains/work-items/work-item-schema.js';
import { isRepositoryPullRequest } from './pull-request-source.js';
import { isFactoryApproveVerdict } from './stale-reviews.js';

export type GithubRuleOverrides = Partial<
  Record<FactoryGithubEventName, FactoryRuleHandler<FactoryGithubRuleContext> | null | undefined>
>;
export type GithubEventRules = Readonly<
  Record<FactoryGithubEventName, FactoryRuleHandler<FactoryGithubRuleContext> | null>
>;

function trustedGithubActor(context: Pick<FactoryGithubRuleContext, 'actor'>): boolean {
  return context.actor.type === 'github' && context.actor.trusted;
}

function githubActorLogin(context: Pick<FactoryGithubRuleContext, 'actor'>): string | undefined {
  return context.actor.type === 'github' ? context.actor.login : undefined;
}

/**
 * The card whose session authored the pull request, as opposed to the PR's own card, on a board
 * that reviews pull requests.
 */
function authoringCard(context: FactoryGithubRuleContext): boolean {
  return (
    context.flow?.pullRequestReview !== undefined && context.item !== undefined && !isPullRequestCard(context.item)
  );
}

/** Whether the card sits in `selfReview` with an approve verdict on the head its pull request opened with. */
function selfReviewApprovedHead(context: FactoryGithubRuleContext, selfReview: string): boolean {
  const { item, pullRequest } = context;
  const metadata = item?.metadata;
  const approvedHead = metadata?.selfReviewedHeadSha;
  return (
    item?.stages.length === 1 &&
    item.stages[0] === selfReview &&
    metadata?.selfReviewVerdict === 'approve' &&
    typeof approvedHead === 'string' &&
    pullRequest?.headSha !== undefined &&
    approvedHead.toLowerCase() === pullRequest.headSha
  );
}

/** Whether the card sits in its board's pull request review phase, alone. */
function inPullRequestReview(context: FactoryGithubRuleContext): boolean {
  const phase = context.flow?.pullRequestReview;
  return phase !== undefined && context.item?.stages.length === 1 && context.item.stages[0] === phase;
}

/** Whether the rule's card carries the event's pull request as one of its sources, attached to its issue. */
function attachedPullRequest(context: FactoryGithubRuleContext): boolean {
  const { item, pullRequest } = context;
  if (!item || !pullRequest || isPullRequestCard(item)) return false;
  return pullRequestSources(item).some(source => isEventPullRequest(context, source));
}

/** Whether a source row is the event's pull request: the same number in the same repository. */
function isEventPullRequest(context: FactoryGithubRuleContext, source: WorkItemSourceRow): boolean {
  return (
    context.pullRequest !== undefined &&
    isRepositoryPullRequest(source, context.repository.id, context.repository.fullName, context.pullRequest.number)
  );
}

/** Whether the card's PR review covers the event's pull request: its own, or the attached one it reviews. */
function reviewsThisPullRequest(context: FactoryGithubRuleContext): boolean {
  if (!context.item || !context.pullRequest || !reviewsPullRequest(context)) return false;
  if (isPullRequestCard(context.item)) return true;
  const reviewed = reviewedPullRequest(context.item);
  return reviewed !== undefined && isEventPullRequest(context, reviewed);
}

function createdAfterFactory(createdAt: string | undefined, factoryCreatedAt: string): boolean {
  if (!createdAt) return false;
  const sourceCreatedAt = Date.parse(createdAt);
  const projectCreatedAt = Date.parse(factoryCreatedAt);
  return Number.isFinite(sourceCreatedAt) && Number.isFinite(projectCreatedAt) && sourceCreatedAt > projectCreatedAt;
}

/**
 * Issue and pull request numbers repeat across repositories, so new cards are
 * keyed by repository. A card this repository already owns keeps its key —
 * including canonical `github-issue:N` / `github-pr:N` keys from before
 * scoping — but only when it is the same kind of source: pull request intake
 * runs with the authoring issue as `context.item`.
 */
function githubSourceKey(
  context: FactoryGithubRuleContext,
  source: 'github-issue' | 'github-pr',
  itemNumber: number,
): string {
  if (context.item?.source === source && context.item.sourceKey) return context.item.sourceKey;
  return `github:${context.repository.id}:${source === 'github-issue' ? 'issue' : 'pull-request'}:${itemNumber}`;
}

function issueOpened(context: FactoryGithubRuleContext) {
  if (!context.issue || !context.intake) return;
  // Everything arrives on the default board's initial phase; the project's intake routes place
  // the card from there. Trust/timing stamps remain available to custom board rules.
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-intake`,
    board: context.intake.board,
    source: 'github-issue',
    sourceKey: githubSourceKey(context, 'github-issue', context.issue.number),
    title: context.issue.title,
    url: context.issue.url,
    stage: context.intake.initialPhase,
    metadata: {
      githubRepositoryId: context.repository.id,
      githubIssueNumber: context.issue.number,
      ...(context.issue.createdAt ? { sourceCreatedAt: context.issue.createdAt } : {}),
      ...(context.issue.author || githubActorLogin(context)
        ? { author: context.issue.author ?? githubActorLogin(context) }
        : {}),
      state: context.issue.state ?? 'open',
      authorTrusted: trustedGithubActor(context),
      autoStartCandidate:
        trustedGithubActor(context) && createdAfterFactory(context.issue.createdAt, context.factory.createdAt),
      assignees: context.issue.assignees ?? [],
      labels: context.issue.labels ?? [],
    },
  } as const;
}

function issueClosed(context: FactoryGithubRuleContext) {
  if (!context.item || context.item.source !== 'github-issue' || !context.issue) return;
  // The project's intake routes decide where a closed source sends the card. The board's
  // `sourceClosed` mapping applies only when no route on the board handles closes; without
  // one the close goes to the routes alone (see `routeEventDecision`).
  const closure = context.boardClosure;
  if (!context.board || !closure || closure.itemTerminal) return;
  // Issue closure is a repository fact, not third-party input — no actor trust
  // gate. `not_planned` (and `duplicate`) means abandoned, everything else is
  // completed work.
  const canceled = context.issue.stateReason === 'not_planned' || context.issue.stateReason === 'duplicate';
  const target = canceled ? closure.canceled : closure.completed;
  return closedByRoutes(canceled, {
    idempotencyKey: `${context.ingress.id}:issue-closed`,
    board: context.board,
    stage: target.phase,
    message: {
      text:
        `GitHub issue #${context.issue.number} was closed` +
        `${context.issue.stateReason ? ` (${context.issue.stateReason})` : ''}; ` +
        `this ${closure.boardTitle} card was moved to ${target.title}.`,
    },
  });
}

function materializePullRequestIntake(
  context: FactoryGithubRuleContext,
  { idempotencyKey, autoStartCandidate }: { idempotencyKey: string; autoStartCandidate: boolean },
) {
  const { intake } = context;
  if (!context.pullRequest || !intake) return;
  const home = context.pullRequestHome;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey,
    board: intake.board,
    source: 'github-pr',
    sourceKey: githubSourceKey(context, 'github-pr', context.pullRequest.number),
    title: context.pullRequest.title,
    url: context.pullRequest.url,
    stage: intake.initialPhase,
    // A pull request for a card already on the board is filed on that card; the authoring card's
    // own evaluation moves it. For one that closes an issue on the board, the project's intake
    // routes decide whether it joins that card.
    ...(home
      ? home.reason === 'closes'
        ? { closesIssue: { workItemId: home.workItemId } }
        : { attachTo: { workItemId: home.workItemId } }
      : {}),
    metadata: {
      githubRepositoryId: context.repository.id,
      githubPullRequestNumber: context.pullRequest.number,
      ...(context.pullRequest.createdAt ? { sourceCreatedAt: context.pullRequest.createdAt } : {}),
      factoryAuthored: context.pullRequest.factoryAuthored,
      authorTrusted: trustedGithubActor(context),
      autoStartCandidate,
      state: context.pullRequest.state,
      draft: context.pullRequest.draft,
      merged: context.pullRequest.merged,
      assignees: context.pullRequest.assignees ?? [],
      requestedReviewers: context.pullRequest.requestedReviewers ?? [],
      labels: context.pullRequest.labels ?? [],
      headBranch: context.pullRequest.headBranch,
      baseBranch: context.pullRequest.baseBranch,
      ...(context.pullRequest.author ? { author: context.pullRequest.author } : {}),
    },
  } as const;
}

function pullRequestOpened(context: FactoryGithubRuleContext) {
  if (!context.pullRequest) return;
  // Opening a pull request is evaluated once per card it concerns. This rule
  // files the pull request's own card, which is the arrival — the
  // evaluation carrying `pullRequestIntake` — so the authoring card's own
  // evaluation only moves it out for review: from its build phase (a board
  // without self-review, or a pull request opened before self-review ran), or
  // from self-review once it approved the very head the pull request opens
  // with. Opening the pull request writes it onto the card, so the agent's own
  // move at its pre-PR revision always loses that race; the event moves the
  // card instead. It rests in the board's pull request review phase through
  // every round of feedback — the builder is woken in place — until the merge
  // closes it.
  if (context.item && context.pullRequestIntake !== true) {
    if (!authoringCard(context) || context.pullRequest.state !== 'open') return;
    const { build, selfReview, pullRequestReview } = context.flow ?? {};
    if (!context.board || !build || !pullRequestReview) return;
    if (!context.item.stages.includes(build) && !(selfReview && selfReviewApprovedHead(context, selfReview))) return;
    // Someone else's pull request attached to the issue does not mean this card's build is out.
    if (attachedPullRequest(context) && !context.pullRequest.factoryAuthored) return;
    // Resolution can match a card by branch alone, so a fork's pull
    // request must not be able to move it: same bar as auto-starting a review.
    if (!trustedGithubActor(context) && !context.pullRequest.factoryAuthored) return;
    return pullRequestMoveByRoutes('pull_request.opened', {
      idempotencyKey: `${context.ingress.id}:out-for-review`,
      board: context.board,
      stage: pullRequestReview,
    });
  }
  // A GitHub App bot is never a collaborator, so Factory's own PRs score
  // untrusted; their authorship is the trust signal.
  const autoStartCandidate =
    (trustedGithubActor(context) || context.pullRequest.factoryAuthored) &&
    createdAfterFactory(context.pullRequest.createdAt, context.factory.createdAt);
  return materializePullRequestIntake(context, {
    idempotencyKey: `${context.ingress.id}:pull-request-intake`,
    autoStartCandidate,
  });
}

function pullRequestMerged(context: FactoryGithubRuleContext) {
  if (!context.item || !context.board || !context.pullRequest?.merged) return;
  if (unreviewedPullRequestCard(context)) return routedOnly(context, 'pull_request.merged');
  const done = context.boardClosure?.completed ?? context.flow?.completed;
  if (!done) return;
  if (isPullRequestCard(context.item) && reviewsPullRequest(context)) {
    // The event is bound to the PR's own card: a merged PR is finished
    // review work, so always move the card to its board's completed phase. The
    // message only reaches an active session (if any) — cards without one just
    // move, instead of failing retries against a binding that never existed.
    return pullRequestMoveByRoutes('pull_request.merged', {
      idempotencyKey: `${context.ingress.id}:pull-request-merged`,
      board: context.board,
      stage: done.phase,
      message: {
        text:
          `Pull request #${context.pullRequest.number} merged; this pull request card was moved to ${done.title}. ` +
          'No further review is needed unless follow-up work was requested.',
      },
    });
  }
  if (!authoringCard(context)) return;
  // Provenance bound the event to the card that authored the pull request instead: the merge
  // is what finishes the work, so it closes that card alongside the PR's own card —
  // unless the card has since opened another pull request, which is still out.
  // A card carrying several pull requests waits for the one it has out, else for any still open.
  const recorded = context.item.metadata?.openPullRequestNumber;
  const openPullRequestNumber =
    typeof recorded === 'number'
      ? recorded
      : newestOpenPullRequestNumber(context.item, context.pullRequest.number);
  if (typeof openPullRequestNumber === 'number' && openPullRequestNumber !== context.pullRequest.number) {
    const role = context.flow?.buildRole;
    if (!role) return;
    return {
      type: 'sendMessage',
      idempotencyKey: `${context.ingress.id}:work-merged`,
      role,
      message:
        `Pull request #${context.pullRequest.number} merged. Pull request #${openPullRequestNumber} is still open, ` +
        'so this card stays where it is until it merges.',
    } as const;
  }
  return pullRequestMoveByRoutes('pull_request.merged', {
    idempotencyKey: `${context.ingress.id}:work-merged`,
    board: context.board,
    stage: done.phase,
    message: { text: `Pull request #${context.pullRequest.number} merged; this card was moved to ${done.title}.` },
  });
}

function addressReviewFeedback(context: FactoryGithubRuleContext) {
  if (!context.item || !context.pullRequest || !context.review) return;
  // Only the card that authored the PR can act on the feedback. Provenance
  // binds the event there; the PR's own card seeing its posted review must not
  // react to it (that would loop the reviewer against itself).
  const role = context.flow?.buildRole;
  if (!authoringCard(context) || !role) return;
  // Someone else's pull request attached to the issue is not the builder's to fix.
  if (attachedPullRequest(context) && !context.pullRequest.factoryAuthored) return;
  // A closed or merged pull request has no branch left to push fixes to.
  if (context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // `approved` needs no work, and `commented` is how a reviewer leaves notes
  // without blocking — only a verdict that asks for changes should pull the
  // author back in. GitHub will not let Factory's app request changes on a pull
  // request it authored, so there Factory's own `commented` review carries the
  // verdict on its first line instead; that one counts too.
  const state = context.review.state.toLowerCase();
  const factoryVerdict =
    state === 'commented' &&
    context.actor.type === 'github' &&
    context.actor.factoryAuthored &&
    context.pullRequest.factoryAuthored &&
    requestsChangesVerdict(context.review.body);
  if (state !== 'changes_requested' && !factoryVerdict) return;
  // The authoring thread is already subscribed to this PR (`gh pr create`
  // subscribes automatically), so it can read the individual line comments
  // from its own notification inbox — the message only has to wake it and
  // point at the review.
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:address-review-feedback`,
    role,
    priority: 'high',
    message:
      `Changes were requested on pull request #${context.pullRequest.number} (${context.review.url}). ` +
      'Read the review comments on this PR, address the ones you agree with, and push the fixes to the PR branch. ' +
      'Reply on GitHub to anything you are deliberately not changing, explaining why.',
  } as const;
}

/**
 * A Factory approval does not clear a change request left by a different
 * Factory identity (an earlier reviewer token, say), so GitHub would keep the
 * pull request blocked. Ask the dispatcher to dismiss those superseded reviews.
 */
function dismissStaleFactoryReviews(context: FactoryGithubRuleContext) {
  const { pullRequest, review, repository } = context;
  if (!pullRequest || !review || !review.author || !repository.installationId) return;
  if (review.state.toLowerCase() !== 'approved' || !isFactoryApproveVerdict(review.body)) return;
  if (!pullRequest.factoryAuthored || pullRequest.state !== 'open' || pullRequest.merged) return;
  return {
    type: 'dismissStaleReviews',
    idempotencyKey: `${context.ingress.id}:dismiss-stale-reviews`,
    installationId: repository.installationId,
    repository: repository.fullName,
    pullRequestNumber: pullRequest.number,
    approvingReviewId: String(review.id),
    approvingAuthor: review.author,
  } as const;
}

function pullRequestReviewSubmitted(context: FactoryGithubRuleContext) {
  return addressReviewFeedback(context) ?? dismissStaleFactoryReviews(context);
}

function addressPullRequestComment(context: FactoryGithubRuleContext) {
  // A validated Factory mention is a review-entry request, not feedback for the
  // authoring session. Invalid or unrecognized comments retain the normal
  // feedback route below.
  if (context.reviewCommand) return reReviewRequestedPullRequest(context);
  if (!context.item || !context.pullRequest || !context.issueComment) return;
  // Provenance binds the comment to the card that authored the PR — the
  // only session that can act on it. The PR's own card must not react to
  // comments on the PR it is reviewing.
  const role = context.flow?.buildRole;
  if (!authoringCard(context) || !role) return;
  if (attachedPullRequest(context) && !context.pullRequest.factoryAuthored) return;
  if (context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // `factoryAuthored` is one bit for the whole Factory, so Factory's own
  // comments are indistinguishable between roles — waking on all of them would
  // let the builder's own progress comments wake itself in a loop. The one
  // exception is the review verdict the Review run had to post as a comment
  // because GitHub refused a self-review: that is the handoff, and it only ever
  // asks for changes once per review, so it cannot sustain a loop.
  if (
    context.actor.type === 'github' &&
    context.actor.factoryAuthored &&
    !requestsChangesVerdict(context.issueComment.body)
  ) {
    return;
  }
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:address-pull-request-comment`,
    role,
    priority: 'high',
    message:
      `${context.issueComment.author ?? 'Someone'} commented on pull request #${context.pullRequest.number} ` +
      `(${context.issueComment.url ?? context.pullRequest.url}). Read the comment, address it if you agree, and push ` +
      'the fixes to the PR branch. Reply on GitHub to anything you are deliberately not changing, explaining why.',
  } as const;
}

function pullRequestClosed(context: FactoryGithubRuleContext) {
  if (!context.item || !context.board || !context.pullRequest || context.pullRequest.merged) return;
  if (unreviewedPullRequestCard(context)) return routedOnly(context, 'pull_request.closed');
  if (!reviewsPullRequest(context)) return;
  if (!isPullRequestCard(context.item)) {
    // An issue card waiting in pull request review on its last open pull request goes back to
    // where its board's cards rest; the issue is still open, and another pull request keeps the
    // review going.
    const initialPhase = context.flow?.initialPhase;
    if (!initialPhase || !attachedPullRequest(context) || !inPullRequestReview(context)) return;
    if (newestOpenPullRequestNumber(context.item, context.pullRequest.number) !== null) return;
    return pullRequestMoveByRoutes('pull_request.closed', {
      idempotencyKey: `${context.ingress.id}:pull-request-closed`,
      board: context.board,
      stage: initialPhase,
      message: {
        text: `Pull request #${context.pullRequest.number} was closed without merging; this card was moved back to ${initialPhase}.`,
      },
    });
  }
  // A PR closed without merging is abandoned review work: clear the card off
  // the board instead of leaving it in review forever.
  const canceled = context.boardClosure?.canceled ?? context.flow?.canceled;
  if (!canceled) return;
  return pullRequestMoveByRoutes('pull_request.closed', {
    idempotencyKey: `${context.ingress.id}:pull-request-closed`,
    board: context.board,
    stage: canceled.phase,
    message: {
      text:
        `Pull request #${context.pullRequest.number} was closed without merging; ` +
        `this pull request card was moved to ${canceled.title}.`,
    },
  });
}

function reReviewRequestedPullRequest(context: FactoryGithubRuleContext) {
  // GitHub reviewer requests and Factory's exact mention command are both
  // explicit requests to enter the same Review lifecycle.
  const factoryReviewEntry = context.reviewRequest?.factoryReviewer || context.reviewCommand !== undefined;
  if ((context.item && !reviewsPullRequest(context)) || !factoryReviewEntry) return;
  if (!context.pullRequest || context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // Trusted (write/admin) requesters only: creating or re-entering review checks
  // out and executes PR code, the same bar pullRequestOpened applies to auto-review.
  if (!trustedGithubActor(context)) return;
  if (context.actor.type === 'github' && context.actor.factoryAuthored) return;
  if (!context.item) {
    // On this path the actor is the *requester*, so the materialized
    // `authorTrusted` stamp records their trust (always true past the gate
    // above), not the PR author's: a trusted maintainer requesting a Factory
    // review vouches for the PR, so the project's pull request route sends it to review.
    return materializePullRequestIntake(context, {
      idempotencyKey: `${context.ingress.id}:pull-request-review-requested-intake`,
      autoStartCandidate: true,
    });
  }
  // Already in review with no verdict yet: a pass is pending or running.
  // Once a verdict is recorded the card rests in review, so a fresh request
  // re-enters the phase to start another pass.
  const stage = context.flow?.pullRequestReview;
  if (!context.board || !stage) return;
  const reviewing = inPullRequestReview(context);
  // On an issue card the pass reviews one pull request at a time; a request for another
  // waits until that one is reviewed or settled.
  if (reviewing && !reviewsThisPullRequest(context)) return;
  if (reviewing && !hasRecordedVerdict(context.item)) return;
  return pullRequestMoveByRoutes('pull_request.review_requested', {
    idempotencyKey: `${context.ingress.id}:re-review-requested`,
    board: context.board,
    stage,
    ...(reviewing ? { reenter: true } : {}),
  });
}

function reReviewUpdatedPullRequest(context: FactoryGithubRuleContext) {
  if (!context.item || !context.board || !reviewsPullRequest(context)) return;
  if (!context.pullRequest || context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  const stage = context.flow?.pullRequestReview;
  if (!stage) return;
  const reviewing = inPullRequestReview(context);
  // An issue card re-reviews only while its PR review covers this pull request: a push to the
  // builder's own pull request while it builds or self-reviews is the build, not a review cue.
  if (!isPullRequestCard(context.item) && !(reviewing && reviewsThisPullRequest(context))) return;
  // A resting card has not started a review pass yet, so a push there is just
  // more of the code the first pass will read. A push to a card sitting in
  // review is different: it invalidates whatever that pass is reading, so
  // re-enter the phase to supersede it. The phase runner cancels the stale run
  // and the review skill picks the right skill for the entry it sees.
  if (context.phase?.kind === 'resting') return;
  // A fork's author controls its head branch, so an untrusted push must not be
  // able to start review passes on demand; a maintainer can still request one.
  if (!trustedGithubActor(context) && !context.pullRequest.factoryAuthored) return;
  return pullRequestMoveByRoutes('pull_request.synchronized', {
    idempotencyKey: `${context.ingress.id}:re-review-updated`,
    board: context.board,
    stage,
    // Re-entry is the point when the card is already in review: the phase's
    // entry rule is what cancels the superseded pass and starts one on the code
    // that just landed.
    ...(reviewing ? { reenter: true } : {}),
  });
}

export const defaultGithubRules = Object.freeze({
  issueOpened: issueOpened,
  // Triage runs once, when a person moves the card into Triage or starts the run; later edits and
  // comments on the issue don't run it again.
  issueEdited: null,
  issueClosed: issueClosed,
  // A reopened issue with no card is filed the way a new one is; one with a card goes to its routes.
  issueReopened: context => (context.item ? undefined : issueOpened(context)),
  issueCommentCreated: null,
  issueCommentEdited: null,
  issueCommentDeleted: null,
  pullRequestOpened: pullRequestOpened,
  pullRequestUpdated: reReviewUpdatedPullRequest,
  pullRequestCommentCreated: addressPullRequestComment,
  pullRequestReviewRequested: reReviewRequestedPullRequest,
  pullRequestReviewSubmitted: pullRequestReviewSubmitted,
  pullRequestMerged: pullRequestMerged,
  pullRequestClosed: pullRequestClosed,
  // A reopened pull request moves a card only where a route on its board names `pull_request.reopened`.
  pullRequestReopened: null,
} satisfies GithubEventRules);

export function resolveGithubRules(overrides?: GithubRuleOverrides): GithubEventRules {
  if (overrides !== undefined && (overrides === null || typeof overrides !== 'object' || Array.isArray(overrides))) {
    throw new Error('GitHub rules must be an object.');
  }
  const rules: Record<string, FactoryRuleHandler<FactoryGithubRuleContext> | null> = { ...defaultGithubRules };
  for (const key of Reflect.ownKeys(overrides ?? {})) {
    if (typeof key !== 'string' || !Object.hasOwn(defaultGithubRules, key)) {
      throw new Error(`Unknown GitHub rule event: ${String(key)}.`);
    }
    const handler = overrides?.[key as FactoryGithubEventName];
    if (handler !== undefined && handler !== null && typeof handler !== 'function') {
      throw new Error(`GitHub rule ${key} must be a function, null, or undefined.`);
    }
    if (handler !== undefined) rules[key] = handler;
  }
  return recordExplicitRuleOverrides(Object.freeze(rules) as GithubEventRules, overrides);
}
