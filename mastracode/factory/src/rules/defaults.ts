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

// A GitHub login is alphanumeric with interior hyphens — no underscores, no
// spaces. Checking the grammar rejects the placeholder the issue poller stamps
// when the reporter's account is gone (`__unknown__`), which would otherwise
// become a trailer crediting an account that does not exist.
const GITHUB_LOGIN = /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

/**
 * The reporter earns a `Co-Authored-By` trailer on the work their report caused.
 * Only a GitHub issue qualifies: Linear stamps a display name and a manual card
 * stamps nothing, and neither resolves to the GitHub identity a trailer needs.
 * Factory's own reports are skipped — crediting ourselves is noise.
 */
function reporterCoAuthor(context: FactoryStageRuleContext) {
  if (context.source !== 'issue') return undefined;
  const author = context.item.metadata?.author;
  if (typeof author !== 'string' || !author) return undefined;
  if (author.endsWith('[bot]') || !GITHUB_LOGIN.test(author)) return undefined;
  return author;
}

/**
 * Building carries a prompt rather than a skill. The approved plan is already
 * the specification, so there is nothing for a skill document to add, and the
 * handoff a skill would define is unnecessary here: Building ends by opening a
 * pull request, which arrives as its own event and raises the Review card.
 */
function buildWorkItem(context: FactoryStageRuleContext) {
  const subject = context.item.url ? `the approved plan for ${context.item.url}` : 'the approved plan';
  const reporter = reporterCoAuthor(context);
  // The trailer needs the reporter's numeric id, which intake does not stamp, so
  // the agent resolves it from the same issue it is already reading.
  const credit = reporter
    ? ` The work was reported by @${reporter}: credit them on every commit with a ` +
      `\`Co-Authored-By: ${reporter} <ID+${reporter}@users.noreply.github.com>\` trailer, ` +
      `resolving ID with \`gh api users/${reporter} --jq .id\`.`
    : '';
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:build`,
    role: 'work',
    prompt: `Implement ${subject}. Open a pull request when the work is ready for review.${credit}`,
  } as const;
}

function completeIssue(context: FactoryStageRuleContext) {
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-complete-issue`,
    role: 'triage',
    skillName: 'factory-complete-issue',
    arguments: context.item.url ? `GitHub issue (${context.item.url})` : context.item.title,
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

// Fires only on webhook materialization, so an item filed by hand or re-synced
// from source never suggests its own run.
function onArrival<Effect>(rule: (context: FactoryStageRuleContext) => Effect) {
  return (context: FactoryStageRuleContext): Effect | undefined => {
    if (context.cause !== 'linked_item_materialized') return;
    if (context.item.metadata?.autoStartCandidate !== true) return;
    return rule(context);
  };
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
  // Everything arrives in Intake; arrival only stamps whether `onArrival` may
  // suggest this card's run without a person.
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-intake`,
    board: 'work',
    source: 'github-issue',
    sourceKey: `github-issue:${context.issue.number}`,
    title: context.issue.title,
    url: context.issue.url,
    stage: 'intake',
    metadata: {
      githubRepositoryId: context.repository.id,
      githubIssueNumber: context.issue.number,
      ...(context.issue.createdAt ? { sourceCreatedAt: context.issue.createdAt } : {}),
      ...(githubActorLogin(context) ? { author: githubActorLogin(context) } : {}),
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

function materializePullRequestIntake(
  context: FactoryGithubRuleContext,
  { idempotencyKey, autoStartCandidate }: { idempotencyKey: string; autoStartCandidate: boolean },
) {
  if (!context.pullRequest) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey,
    board: 'review',
    source: 'github-pr',
    sourceKey: `github-pr:${context.pullRequest.number}`,
    title: context.pullRequest.title,
    url: context.pullRequest.url,
    stage: 'intake',
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

function addressReviewFeedback(context: FactoryGithubRuleContext) {
  if (!context.item || !context.pullRequest || !context.review) return;
  // Only the Work item that authored the PR can act on the feedback. Provenance
  // binds the event there; a Review card seeing its own posted review must not
  // react to it (that would loop the reviewer against itself).
  if (context.board !== 'work') return;
  // A closed or merged pull request has no branch left to push fixes to.
  if (context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // `approved` needs no work, and `commented` (a review body with no verdict)
  // is how a reviewer leaves notes without blocking — only a verdict that asks
  // for changes should pull the author back in.
  if (context.review.state.toLowerCase() !== 'changes_requested') return;
  // The authoring thread is already subscribed to this PR (`gh pr create`
  // subscribes automatically), so it can read the individual line comments
  // from its own notification inbox — the message only has to wake it and
  // point at the review.
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:address-review-feedback`,
    role: 'work',
    priority: 'high',
    message:
      `Changes were requested on pull request #${context.pullRequest.number} (${context.review.url}). ` +
      'Read the review comments on this PR, address the ones you agree with, and push the fixes to the PR branch. ' +
      'Reply on GitHub to anything you are deliberately not changing, explaining why.',
  } as const;
}

