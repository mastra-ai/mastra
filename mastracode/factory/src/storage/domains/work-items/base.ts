/**
 * Factory work-items storage domain.
 *
 * Work items belong to a first-class Factory project. External intake items use
 * a provider-neutral source reference; manual work items have no source.
 * Stage history is server-owned, while session and metadata patches merge
 * atomically so concurrent actors do not overwrite each other. The authoritative
 * Factory transition path keeps one exclusive current stage per item.
 */

import { createHash } from 'node:crypto';

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';
import { isTerminalFactoryRuleStage } from '../../../rules/types.js';
import type { FactoryTriageType } from '../../../rules/types.js';
import type { FactoryHealthFinding } from '../../../supervisor/health.js';
import {
  WORK_ITEM_ACTIVITY_SCHEMA,
  WORK_ITEM_COMMENT_MENTIONS_SCHEMA,
  WORK_ITEM_COMMENTS_SCHEMA,
} from '../comments/schema.js';

export type WorkItemStage = string;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function factoryDecisionHash(decision: Record<string, unknown>): string {
  return createHash('sha256').update(stableJson(decision)).digest('hex');
}

export interface ExternalWorkItemSource {
  integrationId: string;
  type: string;
  /**
   * The tenant on the platform, never ours: a Slack team (`T0ABC…`), a Discord
   * guild. Scopes the key, because a platform id such as a channel or a message
   * `ts` is only unique inside the workspace that issued it.
   */
  workspaceId?: string;
  externalId: string;
  url?: string;
}

/** Dispatcher upsert idempotency token — server bookkeeping, dropped from the read wire. */
export const FACTORY_RULE_MATERIALIZATION_KEY = 'factoryRuleMaterializationKey';
export const FACTORY_PULL_REQUEST_RECONCILIATION_KEY = 'factoryPullRequestReconciliation';

export interface WorkItemStageEntry {
  stage: WorkItemStage;
  enteredAt: string;
  exitedAt?: string;
  by: string;
  /**
   * Actor that closed this entry; absent on entries written before exit
   * stamping existed — treat as human.
   */
  exitedBy?: string;
}

/**
 * Whether an actor id marks a move an agent run performed: the binding id the
 * transition tool stamps (`agent:*`), or the rule that fires off a bound run's
 * tool result (see `factory/rules/processor.ts`).
 *
 * Deliberately narrower than "not a human": the poller stamps
 * `factory-rule-dispatcher` / `github:*` on every card it syncs from the
 * upstream repo, so counting those as machine work reports the repo's activity
 * as the Factory's and pins any such ratio near 100%.
 */
export function isAgentActor(by: string | undefined): boolean {
  if (by === undefined) return false;
  return by.startsWith('agent:') || by === 'factory-tool-result-rule';
}

export interface WorkItemSessionRef {
  sessionId: string;
  branch: string;
  threadId: string;
  startedBy: string;
}

export interface FactoryRuleIngressRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  identity: string;
  triggerType: string;
  transitionId: string;
  result: Record<string, unknown>;
  createdAt: Date;
}

export interface CommitFactoryRuleEvaluationInput {
  orgId: string;
  factoryProjectId: string;
  workItemId: string | null;
  ingress: { identity: string; triggerType: string };
  ruleSetVersion: string;
  expectedRevision: number | null;
  actor: Record<string, unknown> | null;
  outcome: { status: 'accepted' | 'rejected'; code?: string; reason?: string };
  decisions: Record<string, unknown>[];
  causalChain: Array<{ ingressId: string; decisionType: string }>;
  now: Date;
}

export type CommitFactoryRuleEvaluationResult =
  | { status: 'committed'; result: Record<string, unknown> }
  | { status: 'replayed'; result: Record<string, unknown> }
  | { status: 'missing' };

export interface FactoryToolResultCursorRecord {
  bindingId: string;
  orgId: string;
  factoryProjectId: string;
  lastMessageId: string;
  lastMessageCreatedAt: Date;
  updatedAt: Date;
}

export interface FactoryRuleEvaluationRecord {
  id: string;
  ingressId: string;
  workItemId: string | null;
  ruleSetVersion: string;
  expectedRevision: number | null;
  outcome: 'accepted' | 'rejected';
  code: string | null;
  reason: string | null;
  causalChain: Array<{ ingressId: string; decisionType: string }>;
  createdAt: Date;
}

/** `proposed` is parked awaiting approval; `dismissed` is human, `superseded` is automatic. */
export type FactoryDispatchStatus =
  | 'pending'
  | 'proposed'
  | 'dismissed'
  | 'superseded'
  | 'leased'
  | 'retry'
  | 'succeeded'
  | 'failed';

const FACTORY_DISPATCH_FAILURE_CODES = [
  'session_unavailable',
  'source_control_missing',
  'source_repository_missing',
  'unsupported_provider_item',
  'notification_delivery_failed',
  'plan_awaiting_approval',
  'run_awaiting_input',
  'repository_git_missing',
  'repository_egress_blocked',
  'repository_clone_failed',
  'repository_pull_failed',
  'repository_push_failed',
  'repository_commit_failed',
  'repository_cli_missing',
  'repository_pr_failed',
  'unknown',
] as const;

export type FactoryDispatchFailureCode = (typeof FACTORY_DISPATCH_FAILURE_CODES)[number];

function isFactoryDispatchFailureCode(value: unknown): value is FactoryDispatchFailureCode {
  return FACTORY_DISPATCH_FAILURE_CODES.some(code => code === value);
}

export interface FactoryDeferredDecisionPageInput {
  orgId: string;
  factoryProjectId: string;
  statuses?: FactoryDispatchStatus[];
  before?: { createdAt: Date; id: string };
  limit: number;
}

export interface FactoryDeferredDecisionPage {
  decisions: FactoryDeferredDecisionRecord[];
  hasMore: boolean;
}

export interface FactoryFailedDecisionPageInput {
  orgId: string;
  factoryProjectId: string;
  before?: { occurredAt: Date; id: string };
  limit: number;
}

export interface FactoryDeferredDecisionRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  evaluationId: string;
  workItemId: string | null;
  idempotencyKey: string;
  effectOrdinal: number;
  effectHash: string;
  causalChain: Array<{ ingressId: string; decisionType: string }>;
  actor: Record<string, unknown> | null;
  decision: Record<string, unknown>;
  status: FactoryDispatchStatus;
  attempts: number;
  deliveryGeneration: number;
  failureOccurrence: number;
  availableAt: Date;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  lastError: string | null;
  failureCode: FactoryDispatchFailureCode | null;
  /** When a human released this run; set once, so the gate never parks it again. */
  approvedAt: Date | null;
  /** Who released this run — the run is attributed to them, not the repo connector. */
  approvedBy: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type FactoryAttentionKind = 'automation-failed' | 'mention' | 'activity' | 'supervisor-finding';
export type FactoryAttentionReceiptState = 'read' | 'archived';

export interface FactorySupervisorFindingRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  findingKey: string;
  occurrence: number;
  finding: Record<string, unknown>;
  openedAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
}
export type FactoryAttentionReceiptAction = 'read' | 'archive' | 'restore';

export interface FactoryAttentionIdentity {
  kind: FactoryAttentionKind;
  sourceId: string;
  occurrence: number;
}

export interface FactoryAttentionReceiptRecord extends FactoryAttentionIdentity {
  id: string;
  orgId: string;
  factoryProjectId: string;
  userId: string;
  state: FactoryAttentionReceiptState;
  readAt: Date;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SetAttentionReceiptInput {
  orgId: string;
  factoryProjectId: string;
  userId: string;
  identity: FactoryAttentionIdentity;
  action: FactoryAttentionReceiptAction;
  now: Date;
}

export function factoryDecisionAttentionIdentity(
  decisionId: string,
  failureOccurrence: number,
): FactoryAttentionIdentity {
  return { kind: 'automation-failed', sourceId: decisionId, occurrence: failureOccurrence };
}

export function factoryMentionAttentionIdentity(commentId: string): FactoryAttentionIdentity {
  return { kind: 'mention', sourceId: commentId, occurrence: 0 };
}

/** Collapsed per work item, so the occurrence is what a new comment bumps. */
export function factoryActivityAttentionIdentity(workItemId: string, occurrence: number): FactoryAttentionIdentity {
  return { kind: 'activity', sourceId: workItemId, occurrence };
}

export function factorySupervisorFindingAttentionIdentity(
  findingKey: string,
  occurrence: number,
): FactoryAttentionIdentity {
  return { kind: 'supervisor-finding', sourceId: findingKey, occurrence };
}

export function factoryAttentionKey(factoryProjectId: string, identity: FactoryAttentionIdentity): string {
  return `factory:${factoryProjectId}:attention:${identity.kind}:${identity.sourceId}:${identity.occurrence}`;
}

export interface FactoryRunBindingSessionAddress {
  factoryProjectId: string;
  threadId: string;
  resourceId: string;
  sessionId: string;
}

export interface FactoryRunBindingAddress extends FactoryRunBindingSessionAddress {
  orgId: string;
}

export interface RevokeFactoryRunBindingInput {
  orgId: string;
  factoryProjectId: string;
  bindingId: string;
  revokedAt: Date;
}

export interface RevokeStaleFactoryRunBindingsInput {
  /** Active bindings created before this instant are revoked regardless of item state. */
  olderThan: Date;
  now: Date;
}

/**
 * Stages in which a bound run can still act on its work item. Mirrors the
 * non-terminal subset of `FACTORY_RULE_STAGES` (rules/types.ts); bindings for
 * items outside these stages are dead weight in the reconcile walk.
 */
const ACTIVE_RUN_BINDING_STAGES: ReadonlySet<string> = new Set(['intake', 'triage', 'planning', 'execute', 'review']);

export interface RevokeFactoryRunBindingsForWorkItemInput {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  revokedAt: Date;
}

export interface FactoryRunBindingRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  role: string;
  threadId: string;
  resourceId: string;
  sessionId: string;
  branch: string;
  status: 'active' | 'revoked';
  createdAt: Date;
  revokedAt: Date | null;
}

export interface FactoryPendingStartRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  bindingId: string;
  kickoffKey: string;
  message: string | null;
  status: 'pending' | 'leased' | 'retry' | 'sent' | 'failed';
  attempts: number;
  availableAt: Date;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  lastError: string | null;
  failureCode: FactoryDispatchFailureCode | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactoryLeaseClaimInput {
  ownerId: string;
  now: Date;
  leaseExpiresAt: Date;
  limit: number;
}

export interface FactoryLeaseIdentity {
  id: string;
  orgId: string;
  factoryProjectId: string;
  ownerId: string;
}

export interface FactoryDispatchFailureInput extends FactoryLeaseIdentity {
  now: Date;
  availableAt: Date;
  lastError: string;
  failureCode: FactoryDispatchFailureCode;
  terminal: boolean;
  advanceDeliveryGeneration?: boolean;
}

export interface CommitFactoryTransitionInput {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  expectedRevision: number;
  destinationStage: string;
  actorId: string;
  ingress: { identity: string; triggerType: string; transitionId: string };
  ruleSetVersion: string;
  causalChain: Array<{ ingressId: string; decisionType: string }>;
  evaluation:
    | { outcome: 'accepted'; decisions: Record<string, unknown>[] }
    | { outcome: 'rejected'; code: string; reason: string };
  /** Arm or disarm autonomy in the same revision-checked update that commits the transition. */
  autonomy?: 'arm' | 'disarm';
  /** Consent-bearing actor behind the flip; their id pre-approves the runs this transition queues. */
  consentedBy?: string;
  /** Triage classification reported by an authenticated triage binding. */
  triageType?: FactoryTriageType;
  /** Record the person's acceptance of this item in the same revision-checked update; a no-op once set. */
  accept?: boolean;
}

export type CommitFactoryTransitionResult =
  | { status: 'committed'; item: WorkItemRow | null; result: Record<string, unknown> }
  | { status: 'replayed'; item: WorkItemRow | null; result: Record<string, unknown> }
  | { status: 'missing' };

export interface PrepareFactoryRunStartInput {
  orgId: string;
  userId: string;
  factoryProjectId: string;
  workItem: { id?: string; input: CreateWorkItemInput };
  role: string;
  session: WorkItemSessionInput;
  resourceId: string;
  kickoffKey: string;
  kickoffMessage: string | null;
  /** Arm the item's autonomy in the same transaction that prepares the run. */
  armAutonomy?: boolean;
  /** Grant the item's plans auto-approval in the same transaction — the person chose a hands-off run. */
  preapprovePlans?: boolean;
}

export interface PrepareFactoryRunStartResult {
  item: WorkItemRow;
  binding: FactoryRunBindingRecord;
  pendingStart: FactoryPendingStartRecord;
  replayed: boolean;
}

/** Session ref as accepted from clients — `startedBy` is stamped server-side. */
export interface WorkItemSessionInput {
  sessionId: string;
  branch: string;
  threadId: string;
}

export type WorkItemSessions = Record<string, WorkItemSessionRef>;

