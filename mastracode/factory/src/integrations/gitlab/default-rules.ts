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

/** Metadata every GitLab card carries, so later rules and skills need no refetch. */
function issueMetadata(context: FactoryGitlabRuleContext) {
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
  if (context.item) return;
  return {
    type: 'upsertLinkedWorkItem',
    idempotencyKey: `${context.ingress.id}:issue-triage`,
    // A source bound to a custom board lands on that board's initial phase;
    // otherwise Work auto-triages the new issue.
    board: context.intake?.board ?? 'work',
    source: 'gitlab-issue',
    sourceKey: context.issue.ref,
    title: `${context.project.pathWithNamespace}#${context.issue.iid}: ${context.issue.title}`,
    url: context.issue.url,
    stage: context.intake?.initialPhase ?? 'triage',
    metadata: issueMetadata(context),
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

export const defaultGitlabRules = Object.freeze({
  issueOpened: gitlabIssueOpened,
  issueEdited: gitlabIssueEdited,
  issueClosed: gitlabIssueClosed,
  issueNoteCreated: gitlabIssueNoteCreated,
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
