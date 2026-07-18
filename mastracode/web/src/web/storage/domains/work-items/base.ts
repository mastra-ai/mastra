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
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

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
  externalId: string;
  url?: string;
}

export interface WorkItemStageEntry {
  stage: WorkItemStage;
  enteredAt: string;
  exitedAt?: string;
  by: string;
}

export interface WorkItemSessionRef {
  projectPath: string;
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

export type FactoryDispatchStatus = 'pending' | 'leased' | 'retry' | 'succeeded' | 'failed';

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
  availableAt: Date;
  leaseOwner: string | null;
  leaseExpiresAt: Date | null;
  lastError: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface FactoryRunBindingSessionAddress {
  factoryProjectId: string;
  threadId: string;
  resourceId: string;
  projectPath: string;
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

export interface FactoryRunBindingRecord {
  id: string;
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  role: string;
  threadId: string;
  resourceId: string;
  projectPath: string;
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
  terminal: boolean;
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
}

export interface PrepareFactoryRunStartResult {
  item: WorkItemRow;
  binding: FactoryRunBindingRecord;
  pendingStart: FactoryPendingStartRecord;
  replayed: boolean;
}

/** Session ref as accepted from clients — `startedBy` is stamped server-side. */
export interface WorkItemSessionInput {
  projectPath: string;
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
      name: 'work_items_org_project_updated_at_idx',
      columns: ['org_id', 'factory_project_id', 'updated_at'],
    },
    {
      name: 'work_items_project_parent_idx',
      columns: ['org_id', 'factory_project_id', 'parent_work_item_id'],
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
  revision: number;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

function sourceKey(source: ExternalWorkItemSource | null | undefined): string | null {
  return source ? `${source.integrationId}:${source.type}:${source.externalId}` : null;
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
      idempotency_key: { type: 'text' },
      effect_ordinal: { type: 'integer' },
      effect_hash: { type: 'text' },
      causal_chain: { type: 'json' },
      actor: { type: 'json', nullable: true },
      decision: { type: 'json' },
      status: { type: 'text' },
      attempts: { type: 'integer' },
      available_at: { type: 'timestamp' },
      lease_owner: { type: 'text', nullable: true },
      lease_expires_at: { type: 'timestamp', nullable: true },
      last_error: { type: 'text', nullable: true },
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
      project_path: { type: 'text' },
      branch: { type: 'text' },
      status: { type: 'text' },
      created_at: { type: 'timestamp' },
      revoked_at: { type: 'timestamp', nullable: true },
    },
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
    projectPath: String(row.project_path),
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
    availableAt: row.available_at as Date,
    leaseOwner: (row.lease_owner as string | null) ?? null,
    leaseExpiresAt: (row.lease_expires_at as Date | null) ?? null,
    lastError: (row.last_error as string | null) ?? null,
    completedAt: (row.completed_at as Date | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at as Date,
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
    completedAt: (row.completed_at as Date | null) ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at as Date,
  };
}

export class WorkItemsStorage extends FactoryStorageDomain {
  constructor() {
    super('work-items');
  }

  async init(): Promise<void> {
    await this.ensureCollections([WORK_ITEMS_SCHEMA, ...FACTORY_GOVERNANCE_SCHEMAS]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('work_items', {});
  }

  #leaseQueue: Promise<void> = Promise.resolve();

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #withLocalLeaseLock<T>(fn: () => Promise<T>): Promise<T> {
    const prior = this.#leaseQueue;
    let release!: () => void;
    this.#leaseQueue = new Promise<void>(resolve => {
      release = resolve;
    });
    await prior;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  async #withProjectRelationLock<T>(orgId: string, factoryProjectId: string, fn: () => Promise<T>): Promise<T> {
    const key = `work-items:${orgId}:${factoryProjectId}`;
    return withInProcessProjectLock(key, () =>
      this.storage.withDistributedLock ? this.storage.withDistributedLock(key, fn) : fn(),
    );
  }