/**
 * Detects the `factory-review` handoff verdict in a comment body.
 *
 * GitHub forbids an app from reviewing a pull request it authored, so on
 * Factory-authored PRs the review skill falls back to posting its verdict as a
 * plain comment. That comment is the only signal the authoring agent gets, so
 * it has to be readable back out. The skill's handoff contract puts the verdict
 * on the first line (`Verdict: request changes`), so only that line is
 * inspected — a verdict quoted later in the findings must not count.
 */
function requestsChangesVerdict(body: string | undefined): boolean {
  const firstLine = body
    ?.split('\n')
    .map(line => line.trim())
    .find(line => line.length > 0);
  if (!firstLine) return false;
  // Tolerate the markdown the skill wraps the line in (`**Verdict: ...**`).
  const normalized = firstLine
    .replaceAll(/[*_`#>\s]+/g, ' ')
    .trim()
    .toLowerCase();
  // Match the verdict exactly so negated phrasings ("Verdict: do not request
  // changes") cannot wake the author.
  return /^verdict: ?(request changes|changes requested)$/.test(normalized);
}

function addressPullRequestComment(context: FactoryGithubRuleContext) {
  if (!context.item || !context.pullRequest || !context.issueComment) return;
  // Provenance binds the comment to the Work item that authored the PR — the
  // only session that can act on it. A Review card must not react to comments
  // on the PR it is reviewing.
  if (context.board !== 'work') return;
  if (context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // `factoryAuthored` is one bit for the whole Factory, so Factory's own
  // comments are indistinguishable between roles — waking on all of them would
  // let the Work agent's own progress comments wake itself in a loop. The one
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
    role: 'work',
    priority: 'high',
    message:
      `${context.issueComment.author ?? 'Someone'} commented on pull request #${context.pullRequest.number} ` +
      `(${context.issueComment.url ?? context.pullRequest.url}). Read the comment, address it if you agree, and push ` +
      'the fixes to the PR branch. Reply on GitHub to anything you are deliberately not changing, explaining why.',
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
  // Only a review requested from Factory's own bot starts a Factory review —
  // requesting a human reviewer is not Factory's signal.
  if ((context.item && context.board !== 'review') || !context.reviewRequest?.factoryReviewer) return;
  if (!context.pullRequest || context.pullRequest.state !== 'open' || context.pullRequest.merged) return;
  // Trusted (write/admin) requesters only: creating or re-entering review checks
  // out and executes PR code, the same bar pullRequestOpened applies to auto-review.
  if (!trustedGithubActor(context)) return;
  if (context.actor.type === 'github' && context.actor.factoryAuthored) return;
  if (!context.item) {
    // On this path the actor is the *requester*, so the materialized
    // `authorTrusted` stamp records their trust (always true past the gate
    // above), not the PR author's: a trusted maintainer requesting a Factory
    // review vouches for the PR.
    return materializePullRequestIntake(context, {
      idempotencyKey: `${context.ingress.id}:pull-request-review-requested-intake`,
      autoStartCandidate: true,
    });
  }
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
  // Intake has not started a review pass yet, so a push there is just more of
  // the code the first pass will read. A push to a card sitting in Reviewing is
  // different: it invalidates whatever that pass is reading, so re-enter the
  // stage to supersede it. `reviewPullRequest` cancels the stale run and picks
  // the right skill for the entry it sees.
  if (context.item.stages.some(stage => stage === 'intake')) return;
  const alreadyReviewing = context.item.stages.some(stage => stage === 'review');
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:re-review-updated`,
    board: 'review',
    stage: 'review',
    // Re-entry is the point when the card is already Reviewing: the stage's
    // entry rule is what cancels the superseded pass and starts one on the code
    // that just landed.
    ...(alreadyReviewing ? { reenter: true } : {}),
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
  work: {
    intake: { issue: { onEnter: onArrival(invokeIssueInvestigation) } },
    triage: {
      issue: { onEnter: invokeIssueInvestigation },
      linearIssue: { onEnter: investigateTriagedLinearIssue },
    },
    planning: {
      issue: { onEnter: planWorkItem },
      linearIssue: { onEnter: planWorkItem },
      manual: { onEnter: planWorkItem },
    },
    execute: {
      issue: { onEnter: buildWorkItem },
      linearIssue: { onEnter: buildWorkItem },
      manual: { onEnter: buildWorkItem },
    },
    done: {
      issue: { onEnter: completeIssue },
    },
  },
  review: {
    intake: { pullRequest: { onEnter: onArrival(reviewPullRequest) } },
    review: { pullRequest: { onEnter: reviewPullRequest } },
  },
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
    pullRequestCommentCreated: { onEvent: addressPullRequestComment },
    pullRequestReviewRequested: { onEvent: reReviewRequestedPullRequest },
    pullRequestReviewSubmitted: { onEvent: addressReviewFeedback },
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
      ...(baseLeaf && 'onEvent' in baseLeaf ? { onEvent: baseLeaf.onEvent } : {}),
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
