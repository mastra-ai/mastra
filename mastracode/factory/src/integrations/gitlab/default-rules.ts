/**
 * Default GitLab rules — what a webhook delivery does to the board.
 *
 * Deliberately narrower than GitHub's rule set and shaped after Linear's: a new
 * issue materializes a Work card, a closed issue retires it, and a note wakes
 * the card's live session. Overriding a handler with `null` disables it without
 * having to re-declare the rest.
 */
import type { FactoryGitlabEventName, FactoryGitlabRuleContext, FactoryRuleHandler } from '../../rules/types.js';

export type GitlabRuleOverrides = Partial<
  Record<FactoryGitlabEventName, FactoryRuleHandler<FactoryGitlabRuleContext> | null | undefined>
>;
export type GitlabEventRules = Readonly<
  Record<FactoryGitlabEventName, FactoryRuleHandler<FactoryGitlabRuleContext> | null>
>;

/** Metadata every GitLab issue card carries, so later rules and skills need no refetch. */
function issueMetadata(context: FactoryGitlabRuleContext & { issue: NonNullable<FactoryGitlabRuleContext['issue']> }) {
  return {
    gitlabProjectId: context.project.id,
    gitlabProjectPath: context.project.pathWithNamespace,
    iid: context.issue.iid,
    gitlabState: context.issue.state,
    gitlabStateType: context.issue.stateType,
    sourceCreatedAt: context.issue.createdAt ?? null,
    labels: [...(context.issue.labels ?? [])] as string[],
    assignees: [...(context.issue.assignees ?? [])] as string[],
    ...(context.issue.author ? { author: context.issue.author } : {}),
  };
}

function gitlabIssueOpened(context: FactoryGitlabRuleContext) {
  if (!context.issue) return;
  if (context.item) return;
  const issue = context.issue;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-triage`,
    // A source bound to a custom board lands on that board's initial phase;
    // otherwise Work auto-triages the new issue.
    board: context.intake?.board ?? 'work',
    source: 'gitlab-issue',
    sourceKey: issue.ref,
    title: `${context.project.pathWithNamespace}#${issue.iid}: ${issue.title}`,
    url: issue.url,
    stage: context.intake?.initialPhase ?? 'triage',
    metadata: issueMetadata({ ...context, issue }),
  } as const;
}

/**
 * An edit re-triages the card, matching `retriageGithubIssue`. It must not
 * create one: a card closed and cleared off the board would otherwise be
 * resurrected by an unrelated title tweak.
 *
 * Not an `upsertLinkedWorkItem`: the dispatcher's upsert is fill-only for a
 * card that already exists (see `#upsertLinkedItem`), so an edit expressed as
 * an upsert would silently do nothing. Re-triage is also the truthful response
 * — a changed issue body can change the diagnosis, not just the title.
 */
function gitlabIssueEdited(context: FactoryGitlabRuleContext) {
  if (!context.issue) return;
  if (!context.item || context.item.source !== 'gitlab-issue') return;
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  return {
    type: 'invokeSkill',
    idempotencyKey: `${context.ingress.id}:factory-triage`,
    role: 'triage',
    skillName: 'factory-triage',
    arguments: `Re-triage GitLab issue ${context.project.pathWithNamespace}#${context.issue.iid} (${context.issue.url}) after it was edited.`,
  } as const;
}

function gitlabIssueClosed(context: FactoryGitlabRuleContext) {
  if (!context.issue) return;
  if (!context.item || context.item.source !== 'gitlab-issue') return;
  if (context.board !== 'work') return;
  // Already off the board: nothing to reconcile.
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:issue-closed`,
    board: 'work',
    // GitLab has a single `closed` state with no not-planned variant, so a
    // close is reported as completed work rather than guessed at.
    stage: 'done',
    message: {
      text: `GitLab issue ${context.project.pathWithNamespace}#${context.issue.iid} was closed; this Work card was moved to Done.`,
    },
  } as const;
}

/**
 * A human comment is the signal an agent working the card should see. Delivered
 * as a message rather than a transition: it informs the run in flight, and
 * `idleBehavior: 'persist'` keeps it from waking a card nobody is working.
 */
