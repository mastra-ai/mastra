import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import type { CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import { WORK_ITEM_PROVIDER_ADAPTERS, workItemProviderAdapter } from '../../../work-items/providers/index.js';
import type { ExternalWorkItemSource } from './base.js';
import type { BoardScope } from './board-version.js';
import { FACTORY_WORK_ITEMS_SCHEMA, FACTORY_WORK_ITEM_SOURCES_SCHEMA } from './work-item-schema.js';
import type { WorkItemDbRecord, WorkItemSourceDbRecord, WorkItemSourceRow } from './work-item-schema.js';

/**
 * An intake candidate is an open external record with no card: a work item and its source row,
 * marked `candidate`, with no board item. Filing a card adopts both rows; deleting the card of a
 * record that is still open leaves them behind as a candidate again.
 */

const WORK_ITEMS = FACTORY_WORK_ITEMS_SCHEMA.name;
const SOURCES = FACTORY_WORK_ITEM_SOURCES_SCHEMA.name;

export interface CandidateInput {
  orgId: string;
  factoryProjectId: string;
  source: ExternalWorkItemSource;
  title: string;
  description?: string | null;
  metadata: Record<string, unknown> | null;
  /** When the provider created the record; the list shows the newest first. */
  createdAt?: Date | null;
  /**
   * What the caller read of this record before it decided to store it: the candidate it found, or
   * `null` for none. When the stored record is no longer that, nothing is written. Left out by a
   * caller that holds the newest fact, as an event does.
   */
  expected?: CandidateVersion | null;
}

/** One stored state of a candidate. A candidate removed and stored again has another id. */
export interface CandidateVersion {
  id: string;
  revision: number;
}

/**
 * `carded`: the record already has a card, so nothing was stored. `stale`: the record was stored,
 * changed or removed since the caller read it, so nothing was stored either.
 */
export type CandidateWrite = 'created' | 'updated' | 'unchanged' | 'carded' | 'stale';

export interface CandidateRows {
  source: WorkItemSourceDbRecord;
  work: WorkItemDbRecord;
}

export interface CandidateListInput {
  orgId: string;
  factoryProjectId: string;
  sourceType?: string;
  integrationId?: string;
  /** The last candidate of the previous page. */
  after?: { createdAt: Date; id: string };
  limit: number;
}

function sourceWhere(scope: { orgId: string; factoryProjectId: string }, source: ExternalWorkItemSource) {
  const facts = workItemProviderAdapter(source).toSource(source, null);
  if (!facts) throw new Error('An intake candidate needs an external source.');
  return {
    org_id: scope.orgId,
    factory_project_id: scope.factoryProjectId,
    provider: facts.provider,
    external_id: facts.externalId,
  };
}

/** Whether a card's source stays behind as a candidate once the card is deleted: an open record of an intake provider. */
export function staysAsCandidate(source: WorkItemSourceDbRecord): boolean {
  const adapter = WORK_ITEM_PROVIDER_ADAPTERS.find(adapter => adapter.provider === source.provider);
  return adapter?.closed !== undefined && !adapter.closed(source);
}

function providerCreatedAt(metadata: Record<string, unknown> | null): Date | null {
  const value = metadata?.sourceCreatedAt ?? metadata?.createdAt;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Every candidate is written with the provider's creation time, or the time it was first stored. */
export function candidateCreatedAt(source: WorkItemSourceDbRecord): Date {
  return source.source_created_at ?? source.created_at;
}

/** The columns that turn a deleted card's source back into a candidate. */
export function candidateMarker(source: WorkItemSourceDbRecord): Partial<WorkItemSourceDbRecord> {
  return {
    candidate: true,
    source_created_at: providerCreatedAt(source.metadata) ?? source.created_at,
    updated_at: new Date(),
  };
}

/**
 * Store an open record as a candidate, or refresh the one already stored. A record that has a
 * card is left to the card's own sync. Throws `UniqueViolationError` when another writer stores
 * the same record first; the caller retries in a new transaction.
 */
/** Equal as stored JSON: a backend may hand an object back with its keys in another order. */
function sameJson(left: unknown, right: unknown): boolean {
  const stored = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));
  return isDeepStrictEqual(stored(left), stored(right));
}

