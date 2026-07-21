/**
 * Factory work-items storage domain.
 *
 * Work items belong to a first-class Factory project. External intake items use
 * a provider-neutral source reference; manual work items have no source.
 * Stage history is server-owned, while session and metadata patches merge
 * atomically so concurrent actors do not overwrite each other.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

export type WorkItemStage = string;

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
    factoryProjectId: row.factory_project_id,
    externalSource: row.external_source,
    parentWorkItemId: row.parent_work_item_id,
    title: row.title,
    stages: row.stages,
    stageHistory: row.stage_history,
    sessions: row.sessions,
    metadata: row.metadata,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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

export class WorkItemsStorage extends FactoryStorageDomain {
  constructor() {
    super('work-items');
  }

  async init(): Promise<void> {
    await this.ensureCollections([WORK_ITEMS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('work_items', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  async #withProjectRelationLock<T>(orgId: string, factoryProjectId: string, fn: () => Promise<T>): Promise<T> {
    const key = `work-items:${orgId}:${factoryProjectId}`;
    return withInProcessProjectLock(key, () =>
      this.storage.withDistributedLock ? this.storage.withDistributedLock(key, fn) : fn(),
    );
  }

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

  async upsert(params: {
    orgId: string;
    userId: string;
    factoryProjectId: string;
    input: CreateWorkItemInput;
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
  }: {
    orgId: string;
    userId: string;
    factoryProjectId: string;
    input: CreateWorkItemInput;
  }): Promise<UpsertWorkItemResult> {
    const key = sourceKey(input.externalSource);
    const reuse = async (): Promise<UpsertWorkItemResult | null> => {
      if (!key) return null;
      let previous = emptyPrior();
      const updated = await this.#db.updateAtomic<WorkItemDbRow>(
        'work_items',
        { org_id: orgId, factory_project_id: factoryProjectId, source_key: key },
        async current => {
          previous = priorState(current);
          const patch = input.parentWorkItemId === null ? { ...input, parentWorkItemId: undefined } : input;
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