export interface WorkItemRow {
  id: string;
  orgId: string;
  factoryProjectId: string;
  externalSource: ExternalWorkItemSource | null;
  parentWorkItemId: string | null;
  title: string;
  stages: WorkItemStage[];
  stageHistory: WorkItemStageEntry[];
  sessions: WorkItemSessions;
  metadata: Record<string, unknown> | null;
  /** Authoritative verdict written by the bound triage run. */
  triageType: FactoryTriageType | null;
  /**
   * When a person first committed this item to the Factory, by starting a run
   * on it or releasing one that was proposed. Projects that withhold auto-run
   * are asking to decide what the Factory picks up, not to approve each step of
   * work they already asked for, so runs on an armed item skip the gate.
   */
  autonomyArmedAt: Date | null;
  /**
   * When a person chose to run this item hands-off: the dispatcher answers its
   * parked plans even while the project's Auto-approve plans switch is off.
   */
  plansPreapprovedAt: Date | null;
  /**
   * When a person first moved this item out of Intake/Triage into working
   * stages. Non-bug items wait for that gesture; once it is recorded the
   * agents may advance the item through Planning and Execute on their own.
   */
  acceptedAt: Date | null;
  /** Denormalized feed counters, maintained by the comments domain via recount. */
  commentCount: number;
  /** Bumps on every feed mutation (create/edit/delete) — the clients' change hint. */
  feedActivityAt: Date | null;
  revision: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkItemInput {
  externalSource?: ExternalWorkItemSource | null;
  parentWorkItemId?: string | null;
  title: string;
  stages?: WorkItemStage[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateWorkItemInput {
  parentWorkItemId?: string | null;
  title?: string;
  stages?: WorkItemStage[];
  sessions?: Record<string, WorkItemSessionInput>;
  metadata?: Record<string, unknown> | null;
}

export interface WorkItemPriorState {
  stages: WorkItemStage[];
  sessionRoles: string[];
}

export interface UpsertWorkItemResult {
  item: WorkItemRow;
  created: boolean;
  previous: WorkItemPriorState;
}

export const WORK_ITEMS_SCHEMA: CollectionSchema = {
  name: 'work_items',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    external_source: { type: 'json', nullable: true },
    source_key: { type: 'text', nullable: true },
    parent_work_item_id: { type: 'text', nullable: true },
    title: { type: 'text' },
    stages: { type: 'json' },
    stage_history: { type: 'json' },
    sessions: { type: 'json' },
    metadata: { type: 'json', nullable: true },
    triage_type: { type: 'text', nullable: true },
    autonomy_armed_at: { type: 'timestamp', nullable: true },
    plans_preapproved_at: { type: 'timestamp', nullable: true },
    accepted_at: { type: 'timestamp', nullable: true },
    comment_count: { type: 'integer', default: 0 },
    feed_activity_at: { type: 'timestamp', nullable: true },
    revision: { type: 'integer', default: 1 },
    created_by: { type: 'text' },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      name: 'work_items_project_source_key_unique',
      columns: ['factory_project_id', 'source_key'],
    },
  ],
  indexes: [
    {
      name: 'work_items_org_project_created_at_id_idx',
      columns: ['org_id', 'factory_project_id', 'created_at', 'id'],
    },
    {
      name: 'work_items_project_parent_idx',
      columns: ['org_id', 'factory_project_id', 'parent_work_item_id'],
    },
    {
      // The unique index leads with `factory_project_id`, so it cannot serve a
      // lookup by the key alone — which is what a platform message has.
      name: 'work_items_source_key_idx',
      columns: ['source_key'],
    },
  ],
};

interface WorkItemDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  external_source: ExternalWorkItemSource | null;
  source_key: string | null;
  parent_work_item_id: string | null;
  title: string;
  stages: WorkItemStage[];
  stage_history: WorkItemStageEntry[];
  sessions: WorkItemSessions;
  metadata: Record<string, unknown> | null;
  triage_type: FactoryTriageType | null;
  autonomy_armed_at: Date | null;
  plans_preapproved_at: Date | null;
  accepted_at: Date | null;
  comment_count: number;
  feed_activity_at: Date | null;
  revision: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * The one shape a platform id takes in a lookup key, for cards and for the
 * comments mirrored off them alike: whoever writes a second builder reopens the
 * cross-workspace collision the `workspaceId` is here to close.
 */
export function externalSourceKey(source: ExternalWorkItemSource | null | undefined): string | null {
  if (!source) return null;
  const workspace = source.workspaceId ? `${source.workspaceId}:` : '';
  return `${source.integrationId}:${source.type}:${workspace}${source.externalId}`;
}

function toWorkItem(row: WorkItemDbRow): WorkItemRow {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: String(row.factory_project_id),
    externalSource: row.external_source,
    parentWorkItemId: row.parent_work_item_id,
    title: row.title,
    stages: row.stages,
    stageHistory: row.stage_history,
    sessions: row.sessions,
    metadata: row.metadata,
    triageType: row.triage_type ?? null,
    autonomyArmedAt: row.autonomy_armed_at ?? null,
    plansPreapprovedAt: row.plans_preapproved_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    commentCount: row.comment_count ?? 0,
    feedActivityAt: row.feed_activity_at ?? null,
    revision: row.revision,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const toRow = toWorkItem;

function patchColumns(changes: Partial<WorkItemRow>): Partial<WorkItemDbRow> {
  return {
    ...(changes.parentWorkItemId !== undefined ? { parent_work_item_id: changes.parentWorkItemId } : {}),
    ...(changes.title !== undefined ? { title: changes.title } : {}),
    ...(changes.stages !== undefined ? { stages: changes.stages } : {}),
    ...(changes.stageHistory !== undefined ? { stage_history: changes.stageHistory } : {}),
    ...(changes.sessions !== undefined ? { sessions: changes.sessions } : {}),
    ...(changes.metadata !== undefined ? { metadata: changes.metadata } : {}),
    ...(changes.triageType !== undefined ? { triage_type: changes.triageType } : {}),
    ...(changes.autonomyArmedAt !== undefined ? { autonomy_armed_at: changes.autonomyArmedAt } : {}),
    ...(changes.acceptedAt !== undefined ? { accepted_at: changes.acceptedAt } : {}),
    ...(changes.revision !== undefined ? { revision: changes.revision } : {}),
    ...(changes.updatedAt !== undefined ? { updated_at: changes.updatedAt } : {}),
  };
}

function emptyPrior(): WorkItemPriorState {
  return { stages: [], sessionRoles: [] };
}

function priorState(row: WorkItemDbRow): WorkItemPriorState {
  return { stages: row.stages, sessionRoles: Object.keys(row.sessions) };
}

export class WorkItemRelationError extends Error {
  readonly code = 'invalid_work_item_relation';
}

export function validateParentRelation(
  projectItems: WorkItemRow[],
  itemId: string | undefined,
  parentWorkItemId: string | null,
): void {
  if (parentWorkItemId === null) return;
  const byId = new Map(projectItems.map(item => [item.id, item]));
  const parent = byId.get(parentWorkItemId);
  if (!parent) throw new WorkItemRelationError('Related work item not found in this project.');
  if (itemId === parentWorkItemId) throw new WorkItemRelationError('A work item cannot relate to itself.');

  const visited = new Set<string>();
  let cursor: WorkItemRow | undefined = parent;
  while (cursor?.parentWorkItemId) {
    if (cursor.parentWorkItemId === itemId) {
      throw new WorkItemRelationError('This relationship would create a cycle.');
    }
    if (visited.has(cursor.id)) throw new WorkItemRelationError('The related work item chain contains a cycle.');
    visited.add(cursor.id);
    cursor = byId.get(cursor.parentWorkItemId);
  }
}

/**
 * Diff `oldStages` → `newStages` and return the updated history: exited stages
 * get `exitedAt` + `exitedBy` stamped on their open entry, entered stages get
 * a new entry.
 */
export function applyStageTransition(
  history: WorkItemStageEntry[],
  oldStages: WorkItemStage[],
  newStages: WorkItemStage[],
  by: string,
  now: Date,
): WorkItemStageEntry[] {
  const timestamp = now.toISOString();
  const next = history.map(entry => ({ ...entry }));
  for (const stage of oldStages) {
    if (newStages.includes(stage)) continue;
    for (let i = next.length - 1; i >= 0; i--) {
      const entry = next[i]!;
      if (entry.stage === stage && entry.exitedAt === undefined) {
        entry.exitedAt = timestamp;
        entry.exitedBy = by;
        break;
      }
    }
  }
  for (const stage of newStages) {
    if (!oldStages.includes(stage)) next.push({ stage, enteredAt: timestamp, by });
  }
  return next;
}

export function stampSessions(sessions: Record<string, WorkItemSessionInput>, by: string): WorkItemSessions {
  return Object.fromEntries(Object.entries(sessions).map(([role, session]) => [role, { ...session, startedBy: by }]));
}

function applyUpdate({
  current,
  userId,
  input,
}: {
  current: WorkItemDbRow;
  userId: string;
  input: UpdateWorkItemInput;
}): Partial<WorkItemDbRow> {
  const now = new Date();
  return {
    ...(input.parentWorkItemId !== undefined ? { parent_work_item_id: input.parentWorkItemId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.stages !== undefined
      ? {
          stages: input.stages,
          stage_history: applyStageTransition(current.stage_history, current.stages, input.stages, userId, now),
        }
      : {}),
    ...(input.sessions !== undefined
      ? { sessions: { ...current.sessions, ...stampSessions(input.sessions, userId) } }
      : {}),
    ...(input.metadata !== undefined
      ? { metadata: input.metadata === null ? null : { ...(current.metadata ?? {}), ...input.metadata } }
      : {}),
    revision: current.revision + 1,
    updated_at: now,
  };
}
const ATTENTION_RECEIPT_QUERY_BATCH_SIZE = 200;
const ATTENTION_RECEIPT_WRITE_BATCH_SIZE = 25;

const projectRelationLocks = new Map<string, Promise<unknown>>();

function withInProcessProjectLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = projectRelationLocks.get(key) ?? Promise.resolve();
  const result = previous.then(fn, fn);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  projectRelationLocks.set(key, tail);
  void tail.then(() => {
    if (projectRelationLocks.get(key) === tail) projectRelationLocks.delete(key);
  });
  return result;
}

/** Source key a decision materializes, used to purge governance rows when the item is deleted. */
function decisionSourceKey(decision: unknown): string | null {
  if (typeof decision !== 'object' || decision === null) return null;
  const record = decision as Record<string, unknown>;
  if (record.type !== 'upsertLinkedWorkItem' || typeof record.sourceKey !== 'string') return null;
  return record.sourceKey;
}

function deferredDecisionType(decision: FactoryDeferredDecisionRecord): string | undefined {
  return typeof decision.decision.type === 'string' ? decision.decision.type : undefined;
}

function ingressWasAccepted(row: GovernanceDbRow | null): boolean {
  if (!row || typeof row.result !== 'object' || row.result === null || Array.isArray(row.result)) return false;
  return 'status' in row.result && row.result.status === 'accepted';
}

const FACTORY_GOVERNANCE_SCHEMAS: CollectionSchema[] = [
  {
    name: 'factory_rule_ingress',
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      factory_project_id: { type: 'text' },
      identity: { type: 'text' },
      trigger_type: { type: 'text' },
      transition_id: { type: 'text' },
      result: { type: 'json' },
      created_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      { name: 'factory_rule_ingress_tenant_identity_unique', columns: ['org_id', 'factory_project_id', 'identity'] },
    ],
  },
  {
    name: 'factory_rule_evaluations',
    columns: {
      id: { type: 'uuid-pk' },
      ingress_id: { type: 'text' },
      work_item_id: { type: 'text', nullable: true },
      rule_set_version: { type: 'text' },
      expected_revision: { type: 'integer', nullable: true },
      outcome: { type: 'text' },
      code: { type: 'text', nullable: true },
      reason: { type: 'text', nullable: true },
      causal_chain: { type: 'json' },
      created_at: { type: 'timestamp' },
    },
  },
  {
    name: 'factory_deferred_decisions',
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      factory_project_id: { type: 'text' },
      evaluation_id: { type: 'text' },
      work_item_id: { type: 'text', nullable: true },
      source_key: { type: 'text', nullable: true },
      idempotency_key: { type: 'text' },
      effect_ordinal: { type: 'integer' },
      effect_hash: { type: 'text' },
      causal_chain: { type: 'json' },
      actor: { type: 'json', nullable: true },
      decision: { type: 'json' },
      status: { type: 'text' },
      attempts: { type: 'integer' },
      delivery_generation: { type: 'integer', default: 0 },
      failure_occurrence: { type: 'integer', default: 0 },
      available_at: { type: 'timestamp' },
      lease_owner: { type: 'text', nullable: true },
      lease_expires_at: { type: 'timestamp', nullable: true },
      last_error: { type: 'text', nullable: true },
      failure_code: { type: 'text', nullable: true },
      approved_at: { type: 'timestamp', nullable: true },
      approved_by: { type: 'text', nullable: true },
      completed_at: { type: 'timestamp', nullable: true },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'factory_deferred_decisions_tenant_key_unique',
        columns: ['org_id', 'factory_project_id', 'idempotency_key'],
      },
    ],
    indexes: [
      { name: 'factory_deferred_decisions_claim_idx', columns: ['status', 'created_at'] },
      {
        name: 'factory_deferred_decisions_tenant_status_created_idx',
        columns: ['org_id', 'factory_project_id', 'status', 'created_at', 'id'],
      },
      {
        name: 'factory_deferred_decisions_tenant_status_failed_idx',
        columns: ['org_id', 'factory_project_id', 'status', 'updated_at', 'id'],
      },
    ],
  },
  {
    name: 'factory_supervisor_findings',
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      factory_project_id: { type: 'text' },
      finding_key: { type: 'text' },
      occurrence: { type: 'integer' },
      finding: { type: 'json' },
      opened_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
      resolved_at: { type: 'timestamp', nullable: true },
    },
    uniqueIndexes: [
      {
        name: 'factory_supervisor_findings_project_key_unique',
        columns: ['org_id', 'factory_project_id', 'finding_key'],
      },
    ],
    indexes: [
      {
        name: 'factory_supervisor_findings_project_open_idx',
        columns: ['org_id', 'factory_project_id', 'resolved_at', 'updated_at', 'id'],
      },
    ],
  },
  {
    name: 'factory_attention_receipts',
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      factory_project_id: { type: 'text' },
      user_id: { type: 'text' },
      kind: { type: 'text' },
      source_id: { type: 'text' },
      occurrence: { type: 'integer' },
      state: { type: 'text' },
      read_at: { type: 'timestamp' },
      archived_at: { type: 'timestamp', nullable: true },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'factory_attention_receipts_user_source_unique',
        columns: ['org_id', 'factory_project_id', 'user_id', 'kind', 'source_id', 'occurrence'],
      },
    ],
    indexes: [
      {
        name: 'factory_attention_receipts_user_state_idx',
        columns: ['org_id', 'factory_project_id', 'user_id', 'state'],
      },
      {
        name: 'factory_attention_receipts_source_idx',
        columns: ['org_id', 'factory_project_id', 'kind', 'source_id', 'occurrence'],
      },
    ],
  },
  {
    name: 'factory_run_bindings',
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      factory_project_id: { type: 'text' },
      work_item_id: { type: 'text' },
      role: { type: 'text' },
      thread_id: { type: 'text' },
      resource_id: { type: 'text' },
      session_id: { type: 'text' },
      branch: { type: 'text' },
      status: { type: 'text' },
      created_at: { type: 'timestamp' },
      revoked_at: { type: 'timestamp', nullable: true },
    },
    indexes: [
      // Exact-address lookups run on every processor message; status filter is
      // applied on top of the address columns.
      {
        name: 'factory_run_bindings_session_idx',
        columns: ['factory_project_id', 'thread_id', 'resource_id', 'session_id'],
      },
      // Restart reconciler enumerates active bindings across all tenants.
      { name: 'factory_run_bindings_status_idx', columns: ['status'] },
    ],
  },
  {
    name: 'factory_tool_result_cursors',
    columns: {
      binding_id: { type: 'text', primaryKey: true },
      org_id: { type: 'text' },
      factory_project_id: { type: 'text' },
      last_message_id: { type: 'text' },
      last_message_created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
  },
  {
    name: 'factory_pending_starts',
    columns: {
      id: { type: 'uuid-pk' },
      org_id: { type: 'text' },
      factory_project_id: { type: 'text' },
      binding_id: { type: 'text' },
      kickoff_key: { type: 'text' },
      message: { type: 'text', nullable: true },
      status: { type: 'text' },
      attempts: { type: 'integer' },
      available_at: { type: 'timestamp' },
      lease_owner: { type: 'text', nullable: true },
      lease_expires_at: { type: 'timestamp', nullable: true },
      last_error: { type: 'text', nullable: true },
      failure_code: { type: 'text', nullable: true },
      completed_at: { type: 'timestamp', nullable: true },
      created_at: { type: 'timestamp' },
      updated_at: { type: 'timestamp' },
    },
    uniqueIndexes: [
      {
        name: 'factory_pending_starts_tenant_kickoff_unique',
        columns: ['org_id', 'factory_project_id', 'kickoff_key'],
      },
    ],
    indexes: [{ name: 'factory_pending_starts_claim_idx', columns: ['status', 'created_at'] }],
  },
];

