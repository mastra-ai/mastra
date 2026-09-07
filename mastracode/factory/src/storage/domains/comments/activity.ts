/**
 * Lower attention tier: one collapsed row per (work item, participant), bumped
 * per comment to stale-date read receipts. Participants derive per write —
 * recent authors + creator, minus the comment's mentions; nothing subscribes.
 */

import type { FactoryStorageOps } from '@mastra/core/storage';
import { UniqueViolationError } from '@mastra/core/storage';

import { isMentionableActorId } from './actor.js';
import type { FactoryMentionRef, WorkItemCommentRow } from './base.js';

/** The actor rule-materialized work items are created by; a phantom, never a participant. */
const RULE_DISPATCHER_ACTOR_ID = 'factory-rule-dispatcher';

/** Ceiling: an author silent for this many comments stops receiving; a real participants table is the upgrade. */
export const PARTICIPANT_SCAN_LIMIT = 200;

export interface WorkItemActivityRow {
  id: string;
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  participantId: string;
  occurrence: number;
  latestCommentId: string;
  latestAuthorId: string;
  latestAuthorName: string | null;
  occurredAt: Date;
}

interface WorkItemActivityDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  participant_id: string;
  occurrence: number;
  latest_comment_id: string;
  latest_author_id: string;
  latest_author_name: string | null;
  occurred_at: Date;
  created_at: Date;
  updated_at: Date;
}

function toWorkItemActivity(row: WorkItemActivityDbRow): WorkItemActivityRow {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    workItemId: row.work_item_id,
    participantId: row.participant_id,
    occurrence: Number(row.occurrence),
    latestCommentId: row.latest_comment_id,
    latestAuthorId: row.latest_author_id,
    latestAuthorName: row.latest_author_name,
    occurredAt: row.occurred_at,
  };
}

/**
 * Everyone who should hear about `comment`: the item's recent human comment
 * authors plus its creator, minus the author themselves and anyone the comment
 * already mentions.
 */
function activityParticipants({
  recentAuthors,
  createdBy,
  comment,
  mentions,
}: {
  recentAuthors: string[];
  createdBy: string;
  comment: WorkItemCommentRow;
  mentions: FactoryMentionRef[];
}): string[] {
  const excluded = new Set([comment.author.id, ...mentions.map(mention => mention.id)]);
  const candidates = [...recentAuthors, createdBy].filter(
    id => id !== RULE_DISPATCHER_ACTOR_ID && isMentionableActorId(id) && !excluded.has(id),
  );
  return [...new Set(candidates)];
}

/**
 * Bumps one participant's row, or opens it at occurrence 1. The pointer only
 * ever moves forward, so a backdated ingest can't bury a row someone read.
 *
 * `UniqueViolationError` stays contained here: `create()`'s recover path tests
 * only `instanceof` and would misread an escaped one as a source-key replay.
 */
async function bumpParticipant(
  ops: FactoryStorageOps,
  comment: WorkItemCommentRow,
  participantId: string,
  now: Date,
): Promise<void> {
  const where = {
    work_item_id: comment.workItemId,
    participant_id: participantId,
    org_id: comment.orgId,
    factory_project_id: comment.factoryProjectId,
  };
  const pointer = {
    latest_comment_id: comment.id,
    latest_author_id: comment.author.id,
    latest_author_name: comment.author.displayName ?? null,
    occurred_at: comment.occurredAt,
  };
  // Mutator reads only `current`: a query inside `updateAtomic` checks out a
  // second pool connection while the first is held open.
  const bump = () =>
    ops.updateAtomic<WorkItemActivityDbRow>('work_item_activity', where, current => ({
      occurrence: Number(current.occurrence) + 1,
      ...(current.occurred_at.getTime() <= comment.occurredAt.getTime() ? pointer : {}),
      updated_at: now,
    }));

  if (await bump()) return;
  try {
    await ops.insertOne<WorkItemActivityDbRow>('work_item_activity', {
      ...where,
      ...pointer,
      occurrence: 1,
      created_at: now,
      updated_at: now,
    });
  } catch (error) {
    if (!(error instanceof UniqueViolationError)) throw error;
    // Someone opened the row between the miss and the insert. A second miss
    // means a concurrent item delete purged it — nothing left to bump.
    await bump();
  }
}

export async function fanOutWorkItemActivity(
  ops: FactoryStorageOps,
  {
    comment,
    recentAuthors,
    createdBy,
    mentions,
    now = new Date(),
  }: {
    comment: WorkItemCommentRow;
    recentAuthors: string[];
    createdBy: string;
    mentions: FactoryMentionRef[];
    now?: Date;
  },
): Promise<void> {
  for (const participantId of activityParticipants({ recentAuthors, createdBy, comment, mentions })) {
    await bumpParticipant(ops, comment, participantId, now);
  }
}

/** One bounded keyset page of a participant's activity rows, newest-first. */
export async function listActivityForUser(
  ops: FactoryStorageOps,
  {
    orgId,
    factoryProjectId,
    userId,
    before,
    limit,
  }: {
    orgId: string;
    factoryProjectId: string;
    userId: string;
    before?: { occurredAt: Date; id: string };
    limit: number;
  },
): Promise<WorkItemActivityRow[]> {
  const rows = await ops.findMany<WorkItemActivityDbRow>(
    'work_item_activity',
    { org_id: orgId, factory_project_id: factoryProjectId, participant_id: userId },
    {
      orderBy: [
        ['occurred_at', 'desc'],
        ['id', 'desc'],
      ],
      limit,
      ...(before ? { cursor: { values: [before.occurredAt, before.id] } } : {}),
    },
  );
  return rows.map(toWorkItemActivity);
}
