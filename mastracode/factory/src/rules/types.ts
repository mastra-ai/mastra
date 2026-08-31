import type { ExternalWorkItemSource } from '../storage/domains/work-items/base.js';

export type WorkItemSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'manual';

export function workItemSource(source: ExternalWorkItemSource | null): WorkItemSource {
  if (!source) return 'manual';
  if (source.integrationId === 'linear') return 'linear-issue';
  // Only GitHub and Linear have provider-specific rules; anything else (a Slack
  // thread, say) is a plain work item, not a mislabeled GitHub issue.
  if (source.integrationId !== 'github') return 'manual';
  return source.type === 'pull-request' ? 'github-pr' : 'github-issue';
}

// Authored outside the write-access circle: a missing trust stamp fails closed until
// the reconcile sweep backfills it, and Factory's own PRs pass through `factoryAuthored`.
export function externallyAuthored(item: { source: string; metadata: Record<string, unknown> | null }): boolean {
  if (item.source !== 'github-pr' && item.source !== 'github-issue') return false;
  if (item.metadata?.factoryAuthored === true) return false;
  return item.metadata?.authorTrusted !== true;
}

// The board mark claims only what GitHub answered: a missing stamp is silence, not an outside contribution.
export function knownExternalAuthor(item: { source: string; metadata: Record<string, unknown> | null }): boolean {
  return externallyAuthored(item) && item.metadata?.authorTrusted === false;
}

export function externallyAuthoredWorkItem(item: {
  externalSource: ExternalWorkItemSource | null;
  metadata: Record<string, unknown> | null;
}): boolean {
  return externallyAuthored({ source: workItemSource(item.externalSource), metadata: item.metadata });
}

export const FACTORY_RULE_STAGES = ['intake', 'triage', 'planning', 'execute', 'review', 'done', 'canceled'] as const;
export type FactoryRuleStage = (typeof FACTORY_RULE_STAGES)[number];

// Each role and the working stage its run holds the card in. Key order is the
// seat pipeline order — Resume depth derives from it.
export const FACTORY_ROLE_STAGES = {
  triage: 'triage',
  plan: 'planning',
  work: 'execute',
  review: 'review',
} as const satisfies Record<string, FactoryRuleStage>;
export type FactoryRole = keyof typeof FACTORY_ROLE_STAGES;

export function isFactoryRole(value: string): value is FactoryRole {
  return value in FACTORY_ROLE_STAGES;
}

export const FACTORY_TRIAGE_TYPES = [
  'bug',
  'feature request',
  'docs',
  'question/support',
  'maintenance',
  'duplicate',
  'resolved',
  'invalid',
  'spam',
  'out-of-scope',
  'other',
] as const;
export type FactoryTriageType = (typeof FACTORY_TRIAGE_TYPES)[number];

export function isFactoryTriageType(value: unknown): value is FactoryTriageType {
  return typeof value === 'string' && FACTORY_TRIAGE_TYPES.some(type => type === value);
}

export function isFactoryRuleStage(value: unknown): value is FactoryRuleStage {
  return typeof value === 'string' && FACTORY_RULE_STAGES.some(stage => stage === value);
}

export function factoryRuleStage(stages: readonly string[]): FactoryRuleStage | undefined {
  const stage = stages.length === 1 ? stages[0] : undefined;
  return isFactoryRuleStage(stage) ? stage : undefined;
}

export function isTerminalFactoryRuleStage(stages: readonly string[]): boolean {
  const stage = factoryRuleStage(stages);
  return stage === 'done' || stage === 'canceled';
}

/** Working lanes hold cards with a seat engaged; Intake, Done and Canceled rest them. */
export function isWorkingFactoryRuleStage(stage: FactoryRuleStage): boolean {
  return stage !== 'intake' && !isTerminalFactoryRuleStage([stage]);
}

// Consulted only for the Intake exit: roles don't own lanes, so a card already
// in a working or terminal lane stays put when a run starts.
export function factoryLaneForRole(role: string): FactoryRuleStage | undefined {
  return isFactoryRole(role) ? FACTORY_ROLE_STAGES[role] : undefined;
}

export const FACTORY_RULE_BOARDS = ['work', 'review'] as const;
export type FactoryRuleBoard = (typeof FACTORY_RULE_BOARDS)[number];

export const FACTORY_RULE_SOURCES = ['issue', 'pullRequest', 'linearIssue', 'manual'] as const;
export type FactoryRuleSource = (typeof FACTORY_RULE_SOURCES)[number];

export const FACTORY_GITHUB_EVENTS = [
  'issueOpened',
  'issueEdited',
  'issueClosed',
  'issueCommentCreated',
  'issueCommentEdited',
  'issueCommentDeleted',
  'pullRequestOpened',
  'pullRequestUpdated',
  'pullRequestCommentCreated',
  'pullRequestReviewRequested',
  'pullRequestReviewSubmitted',
  'pullRequestMerged',
  'pullRequestClosed',
] as const;
export type FactoryGithubEventName = (typeof FACTORY_GITHUB_EVENTS)[number];

