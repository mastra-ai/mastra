import { UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * External records a card is linked to: its own source, and every pull request opened for it.
 * One card per external record in a project.
 */
export const WORK_ITEM_SOURCES_SCHEMA: CollectionSchema = {
  name: 'work_item_sources',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    source_key: { type: 'text' },
    kind: { type: 'text' },
    integration: { type: 'text' },
    external: { type: 'json' },
    state: { type: 'text' },
    head_sha: { type: 'text', nullable: true },
    reviewed_head_sha: { type: 'text', nullable: true },
    review_verdict: { type: 'text', nullable: true },
    reviewed_at: { type: 'timestamp', nullable: true },
    factory_authored: { type: 'boolean', default: false },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    { name: 'work_item_sources_project_source_key_unique', columns: ['factory_project_id', 'source_key'] },
  ],
  indexes: [
    { name: 'work_item_sources_item_idx', columns: ['org_id', 'factory_project_id', 'work_item_id'] },
    { name: 'work_item_sources_source_key_idx', columns: ['source_key'] },
  ],
};

export type WorkItemSourceKind = 'issue' | 'pull_request';
export type WorkItemSourceState = 'open' | 'closed' | 'merged';

export interface WorkItemSourceLink {
  workItemId: string;
  sourceKey: string;
  kind: WorkItemSourceKind;
  integration: string;
  /** Integration-specific identity, e.g. `{ repositoryId, number }`. */
  external: Record<string, unknown>;
  state: WorkItemSourceState;
  headSha: string | null;
  reviewedHeadSha: string | null;
  reviewVerdict: string | null;
  reviewedAt: Date | null;
  factoryAuthored: boolean;
}

type WorkItemSourceRow = {
  id: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  source_key: string;
  kind: string;
  integration: string;
  external: Record<string, unknown> | null;
  state: string;
  head_sha: string | null;
  reviewed_head_sha: string | null;
  review_verdict: string | null;
  reviewed_at: Date | string | null;
  factory_authored: boolean | number | null;
  created_at: Date;
  updated_at: Date;
};

export interface SourceScope {
  orgId: string;
  factoryProjectId: string;
}

export interface LinkSourceInput extends SourceScope {
  workItemId: string;
  sourceKey: string;
  kind: WorkItemSourceKind;
  integration: string;
  external?: Record<string, unknown>;
  state?: WorkItemSourceState;
  headSha?: string | null;
  factoryAuthored?: boolean;
  /**
   * Move the link to this card when another card holds it. Without it the existing holder keeps
   * the link: a card's own source never takes a record away from the card that authored it.
   */
  reassign?: boolean;
}

function toLink(row: WorkItemSourceRow): WorkItemSourceLink {
  return {
    workItemId: row.work_item_id,
    sourceKey: row.source_key,
    kind: row.kind as WorkItemSourceKind,
    integration: row.integration,
    external: row.external ?? {},
    state: row.state as WorkItemSourceState,
    headSha: row.head_sha,
    reviewedHeadSha: row.reviewed_head_sha,
    reviewVerdict: row.review_verdict,
    reviewedAt: row.reviewed_at === null ? null : new Date(row.reviewed_at),
    factoryAuthored: row.factory_authored === true || row.factory_authored === 1,
  };
}

const keyWhere = ({ orgId, factoryProjectId }: SourceScope, sourceKey: string) => ({
  org_id: orgId,
  factory_project_id: factoryProjectId,
  source_key: sourceKey,
});