  async #claimLeases<T>(
    table: 'factory_deferred_decisions' | 'factory_pending_starts',
    input: FactoryLeaseClaimInput,
    map: (row: GovernanceDbRow) => T,
  ): Promise<T[]> {
    const claim = () =>
      this.storage.withTransaction(async ops => {
        const candidates = await ops.findMany<GovernanceDbRow>(table, {}, { orderBy: [['created_at', 'asc']] });
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
    return this.storage.withDistributedLock
      ? this.storage.withDistributedLock(`factory-lease:${table}`, claim)
      : this.#withLocalLeaseLock(claim);
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
          available_at: input.availableAt,
          lease_owner: null,
          lease_expires_at: null,
          last_error: input.lastError,
          completed_at: input.terminal ? input.now : null,
          updated_at: input.now,
        };
      },
    );
    return failed ? row : null;
  }

  /** List the org's work items for a project, newest first. */
  async list({ orgId, factoryProjectId }: { orgId: string; factoryProjectId: string }): Promise<WorkItemRow[]> {
    const rows = await this.#db.findMany<WorkItemDbRow>(
      'work_items',
      { org_id: orgId, factory_project_id: factoryProjectId },
      { orderBy: [['updated_at', 'desc']] },
    );
    return rows.map(toWorkItem);
  }

  async get({ orgId, id }: { orgId: string; id: string }): Promise<WorkItemRow | null> {
    const row = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
    return row ? toWorkItem(row) : null;
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
            if (existing.stages.length === 1 && existing.stages[0] === input.destinationStage) return null;
            return patchColumns({
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
              await ops.insertOne<GovernanceDbRow>('factory_deferred_decisions', {
                org_id: input.orgId,
                factory_project_id: input.factoryProjectId,
                evaluation_id: evaluation.id,
                work_item_id: item.id,
                idempotency_key: String(decision.idempotencyKey),
                effect_ordinal: index,
                effect_hash: factoryDecisionHash(decision),
                causal_chain: input.causalChain,
                actor: null,
                decision,
                status: 'pending',
                attempts: 0,
                available_at: now,
                lease_owner: null,
                lease_expires_at: null,
                last_error: null,
                completed_at: null,
                created_at: new Date(now.getTime() + index),
                updated_at: now,
              });
            }
          }
        }
        return { status: 'committed', item, result };
      });
    return this.storage.withDistributedLock
      ? this.storage.withDistributedLock(
          `factory-ingress:${input.orgId}:${input.factoryProjectId}:${input.ingress.identity}`,
          commit,
        )
      : commit();
  }

  async commitRuleEvaluation(input: CommitFactoryRuleEvaluationInput): Promise<CommitFactoryRuleEvaluationResult> {
    const commit = () =>
      this.storage.withTransaction<CommitFactoryRuleEvaluationResult>(async ops => {
        const prior = await ops.findOne<GovernanceDbRow>('factory_rule_ingress', {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          identity: input.ingress.identity,
        });
        if (prior) return { status: 'replayed' as const, result: prior.result as Record<string, unknown> };
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
            idempotency_key: String(decision.idempotencyKey),
            effect_ordinal: effectOrdinal,
            effect_hash: factoryDecisionHash(decision),
            causal_chain: input.causalChain,
            actor: input.actor,
            decision,
            status: 'pending',
            attempts: 0,
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
    return this.storage.withDistributedLock
      ? this.storage.withDistributedLock(
          `factory-ingress:${input.orgId}:${input.factoryProjectId}:${input.ingress.identity}`,
          commit,
        )
      : commit();
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
    return row ? toDeferredDecision(row) : null;
  }

  /** Requeue the same idempotent terminal effect; non-failed decisions are never rerun. */
  async retryDeferredDecision(
    orgId: string,
    factoryProjectId: string,
    decisionId: string,
    now: Date,
  ): Promise<FactoryDeferredDecisionRecord | null> {
    let retried = false;
    const row = await this.#db.updateAtomic<GovernanceDbRow>(
      'factory_deferred_decisions',
      { id: decisionId, org_id: orgId, factory_project_id: factoryProjectId },
      current => {
        if (current.status !== 'failed') return null;
        retried = true;
        return {
          status: 'retry',
          attempts: 0,
          available_at: now,
          lease_owner: null,
          lease_expires_at: null,
          last_error: null,
          completed_at: null,
          updated_at: now,
        };
      },
    );
    return retried && row ? toDeferredDecision(row) : null;
  }

  /** Resolve exact active agent authority; partial session matches never authorize. */
  async findActiveRunBinding(address: FactoryRunBindingAddress): Promise<FactoryRunBindingRecord | null> {
    const row = await this.#db.findOne<GovernanceDbRow>('factory_run_bindings', {
      org_id: address.orgId,
      factory_project_id: address.factoryProjectId,
      thread_id: address.threadId,
      resource_id: address.resourceId,
      project_path: address.projectPath,
      status: 'active',
    });
    return row ? toBinding(row) : null;
  }

  /** Resolve exact bound-session state for processor awareness; ambiguous cross-tenant matches return null. */
  async findRunBindingBySession(address: FactoryRunBindingSessionAddress): Promise<FactoryRunBindingRecord | null> {
    const rows = await this.#db.findMany<GovernanceDbRow>('factory_run_bindings', {
      factory_project_id: address.factoryProjectId,
      thread_id: address.threadId,
      resource_id: address.resourceId,
      project_path: address.projectPath,
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
          : sourceKey(create.externalSource)
            ? await ops.findOne<WorkItemDbRow>('work_items', {
                org_id: input.orgId,
                factory_project_id: input.factoryProjectId,
                source_key: sourceKey(create.externalSource),
              })
            : null;
        let item: WorkItemRow;
        if (row) {
          row = await ops.updateAtomic<WorkItemDbRow>('work_items', { id: row.id }, current => {
            const roles = new Set([...Object.keys(current.sessions), input.role]);
            const sessions = Object.fromEntries([...roles].map(role => [role, input.session]));
            return applyUpdate({ current, userId: input.userId, input: { sessions } });
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
            source_key: sourceKey(create.externalSource),
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
          project_path: input.session.projectPath,
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
          completed_at: null,
          created_at: now,
          updated_at: now,
        });
        return { item, binding: toBinding(bindingRow), pendingStart: toPendingStart(pendingRow), replayed: false };
      });
    return this.storage.withDistributedLock
      ? this.storage.withDistributedLock(
          `factory-start:${input.orgId}:${input.factoryProjectId}:${input.kickoffKey}`,
          prepare,
        )
      : prepare();
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
    const run = () => this.#upsert(params);
    return params.input.parentWorkItemId
      ? this.#withProjectRelationLock(params.orgId, params.factoryProjectId, run)
      : run();
  }

  async #upsert({
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
  }): Promise<UpsertWorkItemResult> {
    const key = sourceKey(input.externalSource);
    const reuse = async (): Promise<UpsertWorkItemResult | null> => {
      if (!key) return null;
      const existing = await this.#db.findOne<WorkItemDbRow>('work_items', {
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
      const updated = await this.#db.updateAtomic<WorkItemDbRow>(
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
            validateParentRelation(await this.list({ orgId, factoryProjectId }), current.id, patch.parentWorkItemId);
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
    try {
      validateParentRelation(await this.list({ orgId, factoryProjectId }), undefined, input.parentWorkItemId ?? null);
      const row = await this.#db.insertOne<WorkItemDbRow>('work_items', {
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
    } catch (error) {
      if (!(error instanceof UniqueViolationError)) throw error;
      const winner = await reuse();
      if (winner) return winner;
      throw error;
    }
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
    const run = async () => {
      let previous = emptyPrior();
      const row = await this.#db.updateAtomic<WorkItemDbRow>('work_items', { org_id: orgId, id }, async current => {
        previous = priorState(current);
        if (patch.parentWorkItemId !== undefined) {
          validateParentRelation(
            await this.list({ orgId, factoryProjectId: current.factory_project_id }),
            current.id,
            patch.parentWorkItemId,
          );
        }
        return applyUpdate({ current, userId, input: patch });
      });
      return row ? { item: toWorkItem(row), previous } : null;
    };

    if (patch.parentWorkItemId === undefined) return run();
    const candidate = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
    if (!candidate) return null;
    return this.#withProjectRelationLock(orgId, candidate.factory_project_id, run);
  }

  async delete({ orgId, id }: { orgId: string; id: string }): Promise<WorkItemRow | null> {
    const candidate = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
    if (!candidate) return null;

    return this.#withProjectRelationLock(orgId, candidate.factory_project_id, async () => {
      const existing = await this.#db.findOne<WorkItemDbRow>('work_items', { org_id: orgId, id });
      if (!existing) return null;
      const deleted = await this.#db.deleteMany('work_items', { org_id: orgId, id });
      if (deleted === 0) return null;
      await this.#db.updateMany(
        'work_items',
        { org_id: orgId, parent_work_item_id: id },
        { parent_work_item_id: null, updated_at: new Date() },
      );
      return toWorkItem(existing);
    });
  }
}
