/**
 * In-memory work item storage for unit tests. Patch semantics come from the
 * shared `computeWorkItemPatch` in `./base`, so behavior matches the Postgres
 * implementation; single-process access stands in for `FOR UPDATE`.
 */

import { randomUUID } from 'node:crypto';

import {
  WorkItemsStorage,
  applyStageTransition,
  computeWorkItemPatch,
  stampSessions,
  validateParentRelation,
} from './base';
import type {
  CreateWorkItemInput,
  UpdateWorkItemInput,
  UpsertWorkItemResult,
  WorkItemPriorState,
  WorkItemRow,
} from './base';

export class WorkItemsStorageInMemory extends WorkItemsStorage {
  #items = new Map<string, WorkItemRow>();

  async init(): Promise<void> {
    // Nothing to set up.
  }

  #clone(row: WorkItemRow): WorkItemRow {
    return structuredClone(row);
  }

  #projectItems(orgId: string, githubProjectId: string): WorkItemRow[] {
    return [...this.#items.values()].filter(item => item.orgId === orgId && item.githubProjectId === githubProjectId);
  }

  async list(orgId: string, githubProjectId: string): Promise<WorkItemRow[]> {
    return [...this.#items.values()]
      .filter(item => item.orgId === orgId && item.githubProjectId === githubProjectId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .map(item => this.#clone(item));
  }

  async upsert(params: {
    orgId: string;
    userId: string;
    githubProjectId: string;
    input: CreateWorkItemInput;
  }): Promise<UpsertWorkItemResult> {
    const { orgId, userId, githubProjectId, input } = params;
    const now = new Date();

    if (input.sourceKey !== null) {
      const existing = [...this.#items.values()].find(
        item => item.githubProjectId === githubProjectId && item.sourceKey === input.sourceKey,
      );
      if (existing) {
        const patch = input.parentWorkItemId === null ? { ...input, parentWorkItemId: undefined } : input;
        const updated = this.#applyPatch(existing, patch, userId, now);
        return { created: false, item: updated.item, previous: updated.previous };
      }
    }

    validateParentRelation(this.#projectItems(orgId, githubProjectId), undefined, input.parentWorkItemId ?? null);
    const row: WorkItemRow = {
      id: randomUUID(),
      orgId,
      createdBy: userId,
      githubProjectId,
      source: input.source,
      sourceKey: input.sourceKey,
      parentWorkItemId: input.parentWorkItemId ?? null,
      title: input.title,
      url: input.url,
      stages: input.stages,
      stageHistory: applyStageTransition([], [], input.stages, userId, now),
      sessions: stampSessions(input.sessions, userId),
      metadata: input.metadata,
      createdAt: now,
      updatedAt: now,
    };
    this.#items.set(row.id, structuredClone(row));
    return { created: true, item: row };
  }

  #applyPatch(
    existing: WorkItemRow,
    patch: UpdateWorkItemInput,
    userId: string,
    now: Date,
  ): { item: WorkItemRow; previous: WorkItemPriorState } {
    if (patch.parentWorkItemId !== undefined) {
      validateParentRelation(
        this.#projectItems(existing.orgId, existing.githubProjectId),
        existing.id,
        patch.parentWorkItemId,
      );
    }
    const { changes, previous } = computeWorkItemPatch(existing, patch, userId, now);
    const updated = { ...existing, ...changes };
    this.#items.set(updated.id, structuredClone(updated));
    return { item: this.#clone(updated), previous };
  }

  async update(
    orgId: string,
    id: string,
    userId: string,
    patch: UpdateWorkItemInput,
  ): Promise<{ item: WorkItemRow; previous: WorkItemPriorState } | null> {
    const existing = this.#items.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    return this.#applyPatch(existing, patch, userId, new Date());
  }

  async delete(orgId: string, id: string): Promise<WorkItemRow | null> {
    const existing = this.#items.get(id);
    if (!existing || existing.orgId !== orgId) return null;
    this.#items.delete(id);
    for (const item of this.#items.values()) {
      if (item.orgId === orgId && item.parentWorkItemId === id) {
        item.parentWorkItemId = null;
        item.updatedAt = new Date();
      }
    }
    return this.#clone(existing);
  }
}