function gitlabIssueNoteCreated(context: FactoryGitlabRuleContext) {
  if (!context.issue) return;
  if (!context.item || context.item.source !== 'gitlab-issue') return;
  if (!context.issueNote?.body) return;
  // Factory's own handoff note would otherwise be delivered straight back to
  // the run that wrote it.
  if (context.issueNote.factoryAuthored) return;
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  const author = context.issueNote.author ?? 'someone';
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:note-${context.issueNote.id}`,
    message: `New comment from ${author} on GitLab issue ${context.project.pathWithNamespace}#${context.issue.iid}:\n\n${context.issueNote.body}`,
    idleBehavior: 'persist',
  } as const;
}

/** Metadata every GitLab merge-request card carries — the review board's vocabulary. */
function mergeRequestMetadata(
  context: FactoryGitlabRuleContext & { mergeRequest: NonNullable<FactoryGitlabRuleContext['mergeRequest']> },
) {
  const mr = context.mergeRequest;
  return {
    gitlabProjectId: context.project.id,
    gitlabProjectPath: context.project.pathWithNamespace,
    iid: mr.iid,
    state: mr.state,
    merged: mr.merged,
    draft: mr.draft,
    // Named as the review board names them, so `checkoutHint` reads one
    // vocabulary regardless of which provider opened the card.
    headBranch: mr.headBranch,
    baseBranch: mr.baseBranch,
    factoryAuthored: mr.factoryAuthored,
    sourceCreatedAt: mr.createdAt ?? null,
    labels: [...(mr.labels ?? [])] as string[],
    assignees: [...(mr.assignees ?? [])] as string[],
    requestedReviewers: [...(mr.reviewers ?? [])] as string[],
    ...(mr.author ? { author: mr.author } : {}),
  };
}

/**
 * A new merge request materializes a Review card.
 *
 * `autoStartCandidate` is narrower than GitHub's: that rule can ask the API
 * whether the author has write access, and GitLab's webhook payload carries no
 * equivalent. Factory's own authorship is the one trust signal available
 * without a second round trip, so only Factory-authored MRs auto-start; a
 * human's MR lands in Intake and waits to be picked up. Failing closed here
 * costs a manual start, where failing open would let any fork's MR start an
 * autonomous session.
 */
function gitlabMergeRequestOpened(context: FactoryGitlabRuleContext) {
  if (!context.mergeRequest) return;
  if (context.item) return;
  const mr = context.mergeRequest;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:merge-request-intake`,
    board: 'review',
    source: 'gitlab-mr',
    sourceKey: mr.ref,
    title: `${context.project.pathWithNamespace}!${mr.iid}: ${mr.title}`,
    url: mr.url,
    stage: 'intake',
    metadata: { ...mergeRequestMetadata({ ...context, mergeRequest: mr }), autoStartCandidate: mr.factoryAuthored },
  } as const;
}

/**
 * A merged MR is finished review work. Mirrors `pullRequestMerged`: on the MR's
 * own Review card it moves to Done; bound to the Work item that authored it, it
 * asks that agent to assess completion rather than completing it outright.
 */
function gitlabMergeRequestMerged(context: FactoryGitlabRuleContext) {
  if (!context.item || !context.mergeRequest?.merged) return;
  const ref = `${context.project.pathWithNamespace}!${context.mergeRequest.iid}`;
  if (context.board === 'review') {
    if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
    return {
      type: 'transition',
      idempotencyKey: `${context.ingress.id}:merge-request-merged`,
      board: 'review',
      stage: 'done',
      message: {
        text:
          `Merge request ${ref} was merged; this Review card was moved to Done. ` +
          'No further review is needed unless follow-up work was requested.',
      },
    } as const;
  }
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:assess-work-completion`,
    role: 'work',
    message:
      `Merge request ${ref} was merged. Assess whether the linked Work item is complete. ` +
      'Do not mark it Done solely because this merge request merged; use factory_transition_work_item only after verifying the work.',
  } as const;
}