/** Whether storing the record again would change nothing, judged from a candidate already read. */
export function candidateIsCurrent(
  stored: {
    title: string;
    source: Pick<WorkItemSourceRow, 'url' | 'key' | 'state' | 'labels' | 'author' | 'metadata'>;
  },
  input: Pick<CandidateInput, 'source' | 'title' | 'metadata'>,
): boolean {
  const facts = workItemProviderAdapter(input.source).toSource(input.source, input.metadata);
  if (!facts || stored.title !== input.title) return false;
  return (['url', 'key', 'state', 'labels', 'author', 'metadata'] as const).every(column =>
    sameJson(stored.source[column], facts[column]),
  );
}

export async function storeCandidate(ops: FactoryStorageOps, input: CandidateInput): Promise<CandidateWrite> {
  const facts = workItemProviderAdapter(input.source).toSource(input.source, input.metadata);
  if (!facts) throw new Error('An intake candidate needs an external source.');
  const scope = { org_id: input.orgId, factory_project_id: input.factoryProjectId };
  const where = { ...scope, provider: facts.provider, external_id: facts.externalId };
  const now = new Date();
  const { expected } = input;
  const existing = await ops.findOne<WorkItemSourceDbRecord>(SOURCES, where);
  if (!existing) {
    if (expected) return 'stale';
    const id = randomUUID();
    await ops.insertOne<WorkItemDbRecord>(WORK_ITEMS, {
      ...scope,
      id,
      title: input.title,
      description: input.description ?? null,
      parent_work_item_id: null,
      revision: 1,
      created_at: now,
      updated_at: now,
    });
    await ops.insertOne<WorkItemSourceDbRecord>(SOURCES, {
      ...where,
      id,
      work_item_id: id,
      integration_id: facts.integrationId,
      source_type: facts.sourceType,
      workspace_id: facts.workspaceId,
      source_key: facts.sourceKey,
      url: facts.url,
      key: facts.key,
      state: facts.state,
      labels: facts.labels,
      author: facts.author,
      metadata: facts.metadata,
      role: 'origin',
      candidate: true,
      source_created_at: input.createdAt ?? now,
      revision: 1,
      synced_at: now,
      created_at: now,
      updated_at: now,
    });
    return 'created';
  }
  if (existing.candidate !== true) return 'carded';
  if (expected !== undefined && existing.id !== expected?.id) return 'stale';

  const next = {
    url: facts.url,
    key: facts.key,
    state: facts.state,
    labels: facts.labels,
    author: facts.author,
    metadata: facts.metadata,
  };
  let changed = false;
  let stale = false;
  let renamed: Pick<WorkItemDbRecord, 'title' | 'description'> | undefined;
  // The marker is part of the filter: a candidate filed since the read above is a card now.
  const source = await ops.updateAtomic<WorkItemSourceDbRecord>(
    SOURCES,
    { id: existing.id, candidate: true },
    async current => {
      if (expected && current.revision !== expected.revision) {
        stale = true;
        return null;
      }
      // Read under the source's lock, which every candidate write takes before the work item.
      const work = await ops.findOne<WorkItemDbRecord>(WORK_ITEMS, { id: current.work_item_id });
      if (!work) throw new Error(`Candidate source ${current.id} has no work item ${current.work_item_id}.`);
      const description = input.description === undefined ? work.description : input.description;
      if (work.title !== input.title || (work.description ?? null) !== (description ?? null))
        renamed = { title: input.title, description };
      const same = (Object.keys(next) as (keyof typeof next)[]).every(column =>
        sameJson(current[column], next[column]),
      );
      if (same && !renamed) return null;
      changed = true;
      // A new title moves the source too: its write is the one that tells open boards to reread.
      return { ...next, revision: current.revision + 1, synced_at: now, updated_at: now };
    },
  );
  if (stale) return 'stale';
  if (!source) return (await ops.findOne(SOURCES, where)) ? 'carded' : expected ? 'stale' : 'unchanged';
  if (renamed) {
    const { title, description } = renamed;
    await ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: source.work_item_id }, current => ({
      title,
      description,
      revision: current.revision + 1,
      updated_at: now,
    }));
  }
  return changed ? 'updated' : 'unchanged';
}

