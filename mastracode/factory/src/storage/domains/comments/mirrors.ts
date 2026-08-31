/**
 * Delivery record for a comment mirrored to a chat platform: one row per
 * (comment, publisher), written before the platform is ever called.
 *
 * The row is what makes a mirror survive anything — a crash between the comment
 * and the post, a rate limit the process does not outlive, a platform down for
 * an hour. It is also what lets the feed say "not delivered" instead of quietly
 * showing a comment the Slack thread never received.
 *
 * There is no worker lease. A delivery is claimed by pushing its own
 * `next_attempt_at` forward inside `updateAtomic`, so replicas draining the
 * same queue take disjoint rows, and a process that dies mid-post leaves a row
 * that simply comes due again.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionSchema, FactoryStorageOps } from '@mastra/core/storage';

/**
 * `pending` is owed, `delivered` landed, `failed` has spent every attempt.
 * `declined` is the silent end: nothing to post to, because the publisher does
 * not own this item or the comment is gone.
 */
export type CommentMirrorStatus = 'pending' | 'delivered' | 'declined' | 'failed';

export interface CommentMirrorRow {
  id: string;
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  commentId: string;
  publisherId: string;
  status: CommentMirrorStatus;
  attempts: number;
  nextAttemptAt: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_MIRROR_ATTEMPTS = 6;

/** 30s doubling to ~16min: an outage is ridden out, a dead platform gives up within the hour. */
export function mirrorBackoffMs(attempts: number): number {
  return 30_000 * 2 ** Math.min(attempts, MAX_MIRROR_ATTEMPTS);
}

export const COMMENT_MIRRORS_SCHEMA: CollectionSchema = {
  name: 'work_item_comment_mirrors',
  columns: {
    id: { type: 'uuid-pk' },
    org_id: { type: 'text' },
    factory_project_id: { type: 'text' },
    work_item_id: { type: 'text' },
    comment_id: { type: 'text' },
    publisher_id: { type: 'text' },
    status: { type: 'text' },
    attempts: { type: 'integer', default: 0 },
    next_attempt_at: { type: 'timestamp' },
    last_error: { type: 'text', nullable: true },
    created_at: { type: 'timestamp' },
    updated_at: { type: 'timestamp' },
  },
  uniqueIndexes: [
    {
      // Enqueueing is the idempotency guard: a replayed create cannot owe the
      // same comment to the same platform twice.
      name: 'work_item_comment_mirrors_comment_publisher_unique',
      columns: ['comment_id', 'publisher_id'],
    },
  ],
  indexes: [
    { name: 'work_item_comment_mirrors_due_idx', columns: ['status', 'next_attempt_at'] },
    { name: 'work_item_comment_mirrors_comment_idx', columns: ['org_id', 'comment_id'] },
  ],
};

interface CommentMirrorDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  comment_id: string;
  publisher_id: string;
  status: CommentMirrorStatus;
  attempts: number;
  next_attempt_at: Date;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
}

function toRow(row: CommentMirrorDbRow): CommentMirrorRow {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    workItemId: row.work_item_id,
    commentId: row.comment_id,
    publisherId: row.publisher_id,
    status: row.status,
    attempts: row.attempts,
    nextAttemptAt: row.next_attempt_at,
    ...(row.last_error ? { lastError: row.last_error } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface EnqueueCommentMirrorInput {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  commentId: string;
  publisherId: string;
}

export class CommentMirrorsStorage extends FactoryStorageDomain {
  constructor() {
    super('comment-mirrors');
  }

  async init(): Promise<void> {
    await this.ensureCollections([COMMENT_MIRRORS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('work_item_comment_mirrors', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
  }

  /**
   * Owe this comment to this publisher. Null when it is already owed — a
   * redelivered platform message or a client retry, neither of which may post
   * a second time.
   */
  async enqueue(input: EnqueueCommentMirrorInput, now = new Date()): Promise<CommentMirrorRow | null> {
    try {
      const row = await this.#db.insertOne<CommentMirrorDbRow>('work_item_comment_mirrors', {
        org_id: input.orgId,
        factory_project_id: input.factoryProjectId,
        work_item_id: input.workItemId,
        comment_id: input.commentId,
        publisher_id: input.publisherId,
        status: 'pending',
        attempts: 0,
        next_attempt_at: now,
        created_at: now,
        updated_at: now,
      });
      return toRow(row);
    } catch (error) {
      if (error instanceof UniqueViolationError) return null;
      throw error;
    }
  }

  /**
   * Take the delivery for one attempt, or null when another replica already
   * holds it. The claim schedules the retry up front, so a process that dies
   * mid-post needs no reaper — the row just comes due again.
   */
  async claim(id: string, now = new Date()): Promise<CommentMirrorRow | null> {
    let claimed = false;
    const row = await this.#db.updateAtomic<CommentMirrorDbRow>('work_item_comment_mirrors', { id }, current => {
      if (current.status !== 'pending' || current.next_attempt_at > now) return null;
      claimed = true;
      const attempts = current.attempts + 1;
      return {
        attempts,
        next_attempt_at: new Date(now.getTime() + mirrorBackoffMs(attempts)),
        updated_at: now,
      };
    });
    return row && claimed ? toRow(row) : null;
  }

  /** The attempt landed: `delivered` when the platform took it, `declined` when the publisher passed. */
  async settle(id: string, published: boolean, now = new Date()): Promise<void> {
    await this.#db.updateMany(
      'work_item_comment_mirrors',
      { id },
      { status: published ? 'delivered' : 'declined', last_error: null, updated_at: now },
    );
  }

  /** The attempt threw. The retry is already scheduled by {@link claim}; this only records why. */
  async recordFailure(id: string, error: unknown, now = new Date()): Promise<void> {
    await this.#db.updateAtomic<CommentMirrorDbRow>('work_item_comment_mirrors', { id }, current => ({
      status: current.attempts >= MAX_MIRROR_ATTEMPTS ? 'failed' : 'pending',
      last_error: error instanceof Error ? error.message : String(error),
      updated_at: now,
    }));
  }

  /**
   * Deliveries due for an attempt. `CollectionWhere` carries equality only, so
   * the time cut is made here — ascending order means the first row past `now`
   * ends the page.
   */
  async listDue(limit: number, now = new Date()): Promise<CommentMirrorRow[]> {
    const rows = await this.#db.findMany<CommentMirrorDbRow>(
      'work_item_comment_mirrors',
      { status: 'pending' },
      { orderBy: [['next_attempt_at', 'asc']], limit },
    );
    const due: CommentMirrorRow[] = [];
    for (const row of rows) {
      if (row.next_attempt_at > now) break;
      due.push(toRow(row));
    }
    return due;
  }

  /** Delivery state for a page of comments, keyed by comment id. */
  async listForComments(orgId: string, commentIds: string[]): Promise<Map<string, CommentMirrorRow[]>> {
    if (commentIds.length === 0) return new Map();
    const rows = await this.#db.findMany<CommentMirrorDbRow>('work_item_comment_mirrors', {
      org_id: orgId,
      comment_id: { in: commentIds },
    });
    const byComment = new Map<string, CommentMirrorRow[]>();
    for (const row of rows) {
      const list = byComment.get(row.comment_id) ?? [];
      list.push(toRow(row));
      byComment.set(row.comment_id, list);
    }
    return byComment;
  }
}
