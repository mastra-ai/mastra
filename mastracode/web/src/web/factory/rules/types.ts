export type WorkItemSource = 'github-issue' | 'github-pr' | 'linear-issue' | 'manual';

export const FACTORY_RULE_STAGES = ['intake', 'triage', 'planning', 'execute', 'review', 'done'] as const;
export type FactoryRuleStage = (typeof FACTORY_RULE_STAGES)[number];

export const FACTORY_RULE_BOARDS = ['work', 'review'] as const;
export type FactoryRuleBoard = (typeof FACTORY_RULE_BOARDS)[number];

export const FACTORY_RULE_SOURCES = ['issue', 'pullRequest', 'linearIssue', 'manual'] as const;
export type FactoryRuleSource = (typeof FACTORY_RULE_SOURCES)[number];

export const FACTORY_GITHUB_EVENTS = [
  'issueOpened',
  'pullRequestOpened',
  'pullRequestUpdated',
  'pullRequestReviewRequested',
  'pullRequestMerged',
] as const;
export type FactoryGithubEventName = (typeof FACTORY_GITHUB_EVENTS)[number];

export const FACTORY_LINEAR_EVENTS = ['issueObserved'] as const;
export type FactoryLinearEventName = (typeof FACTORY_LINEAR_EVENTS)[number];

export type FactoryRuleJsonValue =
  null | boolean | number | string | FactoryRuleJsonValue[] | { [key: string]: FactoryRuleJsonValue };

export interface FactoryRuleItemContext {
  id: string;
  source: WorkItemSource;
  sourceKey: string | null;
  parentWorkItemId: string | null;
  title: string;
  url: string | null;
  stages: readonly string[];
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
  repository: { id: number; fullName: string };
  issue?: { number: number; title: string; url: string };
  pullRequest?: {
    number: number;
    title: string;
    url: string;
    state: 'open' | 'closed';
    merged: boolean;
    headBranch: string;
    baseBranch: string;
  };
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
  | 'repeated_transition';

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

export interface FactoryInvokeSkillDecision extends FactoryCommitDecisionBase {
  type: 'invokeSkill';
  role: string;
  skillName: string;
  arguments?: string;
}

export interface FactorySendMessageDecision extends FactoryCommitDecisionBase {
  type: 'sendMessage';
  role: string;
  message: string;
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