/**
 * Drop a record from the candidates, e.g. once the provider closed it. A record with a card is
 * untouched, and so is a candidate that is no longer the `expected` one the caller read.
 */
export function removeCandidate(
  ops: FactoryStorageOps,
  scope: { orgId: string; factoryProjectId: string },
  source: ExternalWorkItemSource,
  expected?: CandidateVersion,
): Promise<boolean> {
  return removeCandidateOf(ops, sourceWhere(scope, source), expected);
}

/** The candidate stored for a record, or `null` when it has none: no row, or a card. */
export async function findCandidate(
  ops: FactoryStorageOps,
  scope: { orgId: string; factoryProjectId: string },
  source: ExternalWorkItemSource,
): Promise<CandidateRows | null> {
  const stored = await ops.findOne<WorkItemSourceDbRecord>(SOURCES, { ...sourceWhere(scope, source), candidate: true });
  const work = stored && (await ops.findOne<WorkItemDbRecord>(WORK_ITEMS, { id: stored.work_item_id }));
  // A candidate removed between the two reads has no work item left.
  return work ? { source: stored, work } : null;
}

/** {@link removeCandidate} for a record named by its source columns. */
export async function removeCandidateOf(
  ops: FactoryStorageOps,
  source: Pick<WorkItemSourceDbRecord, 'org_id' | 'factory_project_id' | 'provider' | 'external_id'>,
  expected?: CandidateVersion,
): Promise<boolean> {
  const where = {
    org_id: source.org_id,
    factory_project_id: source.factory_project_id,
    provider: source.provider,
    external_id: source.external_id,
    candidate: true,
  };
  const existing = await ops.findOne<WorkItemSourceDbRecord>(SOURCES, where);
  if (!existing || (expected && existing.id !== expected.id)) return false;
  // The marker is part of the delete: a candidate filed since the read keeps both of its rows.
  // So is the expected revision: one written since the caller's read stays.
  const removed = await ops.deleteMany(SOURCES, {
    ...where,
    id: existing.id,
    ...(expected ? { revision: expected.revision } : {}),
  });
  if (removed === 0) return false;
  await ops.deleteMany(WORK_ITEMS, { id: existing.work_item_id });
  return true;
}

/**
 * Hand a candidate's rows to the card being filed for the same record, so the card keeps the
 * candidate's work item. Returns `null` when the record is no candidate (any more).
 */
export async function adoptCandidate(
  ops: FactoryStorageOps,
  source: WorkItemSourceDbRecord,
  work: Pick<WorkItemDbRecord, 'title' | 'description' | 'updated_at'>,
): Promise<CandidateRows | null> {
  const adopted = await ops.updateAtomic<WorkItemSourceDbRecord>(
    SOURCES,
    {
      org_id: source.org_id,
      factory_project_id: source.factory_project_id,
      provider: source.provider,
      external_id: source.external_id,
      candidate: true,
    },
    current => ({
      integration_id: source.integration_id,
      source_type: source.source_type,
      workspace_id: source.workspace_id,
      source_key: source.source_key,
      // The card may be filed with fewer facts than the last sync stored.
      url: source.url ?? current.url,
      key: source.key ?? current.key,
      state: source.state ?? current.state,
      labels: source.metadata && 'labels' in source.metadata ? source.labels : current.labels,
      author: source.author ?? current.author,
      metadata: current.metadata || source.metadata ? { ...current.metadata, ...source.metadata } : null,
      role: 'origin',
      candidate: null,
      revision: current.revision + 1,
      updated_at: work.updated_at,
    }),
  );
  if (!adopted) return null;
  const adoptedWork = await ops.updateAtomic<WorkItemDbRecord>(WORK_ITEMS, { id: adopted.work_item_id }, current => ({
    title: work.title,
    description: work.description ?? current.description,
    revision: current.revision + 1,
    updated_at: work.updated_at,
  }));
  if (!adoptedWork) throw new Error(`Candidate source ${adopted.id} has no work item ${adopted.work_item_id}.`);
  return { source: adopted, work: adoptedWork };
}