/** Links `input.sourceKey` to the card; returns the link as stored (possibly held by another card). */
export async function linkSource(ops: FactoryStorageOps, input: LinkSourceInput): Promise<WorkItemSourceLink> {
  const where = keyWhere(input, input.sourceKey);
  const now = new Date();
  for (let attempt = 0; attempt < 2; attempt++) {
    const existing = await ops.findOne<WorkItemSourceRow>(WORK_ITEM_SOURCES_SCHEMA.name, where);
    if (existing) {
      if (existing.work_item_id === input.workItemId || !input.reassign) {
        if (existing.work_item_id !== input.workItemId) return toLink(existing);
        const patch = {
          ...(input.state ? { state: input.state } : {}),
          ...(input.headSha !== undefined ? { head_sha: input.headSha } : {}),
          ...(input.factoryAuthored ? { factory_authored: true } : {}),
        };
        if (Object.keys(patch).length === 0) return toLink(existing);
        const updated = await ops.updateAtomic<WorkItemSourceRow>(WORK_ITEM_SOURCES_SCHEMA.name, where, () => ({
          ...patch,
          updated_at: now,
        }));
        return toLink(updated ?? existing);
      }
      const moved = await ops.updateAtomic<WorkItemSourceRow>(WORK_ITEM_SOURCES_SCHEMA.name, where, () => ({
        work_item_id: input.workItemId,
        ...(input.state ? { state: input.state } : {}),
        ...(input.headSha !== undefined ? { head_sha: input.headSha } : {}),
        factory_authored: input.factoryAuthored ?? false,
        updated_at: now,
      }));
      if (moved) return toLink(moved);
      continue;
    }
    try {
      return toLink(
        await ops.insertOne<WorkItemSourceRow>(WORK_ITEM_SOURCES_SCHEMA.name, {
          org_id: input.orgId,
          factory_project_id: input.factoryProjectId,
          work_item_id: input.workItemId,
          source_key: input.sourceKey,
          kind: input.kind,
          integration: input.integration,
          external: input.external ?? {},
          state: input.state ?? 'open',
          head_sha: input.headSha ?? null,
          reviewed_head_sha: null,
          review_verdict: null,
          reviewed_at: null,
          factory_authored: input.factoryAuthored ?? false,
          created_at: now,
          updated_at: now,
        }),
      );
    } catch (error) {
      // Another writer linked the record first; resolve against its row.
      if (!(error instanceof UniqueViolationError)) throw error;
    }
  }
  const settled = await ops.findOne<WorkItemSourceRow>(WORK_ITEM_SOURCES_SCHEMA.name, where);
  if (!settled) throw new Error(`Could not link ${input.sourceKey}.`);
  return toLink(settled);
}

export async function listSources(
  ops: FactoryStorageOps,
  { orgId, factoryProjectId, workItemId }: SourceScope & { workItemId: string },
): Promise<WorkItemSourceLink[]> {
  const rows = await ops.findMany<WorkItemSourceRow>(
    WORK_ITEM_SOURCES_SCHEMA.name,
    { org_id: orgId, factory_project_id: factoryProjectId, work_item_id: workItemId },
    { orderBy: [['created_at', 'asc']] },
  );
  return rows.map(toLink);
}

export async function findBySourceKey(
  ops: FactoryStorageOps,
  scope: SourceScope & { sourceKey: string },
): Promise<WorkItemSourceLink | null> {
  const row = await ops.findOne<WorkItemSourceRow>(WORK_ITEM_SOURCES_SCHEMA.name, keyWhere(scope, scope.sourceKey));
  return row ? toLink(row) : null;
}

export async function updateSourceState(
  ops: FactoryStorageOps,
  scope: SourceScope & { sourceKey: string; state: WorkItemSourceState; headSha?: string | null },
): Promise<WorkItemSourceLink | null> {
  const row = await ops.updateAtomic<WorkItemSourceRow>(
    WORK_ITEM_SOURCES_SCHEMA.name,
    keyWhere(scope, scope.sourceKey),
    () => ({
      state: scope.state,
      ...(scope.headSha !== undefined ? { head_sha: scope.headSha } : {}),
      updated_at: new Date(),
    }),
  );
  return row ? toLink(row) : null;
}

export async function recordSourceReview(
  ops: FactoryStorageOps,
  scope: SourceScope & { sourceKey: string; verdict: string; reviewedHeadSha: string | null; reviewedAt: Date },
): Promise<WorkItemSourceLink | null> {
  const row = await ops.updateAtomic<WorkItemSourceRow>(
    WORK_ITEM_SOURCES_SCHEMA.name,
    keyWhere(scope, scope.sourceKey),
    () => ({
      review_verdict: scope.verdict,
      reviewed_head_sha: scope.reviewedHeadSha,
      reviewed_at: scope.reviewedAt,
      updated_at: new Date(),
    }),
  );
  return row ? toLink(row) : null;
}