/** A closed-without-merge MR retires its Review card; the work was abandoned, not finished. */
function gitlabMergeRequestClosed(context: FactoryGitlabRuleContext) {
  if (!context.item || !context.mergeRequest) return;
  if (context.mergeRequest.merged) return;
  if (context.board !== 'review') return;
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:merge-request-closed`,
    board: 'review',
    stage: 'canceled',
    message: {
      text: `Merge request ${context.project.pathWithNamespace}!${context.mergeRequest.iid} was closed without merging; this Review card was canceled.`,
    },
  } as const;
}

/**
 * GitLab collapses every MR change into one `update` action — a new commit, a
 * title edit, and a reviewer assignment are indistinguishable in the payload.
 * Only a push should pull a reviewer back in, and `oldrev` is the one field
 * that marks one: GitLab sets it only when the head moved.
 */
function gitlabMergeRequestUpdated(context: FactoryGitlabRuleContext) {
  if (!context.item || !context.mergeRequest) return;
  if (context.board !== 'review') return;
  if (context.mergeRequest.merged || context.mergeRequest.state !== 'open') return;
  // A title edit or label change is not new code to review.
  if (!context.mergeRequest.headChanged) return;
  // A push to a card whose pass has not started is just more of the code the
  // first pass will read. A card mid-pass is different: the push invalidates
  // whatever that pass is reading, so the stage has to be re-entered to
  // supersede it. A card that finished its pass re-enters Review through the
  // board's `updated` outcome, which routes it to the re-review skill.
  const alreadyReviewing = context.item.stages.some(stage => stage === 'review');
  if (!alreadyReviewing && !context.item.stages.some(stage => stage === 'done')) return;
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:merge-request-updated`,
    board: 'review',
    stage: 'review',
    message: {
      text: `Merge request ${context.project.pathWithNamespace}!${context.mergeRequest.iid} was updated after review; re-reviewing.`,
    },
    // Re-entry is the point when the card is already Reviewing: without it a
    // same-stage transition is inert (resolve.ts resolves it to zero rules), so
    // the entry rule never fires and the stale pass is never canceled.
    ...(alreadyReviewing ? { reenter: true } : {}),
  } as const;
}

/** A human note on the MR wakes the card's live session, like its issue counterpart. */
function gitlabMergeRequestNoteCreated(context: FactoryGitlabRuleContext) {
  if (!context.item || !context.mergeRequest) return;
  if (!context.mergeRequestNote?.body) return;
  if (context.mergeRequestNote.factoryAuthored) return;
  if (context.item.stages.some(stage => stage === 'done' || stage === 'canceled')) return;
  const author = context.mergeRequestNote.author ?? 'someone';
  return {
    type: 'sendMessage',
    idempotencyKey: `${context.ingress.id}:mr-note-${context.mergeRequestNote.id}`,
    message: `New comment from ${author} on merge request ${context.project.pathWithNamespace}!${context.mergeRequest.iid}:\n\n${context.mergeRequestNote.body}`,
    idleBehavior: 'persist',
  } as const;
}

export const defaultGitlabRules = Object.freeze({
  issueOpened: gitlabIssueOpened,
  issueEdited: gitlabIssueEdited,
  issueClosed: gitlabIssueClosed,
  issueNoteCreated: gitlabIssueNoteCreated,
  mergeRequestOpened: gitlabMergeRequestOpened,
  mergeRequestUpdated: gitlabMergeRequestUpdated,
  mergeRequestMerged: gitlabMergeRequestMerged,
  mergeRequestClosed: gitlabMergeRequestClosed,
  mergeRequestNoteCreated: gitlabMergeRequestNoteCreated,
} satisfies GitlabEventRules);

export function resolveGitlabRules(overrides?: GitlabRuleOverrides): GitlabEventRules {
  if (
    overrides !== undefined &&
    (overrides === null ||
      typeof overrides !== 'object' ||
      Array.isArray(overrides) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(overrides)))
  ) {
    throw new Error('GitLab rules must be a plain object.');
  }
  const rules: Record<string, FactoryRuleHandler<FactoryGitlabRuleContext> | null> = { ...defaultGitlabRules };
  for (const key of Reflect.ownKeys(overrides ?? {})) {
    if (typeof key !== 'string' || !Object.hasOwn(defaultGitlabRules, key)) {
      throw new Error(`Unknown GitLab rule event: ${String(key)}.`);
    }
    const handler = overrides?.[key as FactoryGitlabEventName];
    if (handler !== undefined && handler !== null && typeof handler !== 'function') {
      throw new Error(`GitLab rule ${key} must be a function, null, or undefined.`);
    }
    if (handler !== undefined) rules[key] = handler;
  }
  return Object.freeze(rules) as GitlabEventRules;
}