interface GovernanceDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  created_at: Date;
  [key: string]: unknown;
}

function toBinding(row: GovernanceDbRow): FactoryRunBindingRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: String(row.factory_project_id),
    workItemId: String(row.work_item_id),
    role: String(row.role),
    threadId: String(row.thread_id),
    resourceId: String(row.resource_id),
    sessionId: String(row.session_id),
    branch: String(row.branch),
    status: row.status as FactoryRunBindingRecord['status'],
    createdAt: row.created_at,
    revokedAt: (row.revoked_at as Date | null) ?? null,
  };
}
function toDeferredDecision(row: GovernanceDbRow): FactoryDeferredDecisionRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: String(row.factory_project_id),
    evaluationId: String(row.evaluation_id),
    workItemId: row.work_item_id === null || row.work_item_id === undefined ? null : String(row.work_item_id),
    idempotencyKey: String(row.idempotency_key),
    effectOrdinal: Number(row.effect_ordinal),
    effectHash: String(row.effect_hash),
    causalChain: (row.causal_chain as FactoryDeferredDecisionRecord['causalChain']) ?? [],
    actor: (row.actor as Record<string, unknown> | null) ?? null,
    decision: row.decision as Record<string, unknown>,
    status: row.status as FactoryDispatchStatus,
    attempts: Number(row.attempts),
    deliveryGeneration: Number(row.delivery_generation ?? 0),
    failureOccurrence: Number(row.failure_occurrence ?? 0),
    availableAt: row.available_at as Date,
    leaseOwner: (row.lease_owner as string | null) ?? null,
    leaseExpiresAt: (row.lease_expires_at as Date | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    failureCode: isFactoryDispatchFailureCode(row.failure_code) ? row.failure_code : null,
    approvedAt: (row.approved_at as Date | null) ?? null,
    approvedBy: (row.approved_by as string | null) ?? null,
    completedAt: (row.completed_at as Date | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at as Date,
  };
}
function attentionReceiptKind(value: unknown): FactoryAttentionKind {
  if (value === 'automation-failed' || value === 'mention' || value === 'activity' || value === 'supervisor-finding') {
    return value;
  }
  throw new Error(`Unsupported attention receipt kind '${String(value)}'.`);
}

function toSupervisorFinding(row: GovernanceDbRow): FactorySupervisorFindingRecord {
  return {
    id: row.id,
    orgId: String(row.org_id),
    factoryProjectId: String(row.factory_project_id),
    findingKey: String(row.finding_key),
    occurrence: Number(row.occurrence),
    finding: row.finding as Record<string, unknown>,
    openedAt: row.opened_at as Date,
    updatedAt: row.updated_at as Date,
    resolvedAt: (row.resolved_at as Date | null) ?? null,
  };
}

function attentionReceiptState(value: unknown): FactoryAttentionReceiptState {
  if (value === 'read' || value === 'archived') return value;
  throw new Error(`Unsupported attention receipt state '${String(value)}'.`);
}