export const FACTORY_LINEAR_EVENTS = ['issueObserved', 'issueClosed'] as const;
export type FactoryLinearEventName = (typeof FACTORY_LINEAR_EVENTS)[number];

export type FactoryRuleJsonValue =
  | null
  | boolean
  | number
  | string
  | FactoryRuleJsonValue[]
  | { [key: string]: FactoryRuleJsonValue };

export interface FactoryRuleItemContext {
  id: string;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId: string | null;
  title: string;
  url: string | null;
  stages: readonly string[];
  /** Intake-stamped facts about the source — repository id, reporter login, labels. */
  metadata: Record<string, unknown> | null;
}

export type FactoryRuleActor =
  | { type: 'human'; id: string }
  | { type: 'agent'; bindingId: string; role: string }
  | { type: 'github'; login: string; trusted: boolean; factoryAuthored: boolean }
  | { type: 'system'; id: string };

export interface FactoryRuleIngressIdentity {
  type: 'human' | 'agent' | 'toolResult' | 'github' | 'linear' | 'rule';
  id: string;
}

export interface FactoryRuleCausalEntry {
  ingressId: string;
  decisionType: FactoryCommitDecision['type'];
}

export interface FactoryRuleContextBase {
  tenant: { orgId: string; projectId: string };
  actor: FactoryRuleActor;
  ingress: FactoryRuleIngressIdentity;
  cause: string;
  causalChain: readonly FactoryRuleCausalEntry[];
  ruleSetVersion: string;
}

export interface FactoryBoundRuleContext extends FactoryRuleContextBase {
  item: FactoryRuleItemContext;
  board: FactoryRuleBoard;
  itemRevision: number;
}

export interface FactoryStageRuleContext extends FactoryBoundRuleContext {
  source: FactoryRuleSource;
  stage: FactoryRuleStage;
  fromStage: FactoryRuleStage;
  toStage: FactoryRuleStage;
}

export interface FactoryToolResultRuleContext extends FactoryBoundRuleContext {
  toolName: string;
  threadId: string;
  assistantMessageId: string;
  toolCallId: string;
  result: {
    status: 'success' | 'error';
    value: FactoryRuleJsonValue;
  };
}