/** One page of a project's candidates, newest record first. Reads `limit + 1` sources and the page's work items. */
export async function listCandidates(
  ops: FactoryStorageOps,
  { orgId, factoryProjectId, sourceType, integrationId, after, limit }: CandidateListInput,
): Promise<{ candidates: CandidateRows[]; next: { createdAt: Date; id: string } | null }> {
  const where: CollectionWhere = { org_id: orgId, factory_project_id: factoryProjectId, candidate: true };
  if (sourceType !== undefined) where.source_type = sourceType;
  if (integrationId !== undefined) where.integration_id = integrationId;
  const sources = await ops.findMany<WorkItemSourceDbRecord>(SOURCES, where, {
    orderBy: [
      ['source_created_at', 'desc'],
      ['id', 'desc'],
    ],
    limit: limit + 1,
    ...(after ? { cursor: { values: [after.createdAt, after.id] } } : {}),
  });
  const page = sources.slice(0, limit);
  const works = new Map<string, WorkItemDbRecord>();
  if (page.length > 0) {
    const rows = await ops.findMany<WorkItemDbRecord>(WORK_ITEMS, {
      id: { in: page.map(source => source.work_item_id) },
    });
    for (const work of rows) works.set(work.id, work);
  }
  return {
    // A candidate removed between the two reads has no work item left.
    candidates: page.flatMap(source => {
      const work = works.get(source.work_item_id);
      return work ? [{ source, work }] : [];
    }),
    next: sources.length > limit ? { createdAt: candidateCreatedAt(page.at(-1)!), id: page.at(-1)!.id } : null,
  };
}

function scopeOf(row: unknown): BoardScope | undefined {
  if (typeof row !== 'object' || row === null) return undefined;
  const { org_id: orgId, factory_project_id: factoryProjectId } = row as Record<string, unknown>;
  return typeof orgId === 'string' && typeof factoryProjectId === 'string' ? { orgId, factoryProjectId } : undefined;
}

const isCandidate = (row: unknown): boolean =>
  typeof row === 'object' && row !== null && (row as { candidate?: unknown }).candidate === true;

/**
 * Wrap `ops` so every write that adds, changes or removes a candidate reports its project once
 * the write has resolved. A write to a card's own source reports nothing.
 */
export function trackCandidateWrites(ops: FactoryStorageOps, changed: (scope: BoardScope) => void): FactoryStorageOps {
  const report = (scope: BoardScope | undefined) => {
    if (scope) changed(scope);
  };
  return new Proxy(ops, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      switch (property) {
        case 'updateAtomic':
          return async (collection: string, where: unknown, updater: (row: unknown) => unknown, ...args: unknown[]) => {
            if (collection !== SOURCES) return value.call(target, collection, where, updater, ...args);
            let was = false;
            let patched = false;
            const row = await value.call(
              target,
              collection,
              where,
              async (current: unknown) => {
                was = isCandidate(current);
                const patch = await updater(current);
                patched = patch != null;
                return patch;
              },
              ...args,
            );
            if (patched && (was || isCandidate(row))) report(scopeOf(row));
            return row;
          };
        case 'insertOne':
        case 'upsertOne':
          return async (collection: string, ...args: unknown[]) => {
            const row = await value.call(target, collection, ...args);
            if (collection === SOURCES && isCandidate(row)) report(scopeOf(row));
            return row;
          };
        case 'deleteMany':
          return async (collection: string, where: CollectionWhere, ...args: unknown[]) => {
            const count: number = await value.call(target, collection, where, ...args);
            if (collection === SOURCES && count > 0 && where.candidate === true) report(scopeOf(where));
            return count;
          };
        default:
          return value.bind(target);
      }
    },
  });
}