function toAttentionReceipt(row: GovernanceDbRow): FactoryAttentionReceiptRecord {
  if (typeof row.source_id !== 'string' || !row.source_id) {
    throw new Error('Attention receipt source_id must be a non-empty string.');
  }
  const occurrence = Number(row.occurrence);
  if (!Number.isSafeInteger(occurrence) || occurrence < 0) {
    throw new Error('Attention receipt occurrence must be a non-negative safe integer.');
  }
  if (!(row.read_at instanceof Date)) throw new Error('Attention receipt read_at must be a timestamp.');
  const archivedAt = row.archived_at;
  if (archivedAt !== null && archivedAt !== undefined && !(archivedAt instanceof Date)) {
    throw new Error('Attention receipt archived_at must be a timestamp or null.');
  }
  if (!(row.created_at instanceof Date)) throw new Error('Attention receipt created_at must be a timestamp.');
  if (!(row.updated_at instanceof Date)) throw new Error('Attention receipt updated_at must be a timestamp.');
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: String(row.factory_project_id),
    userId: String(row.user_id),
    kind: attentionReceiptKind(row.kind),
    sourceId: row.source_id,
    occurrence,
    state: attentionReceiptState(row.state),
    readAt: row.read_at,
    archivedAt: archivedAt ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function toPendingStart(row: GovernanceDbRow): FactoryPendingStartRecord {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: String(row.factory_project_id),
    bindingId: String(row.binding_id),
    kickoffKey: String(row.kickoff_key),
    message: (row.message as string | null) ?? null,
    status: row.status as FactoryPendingStartRecord['status'],
    attempts: Number(row.attempts),
    availableAt: row.available_at as Date,
    leaseOwner: (row.lease_owner as string | null) ?? null,
    leaseExpiresAt: (row.lease_expires_at as Date | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    failureCode: (row.failure_code as FactoryDispatchFailureCode | null) ?? null,
    completedAt: (row.completed_at as Date | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at as Date,
  };
}

/** The project whose attention list a write just changed. */
export interface FactoryAttentionScope {
  orgId: string;
  factoryProjectId: string;
}

export class WorkItemsStorage extends FactoryStorageDomain {
  #attentionChanged: (scope: FactoryAttentionScope) => void = () => {};

  constructor() {
    super('work-items');
  }

  /**
   * Wired once at boot. Every write below that changes what this project's
   * attention list projects announces it here — the one place a new such write
   * has to remember, since clients stop polling while their stream is up.
   */
  onAttentionChanged(listener: (scope: FactoryAttentionScope) => void): void {
    this.#attentionChanged = listener;
  }

  async init(): Promise<void> {
    // The comment schemas are co-registered so the delete cascade below can
    // purge feed rows regardless of domain init order.
    await this.ensureCollections([
      WORK_ITEMS_SCHEMA,
      ...FACTORY_GOVERNANCE_SCHEMAS,
      WORK_ITEM_COMMENTS_SCHEMA,
      WORK_ITEM_COMMENT_MENTIONS_SCHEMA,
      WORK_ITEM_ACTIVITY_SCHEMA,
    ]);
    await this.repairLegacyAttentionState();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('work_items', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #countRows(collection: string, where: CollectionWhere): Promise<number> {
    const count = this.#db.count;
    if (!count) throw new Error('[WorkItemsStorage] storage backend does not support collection counts.');
    return count.call(this.#db, collection, where);
  }

  async syncSupervisorFindings(input: {
    orgId: string;
    factoryProjectId: string;
    findings: FactoryHealthFinding[];
    now: Date;
  }): Promise<void> {
    const changed = await this.#withProjectRelationTransaction(input.orgId, input.factoryProjectId, async ops => {
      let changed = false;
      const existingOpen = await ops.findMany<GovernanceDbRow>('factory_supervisor_findings', {
        org_id: input.orgId,
        factory_project_id: input.factoryProjectId,
        resolved_at: null,
      });
      const currentKeys = new Set(input.findings.map(finding => finding.id));
      for (const row of existingOpen) {
        if (!currentKeys.has(String(row.finding_key))) {
          await ops.updateAtomic<GovernanceDbRow>(
            'factory_supervisor_findings',
            { id: row.id, resolved_at: null },
            () => ({ resolved_at: input.now, updated_at: input.now }),
          );
          changed = true;
        }
      }
      const openByKey = new Map(existingOpen.map(row => [String(row.finding_key), row]));
      for (const finding of input.findings) {
        const row =
          openByKey.get(finding.id) ??
          (await ops.findOne<GovernanceDbRow>('factory_supervisor_findings', {
            org_id: input.orgId,
            factory_project_id: input.factoryProjectId,
            finding_key: finding.id,
          }));
        if (!row) {
          await ops.insertOne<GovernanceDbRow>('factory_supervisor_findings', {
            org_id: input.orgId,
            factory_project_id: input.factoryProjectId,
            finding_key: finding.id,
            occurrence: 0,
            finding,
            opened_at: input.now,
            updated_at: input.now,
            resolved_at: null,
          });
          changed = true;
          continue;
        }
        const reopening = row.resolved_at !== null;
        const findingChanged = stableJson(row.finding) !== stableJson(finding);
        if (!reopening && !findingChanged) continue;
        await ops.updateAtomic<GovernanceDbRow>('factory_supervisor_findings', { id: row.id }, current => ({
          finding,
          occurrence: Number(current.occurrence) + (current.resolved_at !== null ? 1 : 0),
          opened_at: current.resolved_at !== null ? input.now : current.opened_at,
          updated_at: input.now,
          resolved_at: null,
        }));
        changed = true;
      }
      return changed;
    });
    if (changed) this.#attentionChanged?.({ orgId: input.orgId, factoryProjectId: input.factoryProjectId });
  }

  async listSupervisorFindingPage(input: {
    orgId: string;
    factoryProjectId: string;
    before?: { occurredAt: Date; id: string };
    limit: number;
  }): Promise<{ rows: FactorySupervisorFindingRecord[]; hasMore: boolean }> {
    const rows = await this.#db.findMany<GovernanceDbRow>(
      'factory_supervisor_findings',
      { org_id: input.orgId, factory_project_id: input.factoryProjectId, resolved_at: null },
      {
        orderBy: [
          ['updated_at', 'desc'],
          ['id', 'desc'],
        ],
        limit: input.limit + 1,
        ...(input.before ? { cursor: { values: [input.before.occurredAt, input.before.id] } } : {}),
      },
    );
    return { rows: rows.slice(0, input.limit).map(toSupervisorFinding), hasMore: rows.length > input.limit };
  }

  async countOpenSupervisorFindings(input: { orgId: string; factoryProjectId: string }): Promise<number> {
    return this.#countRows('factory_supervisor_findings', {
      org_id: input.orgId,
      factory_project_id: input.factoryProjectId,
      resolved_at: null,
    });
  }

  async #withProjectRelationTransaction<T>(
    orgId: string,
    factoryProjectId: string,
    fn: (ops: FactoryStorageOps) => Promise<T>,
  ): Promise<T> {
    const key = `work-items:${orgId}:${factoryProjectId}`;
    return withInProcessProjectLock(key, () => this.storage.withTransaction(fn, { isolationLevel: 'serializable' }));
  }

  async #claimLeases<T>(
    table: 'factory_deferred_decisions' | 'factory_pending_starts',
    input: FactoryLeaseClaimInput,
    map: (row: GovernanceDbRow) => T,
  ): Promise<T[]> {
    const claim = () =>
      this.storage.withTransaction(async ops => {
        // Bounded candidate window: only rows in claimable/expirable statuses,
        // oldest first. Terminal rows (sent/succeeded/failed) accumulate over a
        // deployment's lifetime and must never be scanned per dispatch tick.
        const candidates = await ops.findMany<GovernanceDbRow>(
          table,
          { status: { in: ['pending', 'retry', 'leased'] } },
          { orderBy: [['created_at', 'asc']], limit: Math.max(input.limit * 5, 50) },
        );
        const claimed: T[] = [];
        for (const candidate of candidates) {
          if (claimed.length >= input.limit) break;
          const availableAt = new Date(candidate.available_at as Date | string).getTime();
          const leaseExpiresAt = candidate.lease_expires_at
            ? new Date(candidate.lease_expires_at as Date | string).getTime()
            : 0;
          const claimable =
            (candidate.status === 'pending' || candidate.status === 'retry') && availableAt <= input.now.getTime();
          const expired = candidate.status === 'leased' && leaseExpiresAt <= input.now.getTime();
          if (!claimable && !expired) continue;
          let didClaim = false;
          const row = await ops.updateAtomic<GovernanceDbRow>(table, { id: candidate.id }, current => {
            const currentAvailable = new Date(current.available_at as Date | string).getTime();
            const currentExpiry = current.lease_expires_at
              ? new Date(current.lease_expires_at as Date | string).getTime()
              : 0;
            const currentClaimable =
              (current.status === 'pending' || current.status === 'retry') && currentAvailable <= input.now.getTime();
            const currentExpired = current.status === 'leased' && currentExpiry <= input.now.getTime();
            if (!currentClaimable && !currentExpired) return null;
            didClaim = true;
            return {
              status: 'leased',
              attempts: Number(current.attempts) + 1,
              lease_owner: input.ownerId,
              lease_expires_at: input.leaseExpiresAt,
              updated_at: input.now,
            };
          });
          if (didClaim && row) claimed.push(map(row));
        }
        return claimed;
      });
    return claim();
  }

  async #renewLease(
    table: 'factory_deferred_decisions' | 'factory_pending_starts',
    identity: FactoryLeaseIdentity,
    leaseExpiresAt: Date,
  ): Promise<boolean> {
    let renewed = false;
    await this.#db.updateAtomic<GovernanceDbRow>(
      table,
      { id: identity.id, org_id: identity.orgId, factory_project_id: identity.factoryProjectId },
      current => {
        if (current.status !== 'leased' || current.lease_owner !== identity.ownerId) return null;
        renewed = true;
        return { lease_expires_at: leaseExpiresAt, updated_at: new Date() };
      },
    );
    return renewed;
  }

  async #completeLease(
    table: 'factory_deferred_decisions' | 'factory_pending_starts',
    identity: FactoryLeaseIdentity,
    now: Date,
  ): Promise<GovernanceDbRow | null> {
    let completed = false;
    const row = await this.#db.updateAtomic<GovernanceDbRow>(
      table,
      { id: identity.id, org_id: identity.orgId, factory_project_id: identity.factoryProjectId },
      current => {
        if (current.status !== 'leased' || current.lease_owner !== identity.ownerId) return null;
        completed = true;
        return {
          status: table === 'factory_pending_starts' ? 'sent' : 'succeeded',
          lease_owner: null,
          lease_expires_at: null,
          completed_at: now,
          updated_at: now,
        };
      },
    );
    return completed ? row : null;
  }

  async #failLease(
    table: 'factory_deferred_decisions' | 'factory_pending_starts',
    input: FactoryDispatchFailureInput,
  ): Promise<GovernanceDbRow | null> {
    let failed = false;
    const row = await this.#db.updateAtomic<GovernanceDbRow>(
      table,
      { id: input.id, org_id: input.orgId, factory_project_id: input.factoryProjectId },
      current => {
        if (current.status !== 'leased' || current.lease_owner !== input.ownerId) return null;
        failed = true;
        return {
          status: input.terminal ? 'failed' : 'retry',
          ...(table === 'factory_deferred_decisions' && !input.terminal && input.advanceDeliveryGeneration !== false
            ? { delivery_generation: Number(current.delivery_generation ?? 0) + 1 }
            : {}),
          available_at: input.availableAt,
          lease_owner: null,
          lease_expires_at: null,
          last_error: input.lastError,
          failure_code: input.failureCode,
          completed_at: input.terminal ? input.now : null,
          ...(table === 'factory_deferred_decisions' && input.terminal
            ? { failure_occurrence: Number(current.failure_occurrence ?? 0) + 1 }
            : {}),
          updated_at: input.now,
        };
      },
    );
    return failed ? row : null;
  }

  async #listWithOps(ops: FactoryStorageOps, orgId: string, factoryProjectId: string): Promise<WorkItemRow[]> {
    const rows = await ops.findMany<WorkItemDbRow>(
      'work_items',
      { org_id: orgId, factory_project_id: factoryProjectId },
      {
        orderBy: [
          ['created_at', 'desc'],
          ['id', 'desc'],
        ],
      },
    );
    return rows.map(toWorkItem);
  }

  /**
   * List the org's work items for a project, newest first. Ordered on `created_at` with an id
   * tiebreak so the order is stable: `updated_at` moves under every write, which makes it useless
   * as a cursor and non-deterministic for the callers that iterate this list.
   */
  async list({ orgId, factoryProjectId }: { orgId: string; factoryProjectId: string }): Promise<WorkItemRow[]> {
    return this.#listWithOps(this.#db, orgId, factoryProjectId);
  }

  async listByIds({
    orgId,
    factoryProjectId,
    ids,
  }: {
    orgId: string;
    factoryProjectId: string;
    ids: string[];
  }): Promise<WorkItemRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.#db.findMany<WorkItemDbRow>('work_items', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      id: { in: [...new Set(ids)] },
    });
    return rows.map(toWorkItem);
  }

  /**
   * Strip every ref to a retired session; matching happens in app code because
   * `findMany` cannot reach inside the `sessions` JSON column.
   * ponytail: org-wide scan per session delete; JSON-path query if it measures.
   */
  async clearSessionReferences({ orgId, sessionId }: { orgId: string; sessionId: string }): Promise<number> {
    const rows = await this.#db.findMany<WorkItemDbRow>('work_items', { org_id: orgId });
    const holding = rows.filter(row => Object.values(row.sessions).some(ref => ref.sessionId === sessionId));
    let cleared = 0;
    for (const row of holding) {
      let changed = false;
      await this.#db.updateAtomic<WorkItemDbRow>('work_items', { id: row.id }, current => {
        const kept = Object.entries(current.sessions).filter(([, ref]) => ref.sessionId !== sessionId);
        if (kept.length === Object.keys(current.sessions).length) return null;
        changed = true;
        return { sessions: Object.fromEntries(kept), revision: current.revision + 1, updated_at: new Date() };
      });
      if (changed) cleared += 1;
    }
    return cleared;
  }

  async get({ orgId, id }: { orgId: string; id: string }): Promise<WorkItemRow | null> {
    const row = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
    return row ? toWorkItem(row) : null;
  }

  /**
   * Resolve the card a platform thread created, given only its external source.
   * Bare of org/project because an inbound platform message carries neither: an
   * unlinked sender has no tenant. Tenant safety rides on the key's
   * `workspaceId` instead. Ambiguous matches resolve to nothing, not a guess.
   */
  async getBySource(source: ExternalWorkItemSource): Promise<WorkItemRow | null> {
    const rows = await this.#db.findMany<WorkItemDbRow>('work_items', { source_key: externalSourceKey(source) });
    return rows.length === 1 ? toWorkItem(rows[0]!) : null;
  }

  async getForProject(orgId: string, factoryProjectId: string, id: string): Promise<WorkItemRow | null> {
    const row = await this.#db.findOne<WorkItemDbRow>('work_items', {
      id,
      org_id: orgId,
      factory_project_id: factoryProjectId,
    });
    return row ? toRow(row) : null;
  }

  async getTransitionResultByIngress(
    orgId: string,
    factoryProjectId: string,
    identity: string,
  ): Promise<Record<string, unknown> | null> {
    const row = await this.#db.findOne<GovernanceDbRow>('factory_rule_ingress', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      identity,
    });
    return (row?.result as Record<string, unknown> | undefined) ?? null;
  }

  async commitTransition(input: CommitFactoryTransitionInput): Promise<CommitFactoryTransitionResult> {
    const commit = (): Promise<CommitFactoryTransitionResult> =>
      this.storage.withTransaction<CommitFactoryTransitionResult>(async ops => {
        const prior = await ops.findOne<GovernanceDbRow>('factory_rule_ingress', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          identity: input.ingress.identity,
        });
        if (prior)
          return {
            status: 'replayed',
            item: await this.getForProject(input.orgId, input.factoryProjectId, input.workItemId),
            result: prior.result as Record<string, unknown>,
          };

        const now = new Date();
        let item: WorkItemRow | null = null;
        let code: string | null = null;
        let reason: string | null = null;
        let result: Record<string, unknown>;
        const updated = await ops.updateAtomic<WorkItemDbRow>(
          'work_items',
          {
            id: input.workItemId,
            org_id: input.orgId,
            factory_project_id: input.factoryProjectId,
          },
          row => {
            const existing = toRow(row);
            item = existing;
            if (existing.revision !== input.expectedRevision) {
              code = 'stale';
              reason = 'The work item changed before this transition committed.';
              return null;
            }
            if (input.evaluation.outcome === 'rejected') {
              code = input.evaluation.code;
              reason = input.evaluation.reason;
              return null;
            }
            const arm = input.autonomy === 'arm' && !existing.autonomyArmedAt;
            const disarm = input.autonomy === 'disarm' && existing.autonomyArmedAt !== null;
            const accept = input.accept === true && !existing.acceptedAt;
            const triageType = existing.triageType ?? input.triageType ?? null;
            const classified = triageType !== existing.triageType;
            if (existing.stages.length === 1 && existing.stages[0] === input.destinationStage) {
              // Classification is part of a terminal handoff, so unlike an
              // autonomy flip alone it is a revisioned work-item change.
              return arm || disarm || accept || classified
                ? patchColumns({
                    ...(arm ? { autonomyArmedAt: now } : {}),
                    ...(disarm ? { autonomyArmedAt: null } : {}),
                    ...(accept ? { acceptedAt: now } : {}),
                    ...(classified ? { triageType, revision: existing.revision + 1, updatedAt: now } : {}),
                  })
                : null;
            }
            return patchColumns({
              ...(arm ? { autonomyArmedAt: now } : {}),
              ...(disarm ? { autonomyArmedAt: null } : {}),
              ...(accept ? { acceptedAt: now } : {}),
              ...(classified ? { triageType } : {}),
              stages: [input.destinationStage],
              stageHistory: applyStageTransition(
                existing.stageHistory,
                existing.stages,
                [input.destinationStage],
                input.actorId,
                now,
              ),
              revision: existing.revision + 1,
              updatedAt: now,
            });
          },
        );
        if (updated) item = toRow(updated);
        if (!item) {
          code = input.evaluation.outcome === 'rejected' ? input.evaluation.code : 'invalid_transition';
          reason = input.evaluation.outcome === 'rejected' ? input.evaluation.reason : 'Work item not found.';
        }
        const outcome: 'accepted' | 'rejected' =
          item && code === null && input.evaluation.outcome === 'accepted' ? 'accepted' : 'rejected';
        result =
          outcome === 'accepted'
            ? {
                status: 'accepted',
                transitionId: input.ingress.transitionId,
                itemId: item!.id,
                revision: item!.revision,
                stage: input.destinationStage,
                decisions: input.evaluation.outcome === 'accepted' ? input.evaluation.decisions : [],
              }
            : { status: 'rejected', transitionId: input.ingress.transitionId, itemId: input.workItemId, code, reason };
        const ingress = await ops.insertOne<GovernanceDbRow>('factory_rule_ingress', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          identity: input.ingress.identity,
          trigger_type: input.ingress.triggerType,
          transition_id: input.ingress.transitionId,
          result,
          created_at: now,
        });
        if (item) {
          const evaluation = await ops.insertOne<GovernanceDbRow>('factory_rule_evaluations', {
            ingress_id: ingress.id,
            work_item_id: item.id,
            rule_set_version: input.ruleSetVersion,
            expected_revision: input.expectedRevision,
            outcome,
            code,
            reason,
            causal_chain: input.causalChain,
            created_at: now,
          });
          if (outcome === 'accepted' && input.evaluation.outcome === 'accepted') {
            for (const [index, decision] of input.evaluation.decisions.entries()) {
              // Consent pre-approves only the runs this same commit queues.
              const approvedBy = decision.type === 'invokeSkill' ? (input.consentedBy ?? null) : null;
              await ops.insertOne<GovernanceDbRow>('factory_deferred_decisions', {
                org_id: input.orgId,
                factory_project_id: input.factoryProjectId,
                evaluation_id: evaluation.id,
                work_item_id: item.id,
                source_key: decisionSourceKey(decision),
                idempotency_key: String(decision.idempotencyKey),
                effect_ordinal: index,
                effect_hash: factoryDecisionHash(decision),
                causal_chain: input.causalChain,
                actor: null,
                decision,
                status: 'pending',
                attempts: 0,
                delivery_generation: 0,
                available_at: now,
                lease_owner: null,
                lease_expires_at: null,
                last_error: null,
                approved_at: approvedBy ? now : null,
                approved_by: approvedBy,
                completed_at: null,
                created_at: new Date(now.getTime() + index),
                updated_at: now,
              });
            }
          }
        }
        return { status: 'committed', item, result };
      });
    try {
      return await commit();
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      return commit();
    }
  }

  async commitRuleEvaluation(input: CommitFactoryRuleEvaluationInput): Promise<CommitFactoryRuleEvaluationResult> {
    const commit = () =>
      this.storage.withTransaction<CommitFactoryRuleEvaluationResult>(async ops => {
        const prior = await ops.findOne<GovernanceDbRow>('factory_rule_ingress', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          identity: input.ingress.identity,
        });
        if (prior) {
          const result = prior.result as Record<string, unknown>;
          const decisions = Array.isArray(result.decisions) ? result.decisions : [];
          const evaluation = await ops.findOne<GovernanceDbRow>('factory_rule_evaluations', { ingress_id: prior.id });
          for (const decision of decisions) {
            if (
              !evaluation ||
              !decision ||
              typeof decision !== 'object' ||
              (decision as Record<string, unknown>).type !== 'upsertLinkedWorkItem' ||
              typeof (decision as Record<string, unknown>).sourceKey !== 'string' ||
              typeof (decision as Record<string, unknown>).idempotencyKey !== 'string'
            ) {
              continue;
            }
            const materialization = decision as Record<string, unknown> & { sourceKey: string; idempotencyKey: string };
            const item = await ops.findOne<WorkItemDbRow>('work_items', {
              org_id: input.orgId,
              factory_project_id: input.factoryProjectId,
              source_key: materialization.sourceKey,
            });
            if (item) continue;
            await ops.updateAtomic<GovernanceDbRow>(
              'factory_deferred_decisions',
              {
                org_id: input.orgId,
                factory_project_id: input.factoryProjectId,
                evaluation_id: evaluation.id,
                idempotency_key: materialization.idempotencyKey,
              },
              current =>
                current.status === 'succeeded'
                  ? {
                      status: 'retry',
                      attempts: 0,
                      available_at: input.now,
                      lease_owner: null,
                      lease_expires_at: null,
                      last_error: null,
                      completed_at: null,
                      updated_at: input.now,
                    }
                  : null,
            );
          }
          return { status: 'replayed' as const, result };
        }
        const itemRow = input.workItemId
          ? await ops.findOne<WorkItemDbRow>('work_items', {
              id: input.workItemId,
              org_id: input.orgId,
              factory_project_id: input.factoryProjectId,
            })
          : null;
        if (input.workItemId !== null && !itemRow) return { status: 'missing' as const };
        const item = itemRow ? toRow(itemRow) : null;
        const stale = item !== null && item.revision !== input.expectedRevision;
        const outcome = stale ? 'rejected' : input.outcome.status;
        const code = stale ? 'stale' : (input.outcome.code ?? null);
        const reason = stale
          ? 'The work item changed before this rule evaluation committed.'
          : (input.outcome.reason ?? null);
        const decisions = outcome === 'accepted' ? input.decisions : [];
        const result = {
          status: outcome,
          itemId: item?.id ?? null,
          revision: item?.revision ?? null,
          code,
          reason,
          decisions,
        };
        const ingress = await ops.insertOne<GovernanceDbRow>('factory_rule_ingress', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          identity: input.ingress.identity,
          trigger_type: input.ingress.triggerType,
          transition_id: input.ingress.identity,
          result,
          created_at: input.now,
        });
        const evaluation = await ops.insertOne<GovernanceDbRow>('factory_rule_evaluations', {
          ingress_id: ingress.id,
          work_item_id: item?.id ?? null,
          rule_set_version: input.ruleSetVersion,
          expected_revision: input.expectedRevision,
          outcome,
          code,
          reason,
          causal_chain: input.causalChain,
          created_at: input.now,
        });
        for (const [effectOrdinal, decision] of decisions.entries()) {
          await ops.insertOne<GovernanceDbRow>('factory_deferred_decisions', {
            org_id: input.orgId,
            factory_project_id: input.factoryProjectId,
            evaluation_id: evaluation.id,
            work_item_id: item?.id ?? null,
            source_key: decisionSourceKey(decision),
            idempotency_key: String(decision.idempotencyKey),
            effect_ordinal: effectOrdinal,
            effect_hash: factoryDecisionHash(decision),
            causal_chain: input.causalChain,
            actor: input.actor,
            decision,
            status: 'pending',
            attempts: 0,
            delivery_generation: 0,
            available_at: input.now,
            lease_owner: null,
            lease_expires_at: null,
            last_error: null,
            completed_at: null,
            created_at: new Date(input.now.getTime() + effectOrdinal),
            updated_at: input.now,
          });
        }
        return { status: 'committed' as const, result };
      });
    try {
      return await commit();
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      return commit();
    }
  }

  async getToolResultCursor(
    orgId: string,
    factoryProjectId: string,
    bindingId: string,
  ): Promise<FactoryToolResultCursorRecord | null> {
    const row = await this.#db.findOne<GovernanceDbRow>('factory_tool_result_cursors', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      binding_id: bindingId,
    });
    return row
      ? {
          bindingId: String(row.binding_id),
          orgId: row.org_id,
          factoryProjectId: String(row.factory_project_id),
          lastMessageId: String(row.last_message_id),
          lastMessageCreatedAt: row.last_message_created_at as Date,
          updatedAt: row.updated_at as Date,
        }
      : null;
  }

  async advanceToolResultCursor(cursor: FactoryToolResultCursorRecord): Promise<void> {
    const current = await this.getToolResultCursor(cursor.orgId, cursor.factoryProjectId, cursor.bindingId);
    if (current && current.lastMessageCreatedAt > cursor.lastMessageCreatedAt) return;
    await this.#db.upsertOne<GovernanceDbRow>('factory_tool_result_cursors', ['binding_id'], {
      binding_id: cursor.bindingId,
      org_id: cursor.orgId,
      factory_project_id: cursor.factoryProjectId,
      last_message_id: cursor.lastMessageId,
      last_message_created_at: cursor.lastMessageCreatedAt,
      updated_at: cursor.updatedAt,
    });
  }

  async listDeferredDecisions(orgId: string, factoryProjectId: string): Promise<FactoryDeferredDecisionRecord[]> {
    return (
      await this.#db.findMany<GovernanceDbRow>(
        'factory_deferred_decisions',
        { org_id: orgId, factory_project_id: factoryProjectId },
        { orderBy: [['created_at', 'asc']] },
      )
    ).map(toDeferredDecision);
  }

  /** Read a bounded newest-first status page without exposing another tenant. */
  async listDeferredDecisionPage(input: FactoryDeferredDecisionPageInput): Promise<FactoryDeferredDecisionPage> {
    const rows = await this.#db.findMany<GovernanceDbRow>(
      'factory_deferred_decisions',
      {
        org_id: input.orgId,
        factory_project_id: input.factoryProjectId,
        ...(input.statuses ? { status: { in: input.statuses } } : {}),
      },
      {
        orderBy: [
          ['created_at', 'desc'],
          ['id', 'desc'],
        ],
        limit: input.limit + 1,
        ...(input.before ? { cursor: { values: [input.before.createdAt, input.before.id] } } : {}),
      },
    );
    return { decisions: rows.slice(0, input.limit).map(toDeferredDecision), hasMore: rows.length > input.limit };
  }

  async listFailedDecisionPage(input: FactoryFailedDecisionPageInput): Promise<FactoryDeferredDecisionPage> {
    const rows = await this.#db.findMany<GovernanceDbRow>(
      'factory_deferred_decisions',
      {
        org_id: input.orgId,
        factory_project_id: input.factoryProjectId,
        status: 'failed',
      },
      {
        orderBy: [
          ['updated_at', 'desc'],
          ['id', 'desc'],
        ],
        limit: input.limit + 1,
        ...(input.before ? { cursor: { values: [input.before.occurredAt, input.before.id] } } : {}),
      },
    );
    return { decisions: rows.slice(0, input.limit).map(toDeferredDecision), hasMore: rows.length > input.limit };
  }

  async countDeferredDecisionsByStatuses({
    orgId,
    factoryProjectId,
    statuses,
  }: {
    orgId: string;
    factoryProjectId: string;
    statuses: FactoryDispatchStatus[];
  }): Promise<number> {
    return this.#countRows('factory_deferred_decisions', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      status: { in: statuses },
    });
  }

  async getDeferredDecision(
    orgId: string,
    factoryProjectId: string,
    decisionId: string,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    const row = await this.#db.findOne<GovernanceDbRow>('factory_deferred_decisions', {
      id: decisionId,
      org_id: orgId,
      factory_project_id: factoryProjectId,
    });
    return row ? toDeferredDecision(row) : null;
  }

  async listAttentionReceipts({
    orgId,
    factoryProjectId,
    userId,
    identities,
  }: {
    orgId: string;
    factoryProjectId: string;
    userId: string;
    identities: FactoryAttentionIdentity[];
  }): Promise<FactoryAttentionReceiptRecord[]> {
    if (identities.length === 0) return [];
    const requested = new Set(
      identities.map(identity => `${identity.kind}\0${identity.sourceId}\0${identity.occurrence}`),
    );
    const sourceIds = [...new Set(identities.map(identity => identity.sourceId))];
    const kinds = [...new Set(identities.map(identity => identity.kind))];
    const receipts: FactoryAttentionReceiptRecord[] = [];
    for (let index = 0; index < sourceIds.length; index += ATTENTION_RECEIPT_QUERY_BATCH_SIZE) {
      const rows = await this.#db.findMany<GovernanceDbRow>('factory_attention_receipts', {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        user_id: userId,
        kind: { in: kinds },
        source_id: { in: sourceIds.slice(index, index + ATTENTION_RECEIPT_QUERY_BATCH_SIZE) },
      });
      receipts.push(
        ...rows
          .map(toAttentionReceipt)
          .filter(receipt => requested.has(`${receipt.kind}\0${receipt.sourceId}\0${receipt.occurrence}`)),
      );
    }
    return receipts;
  }

  async countAttentionReceipts({
    orgId,
    factoryProjectId,
    userId,
    kind,
    state,
  }: {
    orgId: string;
    factoryProjectId: string;
    userId: string;
    kind: FactoryAttentionKind;
    state?: FactoryAttentionReceiptState;
  }): Promise<number> {
    return this.#countRows('factory_attention_receipts', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      user_id: userId,
      kind,
      ...(state ? { state } : {}),
    });
  }

  async deleteAttentionReceipts({
    orgId,
    factoryProjectId,
    userId,
    identities,
  }: {
    orgId: string;
    factoryProjectId: string;
    /** Restrict to one user's receipts (a removed mention must keep other users' read state). */
    userId?: string;
    identities: FactoryAttentionIdentity[];
  }): Promise<void> {
    const unique = [
      ...new Map(
        identities.map(identity => [`${identity.kind}\0${identity.sourceId}\0${identity.occurrence}`, identity]),
      ).values(),
    ];
    for (let index = 0; index < unique.length; index += ATTENTION_RECEIPT_WRITE_BATCH_SIZE) {
      await Promise.all(
        unique.slice(index, index + ATTENTION_RECEIPT_WRITE_BATCH_SIZE).map(identity =>
          this.#db.deleteMany('factory_attention_receipts', {
            org_id: orgId,
            factory_project_id: factoryProjectId,
            ...(userId ? { user_id: userId } : {}),
            kind: identity.kind,
            source_id: identity.sourceId,
            occurrence: identity.occurrence,
          }),
        ),
      );
    }
  }

  async setAttentionReceipt(input: SetAttentionReceiptInput): Promise<FactoryAttentionReceiptRecord | null> {
    return this.#retryAttentionReceiptWrite(() =>
      this.storage.withTransaction(ops => this.#setAttentionReceiptWithOps(ops, input)),
    );
  }

  async #retryAttentionReceiptWrite<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write();
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      return write();
    }
  }

  /**
   * Per-kind currency predicate: a receipt may only target a source that still
   * projects an attention item FOR THIS USER — otherwise the route answers
   * 409. Without the mention-row check, any member could write receipts
   * against arbitrary comment ids and permanently skew their own badge math.
   */
  async #attentionSourceIsCurrent(
    ops: FactoryStorageOps,
    {
      orgId,
      factoryProjectId,
      userId,
      identity,
    }: { orgId: string; factoryProjectId: string; userId: string; identity: FactoryAttentionIdentity },
  ): Promise<boolean> {
    if (identity.kind === 'automation-failed') {
      let currentOccurrence = false;
      const decision = await ops.updateAtomic<GovernanceDbRow>(
        'factory_deferred_decisions',
        { id: identity.sourceId, org_id: orgId, factory_project_id: factoryProjectId },
        current => {
          currentOccurrence =
            current.status === 'failed' && Number(current.failure_occurrence ?? 0) === identity.occurrence;
          return null;
        },
      );
      return Boolean(decision) && currentOccurrence;
    }
    if (identity.kind === 'activity') {
      // Occurrence-exact: a bump since the read makes that receipt stale, and
      // the route answers 409. Scoped to this user or every badge would skew.
      const activity = await ops.findOne('work_item_activity', {
        work_item_id: identity.sourceId,
        participant_id: userId,
        org_id: orgId,
        factory_project_id: factoryProjectId,
        occurrence: identity.occurrence,
      });
      return activity !== null;
    }
    if (identity.kind === 'supervisor-finding') {
      const finding = await ops.findOne('factory_supervisor_findings', {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        finding_key: identity.sourceId,
        occurrence: identity.occurrence,
        resolved_at: null,
      });
      return finding !== null;
    }
    if (identity.occurrence !== 0) return false;
    const mention = await ops.findOne('work_item_comment_mentions', {
      comment_id: identity.sourceId,
      org_id: orgId,
      factory_project_id: factoryProjectId,
      mentioned_kind: 'user',
      mentioned_id: userId,
    });
    if (!mention) return false;
    const comment = await ops.findOne('work_item_comments', {
      id: identity.sourceId,
      org_id: orgId,
      factory_project_id: factoryProjectId,
      deleted_at: null,
    });
    return comment !== null;
  }

  async #setAttentionReceiptWithOps(
    ops: FactoryStorageOps,
    { orgId, factoryProjectId, userId, identity, action, now }: SetAttentionReceiptInput,
  ): Promise<FactoryAttentionReceiptRecord | null> {
    if (!(await this.#attentionSourceIsCurrent(ops, { orgId, factoryProjectId, userId, identity }))) return null;

    const where = {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      user_id: userId,
      kind: identity.kind,
      source_id: identity.sourceId,
      occurrence: identity.occurrence,
    };
    const existing = await ops.findOne<GovernanceDbRow>('factory_attention_receipts', where);
    if (!existing) {
      return toAttentionReceipt(
        await ops.insertOne<GovernanceDbRow>('factory_attention_receipts', {
          ...where,
          state: action === 'archive' ? 'archived' : 'read',
          read_at: now,
          archived_at: action === 'archive' ? now : null,
          created_at: now,
          updated_at: now,
        }),
      );
    }
    const row = await ops.updateAtomic<GovernanceDbRow>(
      'factory_attention_receipts',
      { id: existing.id, ...where },
      current => {
        const preserveArchive = action === 'read' && current.state === 'archived';
        const archived = action === 'archive' || preserveArchive;
        return {
          state: archived ? 'archived' : 'read',
          read_at: current.read_at,
          archived_at: action === 'archive' ? now : archived ? (current.archived_at ?? now) : null,
          updated_at: now,
        };
      },
    );
    return row ? toAttentionReceipt(row) : null;
  }

  async markAttentionReceiptsRead({
    orgId,
    factoryProjectId,
    userId,
    identities,
    now,
  }: {
    orgId: string;
    factoryProjectId: string;
    userId: string;
    identities: FactoryAttentionIdentity[];
    now: Date;
  }): Promise<void> {
    const uniqueIdentities = [
      ...new Map(
        identities.map(identity => [`${identity.kind}\0${identity.sourceId}\0${identity.occurrence}`, identity]),
      ).values(),
    ];
    for (let index = 0; index < uniqueIdentities.length; index += ATTENTION_RECEIPT_WRITE_BATCH_SIZE) {
      const batch = uniqueIdentities.slice(index, index + ATTENTION_RECEIPT_WRITE_BATCH_SIZE);
      await this.#retryAttentionReceiptWrite(() =>
        this.storage.withTransaction(async ops => {
          for (const identity of batch) {
            await this.#setAttentionReceiptWithOps(ops, {
              orgId,
              factoryProjectId,
              userId,
              identity,
              action: 'read',
              now,
            });
          }
        }),
      );
    }
  }

  async claimDeferredDecisions(input: FactoryLeaseClaimInput): Promise<FactoryDeferredDecisionRecord[]> {
    return this.#claimLeases('factory_deferred_decisions', input, toDeferredDecision);
  }

  async renewDeferredDecisionLease(identity: FactoryLeaseIdentity, leaseExpiresAt: Date): Promise<boolean> {
    return this.#renewLease('factory_deferred_decisions', identity, leaseExpiresAt);
  }

  async completeDeferredDecision(
    identity: FactoryLeaseIdentity,
    now: Date,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    const row = await this.#completeLease('factory_deferred_decisions', identity, now);
    return row ? toDeferredDecision(row) : null;
  }

  async failDeferredDecision(input: FactoryDispatchFailureInput): Promise<FactoryDeferredDecisionRecord | null> {
    const row = await this.#failLease('factory_deferred_decisions', input);
    if (!row) return null;
    const record = toDeferredDecision(row);
    // A retryable failure surfaces nothing; only a terminal one mints an item.
    if (input.terminal) this.#attentionChanged(record);
    return record;
  }

  /** Park a claimed effect for human approval; the dispatcher never claims `proposed` rows. */
  async proposeDeferredDecision(
    identity: FactoryLeaseIdentity,
    now: Date,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    let proposed = false;
    const row = await this.#db.updateAtomic<GovernanceDbRow>(
      'factory_deferred_decisions',
      { id: identity.id, org_id: identity.orgId, factory_project_id: identity.factoryProjectId },
      current => {
        if (current.status !== 'leased' || current.lease_owner !== identity.ownerId) return null;
        proposed = true;
        return {
          status: 'proposed',
          // The claim that parked it spent no effect, so it costs no attempt.
          attempts: 0,
          lease_owner: null,
          lease_expires_at: null,
          updated_at: now,
        };
      },
    );
    if (!proposed || !row) return null;
    const record = toDeferredDecision(row);
    this.#attentionChanged(record);
    return record;
  }

  /**
   * Release an approved effect back to the dispatcher; only `proposed` rows are
   * approvable. Approval is a person taking the item on, so the item's autonomy
   * is armed in the same transaction — a crash cannot release the run while
   * leaving its follow-up work parked for re-approval.
   */
  async approveDeferredDecision(
    orgId: string,
    factoryProjectId: string,
    decisionId: string,
    now: Date,
    approvedBy?: string,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    const approved = await this.storage.withTransaction(async ops => {
      let settled = false;
      const row = await ops.updateAtomic<GovernanceDbRow>(
        'factory_deferred_decisions',
        { id: decisionId, org_id: orgId, factory_project_id: factoryProjectId },
        current => {
          if (current.status !== 'proposed') return null;
          settled = true;
          return {
            status: 'pending',
            attempts: 0,
            available_at: now,
            approved_at: now,
            approved_by: approvedBy ?? null,
            updated_at: now,
          };
        },
      );
      if (!settled || !row) return null;
      const record = toDeferredDecision(row);
      if (record.workItemId) {
        await ops.updateAtomic<WorkItemDbRow>('work_items', { org_id: orgId, id: record.workItemId }, current =>
          current.autonomy_armed_at ? null : { autonomy_armed_at: now },
        );
      }
      return record;
    });
    if (approved) this.#attentionChanged(approved);
    return approved;
  }

  /** Retire a proposal nobody wants: `dismissed` is terminal, so the run never happens. */
  async dismissDeferredDecision(
    orgId: string,
    factoryProjectId: string,
    decisionId: string,
    now: Date,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    return this.#settleProposedDecision(
      { orgId, factoryProjectId, decisionId },
      { status: 'dismissed', updated_at: now, completed_at: now },
    );
  }

  /**
   * Automatically retire proposed or failed work that a newer run or terminal
   * work-item state has overtaken. Human dismissal remains `dismissed`.
   */
  async supersedeDecisionsForWorkItem(input: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    role?: string;
    supersededAt: Date;
  }): Promise<FactoryDeferredDecisionRecord[]> {
    const rows = await this.#db.findMany<GovernanceDbRow>('factory_deferred_decisions', {
      org_id: input.orgId,
      factory_project_id: input.factoryProjectId,
      work_item_id: input.workItemId,
      status: { in: ['proposed', 'failed'] },
    });
    const superseded: FactoryDeferredDecisionRecord[] = [];
    for (const row of rows) {
      const decision = toDeferredDecision(row);
      if (input.role !== undefined && decision.decision.role !== input.role) continue;
      const record =
        decision.status === 'proposed'
          ? await this.#settleProposedDecision(
              {
                orgId: input.orgId,
                factoryProjectId: input.factoryProjectId,
                decisionId: decision.id,
              },
              { status: 'superseded', updated_at: input.supersededAt, completed_at: input.supersededAt },
            )
          : await this.#resolveFailedDecision({
              orgId: input.orgId,
              factoryProjectId: input.factoryProjectId,
              decisionId: decision.id,
              status: 'superseded',
              now: input.supersededAt,
            });
      if (record) superseded.push(record);
    }
    return superseded;
  }

  async #settleProposedDecision(
    { orgId, factoryProjectId, decisionId }: { orgId: string; factoryProjectId: string; decisionId: string },
    patch: Partial<GovernanceDbRow>,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    let settled = false;
    const row = await this.#db.updateAtomic<GovernanceDbRow>(
      'factory_deferred_decisions',
      { id: decisionId, org_id: orgId, factory_project_id: factoryProjectId },
      current => {
        if (current.status !== 'proposed') return null;
        settled = true;
        return patch;
      },
    );
    if (!settled || !row) return null;
    const record = toDeferredDecision(row);
    this.#attentionChanged(record);
    return record;
  }

  async #resolveFailedDecision({
    orgId,
    factoryProjectId,
    decisionId,
    status,
    now,
  }: {
    orgId: string;
    factoryProjectId: string;
    decisionId: string;
    status: 'succeeded' | 'superseded';
    now: Date;
  }): Promise<FactoryDeferredDecisionRecord | null> {
    const resolved = await this.storage.withTransaction(async ops => {
      let resolved = false;
      const row = await ops.updateAtomic<GovernanceDbRow>(
        'factory_deferred_decisions',
        { id: decisionId, org_id: orgId, factory_project_id: factoryProjectId },
        current => {
          if (current.status !== 'failed') return null;
          resolved = true;
          return { status, updated_at: now };
        },
      );
      if (!resolved || !row) return null;
      await ops.deleteMany('factory_attention_receipts', {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        kind: 'automation-failed',
        source_id: decisionId,
        occurrence: Number(row.failure_occurrence ?? 0),
      });
      return toDeferredDecision(row);
    });
    if (resolved) this.#attentionChanged(resolved);
    return resolved;
  }

  async supersedeTerminalDecisionsForWorkItem(input: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    supersededAt: Date;
  }): Promise<void> {
    await this.supersedeDecisionsForWorkItem(input);
  }

  async repairLegacyAttentionState(): Promise<void> {
    let cursor: { values: Array<Date | string> } | undefined;
    const inspectedWorkItems = new Set<string>();
    while (true) {
      const rows = await this.#db.findMany<GovernanceDbRow>(
        'factory_deferred_decisions',
        { status: { in: ['failed', 'proposed'] } },
        {
          orderBy: [
            ['created_at', 'asc'],
            ['id', 'asc'],
          ],
          limit: ATTENTION_RECEIPT_QUERY_BATCH_SIZE + 1,
          ...(cursor ? { cursor } : {}),
        },
      );
      const page = rows.slice(0, ATTENTION_RECEIPT_QUERY_BATCH_SIZE);
      for (const row of page) {
        const decision = toDeferredDecision(row);
        if (
          decision.status === 'failed' &&
          decision.failureOccurrence === 0 &&
          deferredDecisionType(decision) === 'transition'
        ) {
          const ingress = await this.#db.findOne<GovernanceDbRow>('factory_rule_ingress', {
            org_id: decision.orgId,
            factory_project_id: decision.factoryProjectId,
            identity: `decision:${decision.idempotencyKey}`,
          });
          if (ingressWasAccepted(ingress)) {
            await this.#resolveFailedDecision({
              orgId: decision.orgId,
              factoryProjectId: decision.factoryProjectId,
              decisionId: decision.id,
              status: 'succeeded',
              now: new Date(),
            });
            continue;
          }
        }
        if (!decision.workItemId) continue;
        const itemKey = `${decision.orgId}\0${decision.factoryProjectId}\0${decision.workItemId}`;
        if (inspectedWorkItems.has(itemKey)) continue;
        inspectedWorkItems.add(itemKey);
        const item = await this.get({ orgId: decision.orgId, id: decision.workItemId });
        if (!item || !isTerminalFactoryRuleStage(item.stages)) continue;
        await this.supersedeDecisionsForWorkItem({
          orgId: decision.orgId,
          factoryProjectId: decision.factoryProjectId,
          workItemId: decision.workItemId,
          supersededAt: new Date(),
        });
      }
      const last = page.at(-1);
      if (rows.length <= ATTENTION_RECEIPT_QUERY_BATCH_SIZE || !last) return;
      if (!(last.created_at instanceof Date)) throw new Error('Deferred decision created_at is not a timestamp.');
      cursor = { values: [last.created_at, last.id] };
    }
  }

  /** Requeue the same idempotent terminal effect; non-failed decisions are never rerun. */
  async retryDeferredDecision(
    orgId: string,
    factoryProjectId: string,
    decisionId: string,
    now: Date,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    const retriedRecord = await this.storage.withTransaction(async ops => {
      let retried = false;
      const row = await ops.updateAtomic<GovernanceDbRow>(
        'factory_deferred_decisions',
        { id: decisionId, org_id: orgId, factory_project_id: factoryProjectId },
        current => {
          if (current.status !== 'failed') return null;
          retried = true;
          return {
            status: 'retry',
            attempts: 0,
            delivery_generation: Number(current.delivery_generation ?? 0) + 1,
            available_at: now,
            lease_owner: null,
            lease_expires_at: null,
            last_error: null,
            failure_code: null,
            completed_at: null,
            updated_at: now,
          };
        },
      );
      if (!retried || !row) return null;
      await ops.deleteMany('factory_attention_receipts', {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        kind: 'automation-failed',
        source_id: decisionId,
        occurrence: Number(row.failure_occurrence ?? 0),
      });
      return toDeferredDecision(row);
    });
    if (retriedRecord) this.#attentionChanged(retriedRecord);
    return retriedRecord;
  }

  /** Resolve exact active agent authority; partial session matches never authorize. */
  async findActiveRunBinding(address: FactoryRunBindingAddress): Promise<FactoryRunBindingRecord | null> {
    const row = await this.#db.findOne<GovernanceDbRow>('factory_run_bindings', {
      org_id: address.orgId,
      factory_project_id: address.factoryProjectId,
      thread_id: address.threadId,
      resource_id: address.resourceId,
      session_id: address.sessionId,
      status: 'active',
    });
    return row ? toBinding(row) : null;
  }

  /**
   * Recover the active binding for a thread when session state lost
   * `factoryProjectId` (e.g. crash-resume recreated the session empty).
   * Ambiguous matches across factory projects never authorize.
   */
  async findActiveRunBindingByThread(input: {
    orgId: string;
    threadId: string;
    resourceId: string;
    sessionId: string;
  }): Promise<FactoryRunBindingRecord | null> {
    const rows = await this.#db.findMany<GovernanceDbRow>('factory_run_bindings', {
      org_id: input.orgId,
      thread_id: input.threadId,
      resource_id: input.resourceId,
      session_id: input.sessionId,
      status: 'active',
    });
    if (new Set(rows.map(row => row.factory_project_id)).size !== 1) return null;
    const row = rows.sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0];
    return row ? toBinding(row) : null;
  }

  /** Resolve exact bound-session state for processor awareness; ambiguous cross-tenant matches return null. */
  async findRunBindingBySession(address: FactoryRunBindingSessionAddress): Promise<FactoryRunBindingRecord | null> {
    const rows = await this.#db.findMany<GovernanceDbRow>('factory_run_bindings', {
      factory_project_id: address.factoryProjectId,
      thread_id: address.threadId,
      resource_id: address.resourceId,
      session_id: address.sessionId,
    });
    if (new Set(rows.map(row => row.org_id)).size !== 1) return null;
    const row = rows.sort((left, right) => {
      if (left.status === 'active' && right.status !== 'active') return -1;
      if (right.status === 'active' && left.status !== 'active') return 1;
      return right.created_at.getTime() - left.created_at.getTime();
    })[0];
    return row ? toBinding(row) : null;
  }

  /** Revoke one exact tenant-scoped binding. */
  async revokeRunBinding(input: RevokeFactoryRunBindingInput): Promise<FactoryRunBindingRecord | null> {
    let revoked = false;
    const row = await this.#db.updateAtomic<GovernanceDbRow>(
      'factory_run_bindings',
      { id: input.bindingId, org_id: input.orgId, factory_project_id: input.factoryProjectId },
      current => {
        if (current.status !== 'active') return null;
        revoked = true;
        return { status: 'revoked', revoked_at: input.revokedAt };
      },
    );
    return revoked && row ? toBinding(row) : null;
  }

  /**
   * Revoke every active binding for one work item (all roles). Called from
   * terminal-stage cleanup so completed items stop paying the reconcile walk.
   * Returns the number of bindings revoked.
   */
  async revokeRunBindingsForWorkItem(input: RevokeFactoryRunBindingsForWorkItemInput): Promise<number> {
    return this.#db.updateMany(
      'factory_run_bindings',
      {
        org_id: input.orgId,
        factory_project_id: input.factoryProjectId,
        work_item_id: input.workItemId,
        status: 'active',
      },
      { status: 'revoked', revoked_at: input.revokedAt },
    );
  }

  /**
   * Revoke leaked/legacy active bindings: older than `olderThan`, or whose
   * work item is gone, malformed, or already terminal. Terminal-stage cleanup
   * handles bindings go-forward; this sweep drains anything that slipped past
   * it. Returns the number of bindings revoked.
   */
  async revokeStaleRunBindings(input: RevokeStaleFactoryRunBindingsInput): Promise<number> {
    const bindings = await this.listActiveRunBindings();
    const itemCache = new Map<string, WorkItemRow | null>();
    let revoked = 0;
    for (const binding of bindings) {
      let stale = binding.createdAt.getTime() < input.olderThan.getTime();
      if (!stale) {
        const key = `${binding.orgId}:${binding.workItemId}`;
        let item = itemCache.get(key);
        if (item === undefined) {
          item = await this.get({ orgId: binding.orgId, id: binding.workItemId });
          itemCache.set(key, item);
        }
        stale =
          !item ||
          item.stages.length !== 1 ||
          !ACTIVE_RUN_BINDING_STAGES.has(item.stages[0]!) ||
          item.factoryProjectId !== binding.factoryProjectId;
      }
      if (!stale) continue;
      const result = await this.revokeRunBinding({
        orgId: binding.orgId,
        factoryProjectId: binding.factoryProjectId,
        bindingId: binding.id,
        revokedAt: input.now,
      });
      if (result) revoked += 1;
    }
    return revoked;
  }

  /** Enumerate active bindings for the server-owned restart reconciler. */
  async listActiveRunBindings(): Promise<FactoryRunBindingRecord[]> {
    return (await this.#db.findMany<GovernanceDbRow>('factory_run_bindings', { status: 'active' })).map(toBinding);
  }

  /** List binding history, optionally narrowed to one work item. */
  async listRunBindings(
    orgId: string,
    factoryProjectId: string,
    workItemId?: string,
  ): Promise<FactoryRunBindingRecord[]> {
    return (
      await this.#db.findMany<GovernanceDbRow>(
        'factory_run_bindings',
        {
          org_id: orgId,
          factory_project_id: factoryProjectId,
          ...(workItemId ? { work_item_id: workItemId } : {}),
        },
        { orderBy: [['created_at', 'asc']] },
      )
    ).map(toBinding);
  }

  async listPendingStarts(orgId: string, factoryProjectId: string): Promise<FactoryPendingStartRecord[]> {
    return (
      await this.#db.findMany<GovernanceDbRow>(
        'factory_pending_starts',
        { org_id: orgId, factory_project_id: factoryProjectId },
        { orderBy: [['created_at', 'asc']] },
      )
    ).map(toPendingStart);
  }

  async claimPendingStarts(input: FactoryLeaseClaimInput): Promise<FactoryPendingStartRecord[]> {
    return this.#claimLeases('factory_pending_starts', input, toPendingStart);
  }

  async renewPendingStartLease(identity: FactoryLeaseIdentity, leaseExpiresAt: Date): Promise<boolean> {
    return this.#renewLease('factory_pending_starts', identity, leaseExpiresAt);
  }

  async completePendingStart(identity: FactoryLeaseIdentity, now: Date): Promise<FactoryPendingStartRecord | null> {
    const row = await this.#completeLease('factory_pending_starts', identity, now);
    return row ? toPendingStart(row) : null;
  }

  async failPendingStart(input: FactoryDispatchFailureInput): Promise<FactoryPendingStartRecord | null> {
    const row = await this.#failLease('factory_pending_starts', input);
    return row ? toPendingStart(row) : null;
  }

  async prepareRunStart(input: PrepareFactoryRunStartInput): Promise<PrepareFactoryRunStartResult> {
    const prepare = () =>
      this.storage.withTransaction(async ops => {
        const prior = await ops.findOne<GovernanceDbRow>('factory_pending_starts', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          kickoff_key: input.kickoffKey,
        });
        if (prior) {
          const bindingRow = await ops.findOne<GovernanceDbRow>('factory_run_bindings', {
            id: String(prior.binding_id),
            org_id: input.orgId,
            factory_project_id: input.factoryProjectId,
          });
          const itemRow =
            bindingRow &&
            (await ops.findOne<WorkItemDbRow>('work_items', {
              id: String(bindingRow.work_item_id),
              org_id: input.orgId,
              factory_project_id: input.factoryProjectId,
            }));
          if (!bindingRow || !itemRow) throw new Error('Factory start replay references missing state.');
          return {
            item: toRow(itemRow),
            binding: toBinding(bindingRow),
            pendingStart: toPendingStart(prior),
            replayed: true,
          };
        }
        const now = new Date();
        const create = input.workItem.input;
        let row = input.workItem.id
          ? await ops.findOne<WorkItemDbRow>('work_items', {
              id: input.workItem.id,
              org_id: input.orgId,
              factory_project_id: input.factoryProjectId,
            })
          : externalSourceKey(create.externalSource)
            ? await ops.findOne<WorkItemDbRow>('work_items', {
                org_id: input.orgId,
                factory_project_id: input.factoryProjectId,
                source_key: externalSourceKey(create.externalSource),
              })
            : null;
        let item: WorkItemRow;
        if (row) {
          row = await ops.updateAtomic<WorkItemDbRow>('work_items', { id: row.id }, current => {
            // Stamp only the starting role — `applyUpdate` merges sessions, so
            // other roles keep their own session and `startedBy` (#22254).
            return applyUpdate({ current, userId: input.userId, input: { sessions: { [input.role]: input.session } } });
          });
          item = toRow(row!);
        } else {
          if (create.parentWorkItemId)
            validateParentRelation(
              (
                await ops.findMany<WorkItemDbRow>('work_items', {
                  org_id: input.orgId,
                  factory_project_id: input.factoryProjectId,
                })
              ).map(toRow),
              undefined,
              create.parentWorkItemId,
            );
          row = await ops.insertOne<WorkItemDbRow>('work_items', {
            org_id: input.orgId,
            created_by: input.userId,
            factory_project_id: input.factoryProjectId,
            external_source: create.externalSource ?? null,
            source_key: externalSourceKey(create.externalSource),
            parent_work_item_id: create.parentWorkItemId ?? null,
            title: create.title,
            stages: create.stages ?? [],
            stage_history: applyStageTransition([], [], create.stages ?? [], input.userId, now),
            sessions: stampSessions({ [input.role]: input.session }, input.userId),
            metadata: create.metadata ?? null,
            revision: 1,
            created_at: now,
            updated_at: now,
          });
          item = toRow(row);
        }
        if (input.armAutonomy && !item.autonomyArmedAt) {
          const armedRow = await ops.updateAtomic<WorkItemDbRow>('work_items', { id: item.id }, current =>
            current.autonomy_armed_at ? null : { autonomy_armed_at: now },
          );
          if (armedRow) item = toRow(armedRow);
        }
        if (input.preapprovePlans && !item.plansPreapprovedAt) {
          const grantedRow = await ops.updateAtomic<WorkItemDbRow>('work_items', { id: item.id }, current =>
            current.plans_preapproved_at ? null : { plans_preapproved_at: now },
          );
          if (grantedRow) item = toRow(grantedRow);
        }
        await ops.updateMany(
          'factory_run_bindings',
          {
            org_id: input.orgId,
            factory_project_id: input.factoryProjectId,
            thread_id: input.session.threadId,
            resource_id: input.resourceId,
            session_id: input.session.sessionId,
            status: 'active',
          },
          { status: 'revoked', revoked_at: now },
        );
        await ops.updateMany(
          'factory_run_bindings',
          {
            org_id: input.orgId,
            factory_project_id: input.factoryProjectId,
            work_item_id: item.id,
            role: input.role,
            status: 'active',
          },
          { status: 'revoked', revoked_at: now },
        );
        const bindingRow = await ops.insertOne<GovernanceDbRow>('factory_run_bindings', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          work_item_id: item.id,
          role: input.role,
          thread_id: input.session.threadId,
          resource_id: input.resourceId,
          session_id: input.session.sessionId,
          branch: input.session.branch,
          status: 'active',
          created_at: now,
          revoked_at: null,
        });
        const pendingRow = await ops.insertOne<GovernanceDbRow>('factory_pending_starts', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          binding_id: bindingRow.id,
          kickoff_key: input.kickoffKey,
          message: input.kickoffMessage,
          status: 'pending',
          attempts: 0,
          available_at: now,
          lease_owner: null,
          lease_expires_at: null,
          last_error: null,
          failure_code: null,
          completed_at: null,
          created_at: now,
          updated_at: now,
        });
        return { item, binding: toBinding(bindingRow), pendingStart: toPendingStart(pendingRow), replayed: false };
      });
    // A losing preparer can hit two distinct unique violations back to back:
    // first on the work item's `source_key`, then on the pending start's
    // `kickoff_key` (when the winner commits its pending row between our
    // attempts). Each retry re-reads, so one extra attempt converges on replay.
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await prepare();
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  async markPendingStart(
    bindingId: string,
    status: 'sent' | 'failed',
    lastError?: string,
  ): Promise<FactoryPendingStartRecord | null> {
    const row = await this.#db.updateAtomic<GovernanceDbRow>(
      'factory_pending_starts',
      { binding_id: bindingId },
      () => ({ status, last_error: lastError ?? null, updated_at: new Date() }),
    );
    return row ? toPendingStart(row) : null;
  }

  /**
   * Create a work item, reusing the existing record when `sourceKey` already
   * has one for the project (acting twice on the same issue must not duplicate
   * the card). On reuse the provided stages replace the current ones (with the
   * transition recorded in history) and sessions/metadata are merged in. The
   * result discriminates insert from reuse so callers can audit the actual
   * outcome.
   */
  async upsert(params: {
    orgId: string;
    userId: string;
    factoryProjectId: string;
    input: CreateWorkItemInput;
    reuseMode?: 'update' | 'preserve' | 'non-stage';
  }): Promise<UpsertWorkItemResult> {
    const run = (ops: FactoryStorageOps) => this.#upsert(params, ops);
    const execute = () =>
      params.input.parentWorkItemId
        ? this.#withProjectRelationTransaction(params.orgId, params.factoryProjectId, run)
        : run(this.#db);
    try {
      return await execute();
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      return execute();
    }
  }

  async #upsert(
    {
      orgId,
      userId,
      factoryProjectId,
      input,
      reuseMode = 'update',
    }: {
      orgId: string;
      userId: string;
      factoryProjectId: string;
      input: CreateWorkItemInput;
      reuseMode?: 'update' | 'preserve' | 'non-stage';
    },
    ops: FactoryStorageOps,
  ): Promise<UpsertWorkItemResult> {
    const key = externalSourceKey(input.externalSource);
    const reuse = async (): Promise<UpsertWorkItemResult | null> => {
      if (!key) return null;
      const existing = await ops.findOne<WorkItemDbRow>('work_items', {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        source_key: key,
      });
      if (!existing) return null;
      if (reuseMode === 'preserve') {
        const item = toWorkItem(existing);
        return { created: false, item, previous: priorState(existing) };
      }

      let previous = emptyPrior();
      const updated = await ops.updateAtomic<WorkItemDbRow>(
        'work_items',
        { org_id: orgId, factory_project_id: factoryProjectId, source_key: key },
        async current => {
          previous = priorState(current);
          const fullPatch = input.parentWorkItemId === null ? { ...input, parentWorkItemId: undefined } : input;
          const patch: UpdateWorkItemInput =
            reuseMode === 'non-stage'
              ? {
                  title: input.title,
                  parentWorkItemId: input.parentWorkItemId ?? undefined,
                  metadata: input.metadata,
                }
              : fullPatch;
          if (patch.parentWorkItemId !== undefined) {
            validateParentRelation(
              await this.#listWithOps(ops, orgId, factoryProjectId),
              current.id,
              patch.parentWorkItemId,
            );
          }
          return {
            external_source: input.externalSource ?? null,
            ...applyUpdate({ current, userId, input: patch }),
          };
        },
      );
      return updated ? { item: toWorkItem(updated), created: false, previous } : null;
    };

    const reused = await reuse();
    if (reused) return reused;

    const now = new Date();
    const stages = input.stages ?? ['intake'];
    validateParentRelation(
      await this.#listWithOps(ops, orgId, factoryProjectId),
      undefined,
      input.parentWorkItemId ?? null,
    );
    const row = await ops.insertOne<WorkItemDbRow>('work_items', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      external_source: input.externalSource ?? null,
      source_key: key,
      parent_work_item_id: input.parentWorkItemId ?? null,
      title: input.title,
      stages,
      stage_history: stages.map(stage => ({ stage, enteredAt: now.toISOString(), by: userId })),
      sessions: stampSessions(input.sessions ?? {}, userId),
      metadata: input.metadata ?? null,
      revision: 1,
      created_by: userId,
      created_at: now,
      updated_at: now,
    });
    return { item: toWorkItem(row), created: true, previous: emptyPrior() };
  }

  async setParentWorkItemIfMissing({
    orgId,
    id,
    userId,
    parentWorkItemId,
  }: {
    orgId: string;
    id: string;
    userId: string;
    parentWorkItemId: string;
  }): Promise<WorkItemRow | null> {
    const candidate = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
    if (!candidate) return null;

    return this.#withProjectRelationTransaction(orgId, candidate.factory_project_id, async ops => {
      const row = await ops.updateAtomic<WorkItemDbRow>('work_items', { org_id: orgId, id }, async current => {
        if (current.parent_work_item_id !== null) return current;
        validateParentRelation(
          await this.#listWithOps(ops, orgId, current.factory_project_id),
          current.id,
          parentWorkItemId,
        );
        return applyUpdate({ current, userId, input: { parentWorkItemId } });
      });
      return row ? toWorkItem(row) : null;
    });
  }

  async update({
    orgId,
    id,
    userId,
    patch,
  }: {
    orgId: string;
    id: string;
    userId: string;
    patch: UpdateWorkItemInput;
  }): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
    const run = async (ops: FactoryStorageOps) => {
      let previous = emptyPrior();
      const row = await ops.updateAtomic<WorkItemDbRow>('work_items', { org_id: orgId, id }, async current => {
        previous = priorState(current);
        if (patch.parentWorkItemId !== undefined) {
          validateParentRelation(
            await this.#listWithOps(ops, orgId, current.factory_project_id),
            current.id,
            patch.parentWorkItemId,
          );
        }
        return applyUpdate({ current, userId, input: patch });
      });
      return row ? { item: toWorkItem(row), previous } : null;
    };

    if (patch.parentWorkItemId === undefined) return run(this.#db);
    const candidate = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
    if (!candidate) return null;
    return this.#withProjectRelationTransaction(orgId, candidate.factory_project_id, run);
  }

  /**
   * Record that a person committed this item to the Factory. Only the first
   * time counts: the timestamp marks when the item stopped needing permission,
   * so later runs must not push it forward. Bumps no revision, because arming
   * is not a change anyone is editing against.
   */
  async armAutonomy({ orgId, id, now }: { orgId: string; id: string; now: Date }): Promise<void> {
    await this.#db.updateAtomic<WorkItemDbRow>('work_items', { org_id: orgId, id }, current =>
      current.autonomy_armed_at ? null : { autonomy_armed_at: now },
    );
  }

  /**
   * Drop the governance rows that materialized a source key so a deleted work item
   * is not resurrected by the prior-ingress replay path on the next intake poll.
   */
  async #purgeRuleState(
    ops: FactoryStorageOps,
    { orgId, factoryProjectId, sourceKey }: { orgId: string; factoryProjectId: string; sourceKey: string },
  ): Promise<void> {
    const decisions = await ops.findMany<GovernanceDbRow>('factory_deferred_decisions', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      source_key: sourceKey,
    });
    if (decisions.length === 0) return;

    const evaluationIds = [...new Set(decisions.map(decision => String(decision.evaluation_id)))];
    const ingressIds = new Set<string>();
    for (const evaluationId of evaluationIds) {
      const evaluation = await ops.findOne<GovernanceDbRow>('factory_rule_evaluations', { id: evaluationId });
      if (evaluation) ingressIds.add(String(evaluation.ingress_id));
    }

    const decisionIds = decisions.map(decision => decision.id);
    for (let index = 0; index < decisionIds.length; index += ATTENTION_RECEIPT_QUERY_BATCH_SIZE) {
      await ops.deleteMany('factory_attention_receipts', {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        kind: 'automation-failed',
        source_id: { in: decisionIds.slice(index, index + ATTENTION_RECEIPT_QUERY_BATCH_SIZE) },
      });
    }

    await ops.deleteMany('factory_deferred_decisions', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      source_key: sourceKey,
    });
    for (const evaluationId of evaluationIds) {
      await ops.deleteMany('factory_rule_evaluations', { id: evaluationId });
    }
    for (const ingressId of ingressIds) {
      const remaining = await ops.findMany<GovernanceDbRow>('factory_rule_evaluations', { ingress_id: ingressId });
      if (remaining.length === 0) await ops.deleteMany('factory_rule_ingress', { id: ingressId });
    }
  }

  /**
   * Feed rows die with their work item: orphan mention rows would keep
   * projecting attention items that deep-link to a card that no longer exists.
   */
  async #purgeFeedState(
    ops: FactoryStorageOps,
    { orgId, factoryProjectId, workItemId }: { orgId: string; factoryProjectId: string; workItemId: string },
  ): Promise<void> {
    // Paged harvest: this runs inside the delete transaction and a long-lived
    // item can carry thousands of comments — never materialize them all.
    const where = { org_id: orgId, factory_project_id: factoryProjectId, work_item_id: workItemId };
    while (true) {
      const comments = await ops.findMany<{ id: string } & Record<string, unknown>>('work_item_comments', where, {
        limit: ATTENTION_RECEIPT_QUERY_BATCH_SIZE,
      });
      if (comments.length === 0) break;
      const commentIds = comments.map(comment => comment.id);
      await ops.deleteMany('factory_attention_receipts', {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        kind: 'mention',
        source_id: { in: commentIds },
      });
      await ops.deleteMany('work_item_comments', { ...where, id: { in: commentIds } });
      if (comments.length < ATTENTION_RECEIPT_QUERY_BATCH_SIZE) break;
    }
    await ops.deleteMany('work_item_comment_mentions', where);
    // Activity is keyed on the item, so one statement covers every occurrence
    // and every participant.
    await ops.deleteMany('factory_attention_receipts', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      kind: 'activity',
      source_id: workItemId,
    });
    await ops.deleteMany('work_item_activity', where);
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<WorkItemRow | null> {
    const candidate = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
    if (!candidate) return null;

    const removed = await this.#withProjectRelationTransaction(orgId, candidate.factory_project_id, async ops => {
      const existing = await ops.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
      if (!existing) return null;
      const deleted = await ops.deleteMany('work_items', { org_id: orgId, id });
      if (deleted === 0) return null;
      await this.#purgeFeedState(ops, { orgId, factoryProjectId: existing.factory_project_id, workItemId: id });
      if (existing.source_key) {
        await this.#purgeRuleState(ops, {
          orgId,
          factoryProjectId: existing.factory_project_id,
          sourceKey: existing.source_key,
        });
      }
      await ops.updateMany(
        'work_items',
        { org_id: orgId, parent_work_item_id: id },
        { parent_work_item_id: null, updated_at: new Date() },
      );
      return toWorkItem(existing);
    });
    if (removed) this.#attentionChanged(removed);
    return removed;
  }
}