export interface FactoryGithubRuleContext extends FactoryRuleContextBase {
  item?: FactoryRuleItemContext;
  board?: FactoryRuleBoard;
  itemRevision?: number;
  event: FactoryGithubEventName;
  deliveryId: string;
  factory: { createdAt: string };
  repository: { id: number; fullName: string };
  issue?: {
    number: number;
    title: string;
    url: string;
    createdAt?: string;
    updatedAt?: string;
    assignees?: string[];
    labels?: string[];
    state?: 'open' | 'closed';
    /** GitHub close reason: `completed`, `not_planned`, or `duplicate`. */
    stateReason?: string;
  };
  issueChange?: { title: boolean; body: boolean };
  issueComment?: {
    id: number;
    body?: string;
    url?: string;
    author?: string;
    authorType?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  pullRequest?: {
    number: number;
    title: string;
    url: string;
    createdAt?: string;
    state: 'open' | 'closed';
    draft: boolean;
    merged: boolean;
    assignees?: string[];
    requestedReviewers?: string[];
    labels?: string[];
    headBranch: string;
    baseBranch: string;
  };
  /** Present on `pullRequestReviewRequested`: who review was (re-)requested from. */
  reviewRequest?: { reviewer: string; factoryReviewer: boolean };
  /** Present on `pullRequestReviewSubmitted`: the review that was just posted. */
  review?: { id: number; state: string; url: string };
}

export interface FactoryLinearRuleContext extends FactoryRuleContextBase {
  item?: FactoryRuleItemContext;
  board?: FactoryRuleBoard;
  itemRevision?: number;
  event: FactoryLinearEventName;
  issue: {
    id: string;
    identifier: string;
    title: string;
    url: string;
    state: string;
    stateType: string;
    priorityLabel: string;
    assignee: string | null;
    creator: string | null;
    team: string | null;
    labels: readonly string[];
    createdAt: string;
    updatedAt: string;
  };
}

export type FactoryRuleHandler<TContext> = (
  context: Readonly<TContext>,
) => FactoryRuleDecision | void | Promise<FactoryRuleDecision | void>;

export interface FactoryBoardRuleLeaf {
  onEnter?: FactoryRuleHandler<FactoryStageRuleContext>;
  onExit?: FactoryRuleHandler<FactoryStageRuleContext>;
}

export interface FactoryToolRuleLeaf {
  onResult?: FactoryRuleHandler<FactoryToolResultRuleContext>;
}

export interface FactoryGithubRuleLeaf {
  onEvent?: FactoryRuleHandler<FactoryGithubRuleContext>;
}

export interface FactoryLinearRuleLeaf {
  onEvent?: FactoryRuleHandler<FactoryLinearRuleContext>;
}

export type FactoryBoardRules = Partial<
  Record<FactoryRuleStage, Partial<Record<FactoryRuleSource, FactoryBoardRuleLeaf>>>
>;

export interface FactoryRules {
  version: string;
  work: FactoryBoardRules;
  review: FactoryBoardRules;
  tools: Record<string, FactoryToolRuleLeaf>;
  github: Partial<Record<FactoryGithubEventName, FactoryGithubRuleLeaf>>;
  linear: Partial<Record<FactoryLinearEventName, FactoryLinearRuleLeaf>>;
}

export interface FactoryRulesOverrides {
  work?: FactoryBoardRules;
  review?: FactoryBoardRules;
  tools?: Record<string, FactoryToolRuleLeaf>;
  github?: Partial<Record<FactoryGithubEventName, FactoryGithubRuleLeaf>>;
  linear?: Partial<Record<FactoryLinearEventName, FactoryLinearRuleLeaf>>;
}

export type FactoryRuleRejectionCode =
  | 'forbidden'
  | 'invalid_transition'
  | 'missing_binding'
  | 'stale'
  | 'timeout'
  | 'rule_error'
  | 'causal_depth_exceeded'
  | 'repeated_transition'
  | 'approval_required';

export interface FactoryRuleRejectDecision {
  type: 'reject';
  code: FactoryRuleRejectionCode;
  reason: string;
}

interface FactoryCommitDecisionBase {
  idempotencyKey: string;
}

export interface FactoryTransitionDecision extends FactoryCommitDecisionBase {
  type: 'transition';
  board: FactoryRuleBoard;
  stage: FactoryRuleStage;
  /**
   * Delivered to the item's active session (waking it if idle) after the
   * transition commits. Skipped when the item has no active run binding, so
   * informational messages never fail the transition.
   */
  message?: { text: string; role?: string };
  /**
   * Runs the stage's entry rules even when the item is already in that stage.
   * A transition to the current stage is normally inert, because most callers
   * are correcting a board into a state it already holds. Re-entry is for the
   * opposite case: the stage's work is in flight and has been invalidated, so
   * it has to start over.
   */
  reenter?: boolean;
}

export interface FactoryUpsertLinkedWorkItemDecision extends FactoryCommitDecisionBase {
  type: 'upsertLinkedWorkItem';
  board: FactoryRuleBoard;
  source: WorkItemSource;
  sourceKey: string;
  title: string;
  url: string | null;
  stage: FactoryRuleStage;
  metadata?: Record<string, FactoryRuleJsonValue>;
}

interface FactoryInvokeSkillDecisionBase extends FactoryCommitDecisionBase {
  type: 'invokeSkill';
  role: string;
  arguments?: string;
  precedingMessage?: string;
  cancelInFlight?: boolean;
}

/**
 * Starting an agent run. Most runs activate a skill, because the skill carries
 * the handoff contract later rules match on. A run whose completion is already
 * signalled some other way — Building finishes by opening a pull request, which
 * arrives as its own event — needs no contract, so it can carry a plain prompt
 * instead of an otherwise empty skill.
 */
export type FactoryInvokeSkillDecision = FactoryInvokeSkillDecisionBase &
  ({ skillName: string; prompt?: never } | { prompt: string; skillName?: never });

export interface FactorySendMessageDecision extends FactoryCommitDecisionBase {
  type: 'sendMessage';
  /** Omitted: the card's live session, whichever seat holds it. Required with `prepareBinding`. */
  role?: string;
  message: string;
  priority?: 'medium' | 'high' | 'urgent';
  idleBehavior?: 'persist' | 'wake';
  prepareBinding?: boolean;
}

export interface FactoryNotifyDecision extends FactoryCommitDecisionBase {
  type: 'notify';
  title: string;
  body?: string;
  level?: 'info' | 'warning' | 'error';
}

export type FactoryCommitDecision =
  | FactoryTransitionDecision
  | FactoryUpsertLinkedWorkItemDecision
  | FactoryInvokeSkillDecision
  | FactorySendMessageDecision
  | FactoryNotifyDecision;

export type FactoryRuleDecision = FactoryRuleRejectDecision | FactoryCommitDecision;

export interface FactoryTransitionResultAccepted {
  status: 'accepted';
  transitionId: string;
  itemId: string;
  revision: number;
  stage: FactoryRuleStage;
  decisions: FactoryCommitDecision[];
}

export interface FactoryTransitionResultRejected {
  status: 'rejected';
  transitionId: string;
  itemId: string;
  code: FactoryRuleRejectionCode;
  reason: string;
}

export type FactoryTransitionResult = FactoryTransitionResultAccepted | FactoryTransitionResultRejected;

export function factoryRuleSourceForWorkItem(source: WorkItemSource): FactoryRuleSource {
  switch (source) {
    case 'github-issue':
      return 'issue';
    case 'github-pr':
      return 'pullRequest';
    case 'linear-issue':
      return 'linearIssue';
    case 'manual':
      return 'manual';
  }
}
