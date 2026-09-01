/**
 * Work-item comments domain — one message list per work item, materialized
 * from every source. Local creates and platform mirrors (Slack, Linear,
 * GitHub) share one idempotency story: `external_source` json + derived
 * `source_key` under a partial unique index, a local retry token being just
 * another source (`local:comment:<uuid>`).
 *
 * Ordering is caller-settable `occurred_at`, never insert time — ingest
 * backdates to the platform timestamp and retries arrive out of order.
 * Deletes are soft: the tombstone holds the ordering and its kept
 * `source_key` stops a redelivery from resurrecting the row.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';

import { externalSourceKey } from '../work-items/base.js';
import type { ExternalWorkItemSource } from '../work-items/base.js';
import { fanOutWorkItemActivity, listActivityForUser, PARTICIPANT_SCAN_LIMIT } from './activity.js';
import type { WorkItemActivityRow } from './activity.js';
import type { FactoryActorExternalIdentity, FactoryActorRef } from './actor.js';
import { WORK_ITEM_ACTIVITY_SCHEMA, WORK_ITEM_COMMENT_MENTIONS_SCHEMA, WORK_ITEM_COMMENTS_SCHEMA } from './schema.js';

export type { WorkItemActivityRow } from './activity.js';
export { WORK_ITEM_ACTIVITY_SCHEMA, WORK_ITEM_COMMENT_MENTIONS_SCHEMA, WORK_ITEM_COMMENTS_SCHEMA } from './schema.js';

export type WorkItemCommentKind = 'comment';

export interface FactoryMentionRef {
  kind: 'user';
  id: string;
}

export interface WorkItemCommentReplyRef {
  commentId: string;
  quote?: string;
  authorId?: string;
  authorName?: string;
}

export interface WorkItemCommentRow {
  id: string;
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  kind: WorkItemCommentKind;
  body: string;
  bodyFormat: string;
  author: FactoryActorRef;
  replyTo: WorkItemCommentReplyRef | null;
  mentions: FactoryMentionRef[];
  externalSource: ExternalWorkItemSource | null;
  sourceKey: string | null;
  occurredAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkItemCommentInput {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  author: FactoryActorRef;
  body: string;
  bodyFormat?: string;
  replyTo?: WorkItemCommentReplyRef;
  mentions?: FactoryMentionRef[];
  externalSource?: ExternalWorkItemSource;
  /** Local idempotent-retry token; mutually exclusive with `externalSource`. */
  clientToken?: string;
  occurredAt?: Date;
}

export interface EditWorkItemCommentInput {
  orgId: string;
  commentId: string;
  body: string;
  mentions?: FactoryMentionRef[];
  /** The acting user; their own handle never becomes a mention row. */
  editorId?: string;
  /** When set, the edit only lands if the row is still at this revision. */
  expectedRevision?: number;
  now?: Date;
}

export interface EditWorkItemCommentResult {
  comment: WorkItemCommentRow;
  addedMentions: FactoryMentionRef[];
  removedMentions: FactoryMentionRef[];
}

export interface ListWorkItemCommentsInput {
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  before?: string;
  limit?: number;
  /**
   * Anchor the first page on this comment: it and every comment newer than it,
   * so a deep link opens on the target instead of paging back to find it.
   * Ignored when the comment is gone, or sits further back than one page holds.
   */
  around?: string;
}

/** The only two work-item columns the feed refresh reads or writes. */
interface WorkItemFeedColumns extends Record<string, unknown> {
  comment_count: number;
  feed_activity_at: Date | null;
}

/** A feed snapshot: how many comments the item had, and when it last moved. */
export interface FeedActivitySnapshot {
  commentCount: number;
  feedActivityAt: Date;
}

/**
 * The refresh reads its snapshot outside the write transaction, so two of them
 * can interleave and the loser can write last. This is the one rule that keeps
 * that from undoing a newer refresh: feed activity never moves backwards, and
 * on the same stamp the fuller count wins.
 *
 * Known ceiling: a soft delete sharing a millisecond with a create leaves the
 * count one high until the next feed mutation recounts. Closing that needs the
 * aggregate read inside the write transaction, which the ops layer cannot do
 * without checking out a second pool connection per open transaction.
 */
export function supersedesFeedActivity(next: FeedActivitySnapshot, stored: FeedActivitySnapshot): boolean {
  const drift = next.feedActivityAt.getTime() - stored.feedActivityAt.getTime();
  return drift > 0 || (drift === 0 && next.commentCount >= stored.commentCount);
}

export interface WorkItemCommentPage {
  comments: WorkItemCommentRow[];
  nextCursor?: string;
}

export interface WorkItemMentionRow {
  id: string;
  commentId: string;
  mentionedKind: 'user';
  mentionedId: string;
  authorId: string;
  orgId: string;
  factoryProjectId: string;
  workItemId: string;
  occurredAt: Date;
}

export const MAX_COMMENT_BODY_LENGTH = 16_000;
export const MAX_COMMENT_QUOTE_LENGTH = 500;
export const MAX_COMMENT_MENTIONS = 20;

/** The one body policy: HTTP parsing and the service both reject on it. */
export function commentBodyError(body: string): string | undefined {
  if (!body.trim()) return 'Comment body must not be empty.';
  if (body.length > MAX_COMMENT_BODY_LENGTH)
    return `Comment body must be at most ${MAX_COMMENT_BODY_LENGTH} characters.`;
  return undefined;
}

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

export function clampCommentLimit(limit: number | undefined): number {
  const normalized = typeof limit === 'number' && Number.isFinite(limit) ? Math.trunc(limit) : DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(normalized, 1), MAX_PAGE_SIZE);
}

export function encodeCommentCursor(row: WorkItemCommentRow): string {
  return `${row.occurredAt.toISOString()}_${row.id}`;
}

export function decodeCommentCursor(cursor: string): { occurredAt: Date; id: string } | undefined {
  const sep = cursor.lastIndexOf('_');
  if (sep <= 0) return undefined;
  const occurredAt = new Date(cursor.slice(0, sep));
  const id = cursor.slice(sep + 1);
  if (Number.isNaN(occurredAt.getTime()) || !id) return undefined;
  return { occurredAt, id };
}

export function commentSourceKey(input: {
  externalSource?: ExternalWorkItemSource;
  clientToken?: string;
}): string | null {
  if (input.externalSource) return externalSourceKey(input.externalSource);
  if (input.clientToken) return `local:comment:${input.clientToken}`;
  return null;
}

/** A `clientToken` replay that resolved to a different work item or author. */
export class CommentTokenConflictError extends Error {
  constructor() {
    super('Client token already used by a different comment.');
    this.name = 'CommentTokenConflictError';
  }
}

interface WorkItemCommentDbRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  kind: WorkItemCommentKind;
  body: string;
  body_format: string;
  author_kind: FactoryActorRef['kind'];
  author_id: string;
  author_display_name: string | null;
  author_avatar_url: string | null;
  author_external: FactoryActorExternalIdentity | null;
  reply_to_comment_id: string | null;
  reply_quote: string | null;
  reply_to_author_id: string | null;
  reply_to_author_name: string | null;
  mentions: FactoryMentionRef[];
  external_source: ExternalWorkItemSource | null;
  source_key: string | null;
  occurred_at: Date;
  edited_at: Date | null;
  deleted_at: Date | null;
  deleted_by: string | null;
  revision: number;
  created_at: Date;
  updated_at: Date;
}

interface WorkItemMentionDbRow extends Record<string, unknown> {
  id: string;
  comment_id: string;
  mentioned_kind: 'user';
  mentioned_id: string;
  author_id: string;
  org_id: string;
  factory_project_id: string;
  work_item_id: string;
  occurred_at: Date;
}

function toComment(row: WorkItemCommentDbRow): WorkItemCommentRow {
  return {
    id: row.id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    workItemId: row.work_item_id,
    kind: row.kind,
    body: row.body,
    bodyFormat: row.body_format,
    author: {
      kind: row.author_kind,
      id: row.author_id,
      ...(row.author_display_name ? { displayName: row.author_display_name } : {}),
      ...(row.author_avatar_url ? { avatarUrl: row.author_avatar_url } : {}),
      ...(row.author_external ? { external: row.author_external } : {}),
    },
    replyTo: row.reply_to_comment_id
      ? {
          commentId: row.reply_to_comment_id,
          ...(row.reply_quote ? { quote: row.reply_quote } : {}),
          ...(row.reply_to_author_id ? { authorId: row.reply_to_author_id } : {}),
          ...(row.reply_to_author_name ? { authorName: row.reply_to_author_name } : {}),
        }
      : null,
    mentions: row.mentions,
    externalSource: row.external_source,
    sourceKey: row.source_key,
    occurredAt: row.occurred_at,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMention(row: WorkItemMentionDbRow): WorkItemMentionRow {
  return {
    id: row.id,
    commentId: row.comment_id,
    mentionedKind: row.mentioned_kind,
    mentionedId: row.mentioned_id,
    authorId: row.author_id,
    orgId: row.org_id,
    factoryProjectId: row.factory_project_id,
    workItemId: row.work_item_id,
    occurredAt: row.occurred_at,
  };
}

function toMentionRef(row: WorkItemMentionRow): FactoryMentionRef {
  return { kind: row.mentionedKind, id: row.mentionedId };
}

function mentionKey(mention: { kind: string; id: string }): string {
  return `${mention.kind}\0${mention.id}`;
}

function dedupeMentions(mentions: FactoryMentionRef[] | undefined): FactoryMentionRef[] {
  if (!mentions?.length) return [];
  return [...new Map(mentions.map(mention => [mentionKey(mention), mention])).values()];
}

export class WorkItemCommentsStorage extends FactoryStorageDomain {
  constructor() {
    super('work-item-comments');
  }

  async init(): Promise<void> {
    await this.ensureCollections([
      WORK_ITEM_COMMENTS_SCHEMA,
      WORK_ITEM_COMMENT_MENTIONS_SCHEMA,
      WORK_ITEM_ACTIVITY_SCHEMA,
    ]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('work_item_activity', {});
    await this.ops.deleteMany('work_item_comment_mentions', {});
    await this.ops.deleteMany('work_item_comments', {});
  }

  async create(input: CreateWorkItemCommentInput): Promise<WorkItemCommentRow> {
    const now = new Date();
    const occurredAt = input.occurredAt ?? now;
    const sourceKey = commentSourceKey(input);
    const author = input.author;
    const row: Partial<WorkItemCommentDbRow> = {
      org_id: input.orgId,
      factory_project_id: input.factoryProjectId,
      work_item_id: input.workItemId,
      kind: 'comment',
      body: input.body,
      body_format: input.bodyFormat ?? 'markdown',
      author_kind: author.kind,
      author_id: author.id,
      author_display_name: author.displayName ?? null,
      author_avatar_url: author.avatarUrl ?? null,
      author_external: author.external ?? null,
      reply_to_comment_id: input.replyTo?.commentId ?? null,
      reply_quote: input.replyTo?.quote ?? null,
      reply_to_author_id: input.replyTo?.authorId ?? null,
      reply_to_author_name: input.replyTo?.authorName ?? null,
      mentions: dedupeMentions(input.mentions),
      external_source: input.externalSource ?? null,
      source_key: sourceKey,
      occurred_at: occurredAt,
      edited_at: null,
      deleted_at: null,
      deleted_by: null,
      revision: 1,
      created_at: now,
      updated_at: now,
    };

    // Insert-or-recover, never upsert: a replayed create must return the
    // existing row untouched (an upsert would clobber a later edit's body).
    // A local token resolving to another item or author is a conflict, not a
    // recovery. External keys stay lenient: a redelivery after a thread
    // re-link maps to a new item id and must still no-op.
    if (sourceKey) {
      const sourceWhere = {
        org_id: input.orgId,
        factory_project_id: input.factoryProjectId,
        source_key: sourceKey,
      };
      const recover = (found: WorkItemCommentDbRow): WorkItemCommentRow => {
        if (!input.externalSource && (found.work_item_id !== input.workItemId || found.author_id !== author.id)) {
          throw new CommentTokenConflictError();
        }
        return toComment(found);
      };
      const existing = await this.ops.findOne<WorkItemCommentDbRow>('work_item_comments', sourceWhere);
      if (existing) return recover(existing);
      try {
        return await this.#insertWithMentions(row);
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        const raced = await this.ops.findOne<WorkItemCommentDbRow>('work_item_comments', sourceWhere);
        if (!raced) throw error;
        return recover(raced);
      }
    }

    return this.#insertWithMentions(row);
  }

  /**
   * The one insert path a genuinely new comment takes — `create()`'s recover
   * branches never reach it, so a replay writes no mention or activity rows.
   */
  async #insertWithMentions(row: Partial<WorkItemCommentDbRow>): Promise<WorkItemCommentRow> {
    const comment = toComment(await this.ops.insertOne<WorkItemCommentDbRow>('work_item_comments', row));
    await this.#writeMentionRows(comment, comment.mentions);
    await this.#fanOutActivity(comment);
    return comment;
  }

  /**
   * Participants come off the item's recent authors, so the scan happens here
   * rather than in the fan-out, which must stay free of its own queries.
   */
  async #fanOutActivity(comment: WorkItemCommentRow): Promise<void> {
    const item = await this.ops.findOne<{ created_by: string } & Record<string, unknown>>('work_items', {
      id: comment.workItemId,
      org_id: comment.orgId,
      factory_project_id: comment.factoryProjectId,
    });
    if (!item) return;
    const recent = await this.listRecent({
      orgId: comment.orgId,
      factoryProjectId: comment.factoryProjectId,
      workItemId: comment.workItemId,
      limit: PARTICIPANT_SCAN_LIMIT,
    });
    await fanOutWorkItemActivity(this.ops, {
      comment,
      recentAuthors: recent.filter(row => row.author.kind === 'user').map(row => row.author.id),
      createdBy: item.created_by,
      mentions: comment.mentions,
    });
  }

  async listActivityForUser(args: {
    orgId: string;
    factoryProjectId: string;
    userId: string;
    before?: { occurredAt: Date; id: string };
    limit: number;
  }): Promise<WorkItemActivityRow[]> {
    return listActivityForUser(this.ops, args);
  }

  /**
   * Idempotent counter refresh on the parent work item: both columns are read
   * back off the comments (never incremented or stamped with the wall clock —
   * replays and races double an increment, and a replayed create would move a
   * work item in the feed without adding a comment; a read-back can't drift).
   * Read BEFORE `updateAtomic`: its mutator runs inside an open transaction
   * holding a pool connection, and a query in there checks out a second one —
   * concurrent posts would exhaust the pool. Reading outside means two
   * refreshes can interleave, so the write goes through
   * {@link supersedesFeedActivity} rather than landing whatever it read.
   * Touches ONLY the counter columns: `revision`/`updated_at` are the
   * stage-transition concurrency token.
   */
  async refreshWorkItemFeedActivity({
    orgId,
    factoryProjectId,
    workItemId,
    now = new Date(),
  }: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    now?: Date;
  }): Promise<void> {
    const commentCount = await this.countForWorkItem({ orgId, factoryProjectId, workItemId });
    // Every feed mutation stamps `updated_at`, edits and tombstones included,
    // so the newest one is when this feed last moved.
    const [latest] = await this.ops.findMany<WorkItemCommentDbRow>(
      'work_item_comments',
      { org_id: orgId, factory_project_id: factoryProjectId, work_item_id: workItemId },
      { orderBy: [['updated_at', 'desc']], limit: 1 },
    );
    const feedActivityAt = latest?.updated_at ?? now;
    await this.ops.updateAtomic<WorkItemFeedColumns>(
      'work_items',
      { id: workItemId, org_id: orgId, factory_project_id: factoryProjectId },
      row => {
        const next = { commentCount, feedActivityAt };
        const stored = row.feed_activity_at;
        if (stored && !supersedesFeedActivity(next, { commentCount: row.comment_count, feedActivityAt: stored })) {
          return null;
        }
        return { comment_count: commentCount, feed_activity_at: feedActivityAt };
      },
    );
  }

  async get({ orgId, commentId }: { orgId: string; commentId: string }): Promise<WorkItemCommentRow | null> {
    const row = await this.ops.findOne<WorkItemCommentDbRow>('work_item_comments', {
      id: commentId,
      org_id: orgId,
    });
    return row ? toComment(row) : null;
  }

  async listByIds({ orgId, ids }: { orgId: string; ids: string[] }): Promise<WorkItemCommentRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.ops.findMany<WorkItemCommentDbRow>('work_item_comments', {
      org_id: orgId,
      id: { in: ids },
    });
    return rows.map(toComment);
  }

  async list(input: ListWorkItemCommentsInput): Promise<WorkItemCommentPage> {
    const anchored = input.around ? await this.#listAround(input, input.around) : undefined;
    if (anchored) return anchored;
    const limit = clampCommentLimit(input.limit);
    const cursor = input.before ? decodeCommentCursor(input.before) : undefined;
    const rows = await this.ops.findMany<WorkItemCommentDbRow>(
      'work_item_comments',
      {
        org_id: input.orgId,
        factory_project_id: input.factoryProjectId,
        work_item_id: input.workItemId,
      },
      {
        orderBy: [
          ['occurred_at', 'desc'],
          ['id', 'desc'],
        ],
        limit: limit + 1,
        ...(cursor ? { cursor: { values: [cursor.occurredAt, cursor.id] } } : {}),
      },
    );
    const comments = rows.slice(0, limit).map(toComment);
    const hasMore = rows.length > limit;
    const last = comments[comments.length - 1];
    return {
      comments,
      ...(hasMore && last ? { nextCursor: encodeCommentCursor(last) } : {}),
    };
  }

  async #listAround(
    { orgId, factoryProjectId, workItemId }: ListWorkItemCommentsInput,
    commentId: string,
  ): Promise<WorkItemCommentPage | undefined> {
    const target = await this.get({ orgId, commentId });
    if (!target || target.factoryProjectId !== factoryProjectId || target.workItemId !== workItemId) return undefined;

    const newer = await this.ops.findMany<WorkItemCommentDbRow>(
      'work_item_comments',
      { org_id: orgId, factory_project_id: factoryProjectId, work_item_id: workItemId },
      {
        orderBy: [
          ['occurred_at', 'asc'],
          ['id', 'asc'],
        ],
        limit: MAX_PAGE_SIZE + 1,
        cursor: { values: [target.occurredAt, target.id] },
      },
    );
    if (newer.length > MAX_PAGE_SIZE) return undefined;

    const before = encodeCommentCursor(target);
    const older = await this.list({ orgId, factoryProjectId, workItemId, before, limit: 1 });
    return {
      comments: [...newer.map(toComment).reverse(), target],
      ...(older.comments.length > 0 ? { nextCursor: before } : {}),
    };
  }

  /**
   * Newest non-deleted comments for run-context injection, newest-first (the
   * caller reverses for display order).
   */
  async listRecent({
    orgId,
    factoryProjectId,
    workItemId,
    limit,
  }: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
    limit: number;
  }): Promise<WorkItemCommentRow[]> {
    const rows = await this.ops.findMany<WorkItemCommentDbRow>(
      'work_item_comments',
      {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        work_item_id: workItemId,
        deleted_at: null,
      },
      {
        orderBy: [
          ['occurred_at', 'desc'],
          ['id', 'desc'],
        ],
        limit,
      },
    );
    return rows.map(toComment);
  }

  async edit(input: EditWorkItemCommentInput): Promise<EditWorkItemCommentResult | 'conflict' | null> {
    const now = input.now ?? new Date();
    let rejection: 'deleted' | 'conflict' | undefined;
    const updated = await this.ops.updateAtomic<WorkItemCommentDbRow>(
      'work_item_comments',
      { id: input.commentId, org_id: input.orgId },
      current => {
        if (current.deleted_at) {
          rejection = 'deleted';
          return null;
        }
        if (input.expectedRevision !== undefined && Number(current.revision) !== input.expectedRevision) {
          rejection = 'conflict';
          return null;
        }
        return {
          body: input.body,
          mentions: dedupeMentions(input.mentions ?? current.mentions),
          edited_at: now,
          revision: Number(current.revision) + 1,
          updated_at: now,
        };
      },
    );
    if (rejection === 'conflict') return 'conflict';
    if (!updated || rejection) return null;
    const comment = toComment(updated);

    const existing = await this.#listMentionRows(comment.id);
    const existingKeys = new Set(existing.map(mention => mentionKey(toMentionRef(mention))));
    const nextKeys = new Set(comment.mentions.map(mentionKey));
    // Self-mentions (author, or the acting editor) never become rows, so they
    // must not report as "added" either — they would re-report on every edit.
    const skippedIds = new Set([comment.author.id, ...(input.editorId ? [input.editorId] : [])]);
    const addedMentions = comment.mentions.filter(
      mention => !existingKeys.has(mentionKey(mention)) && !skippedIds.has(mention.id),
    );
    const removedMentions = existing.map(toMentionRef).filter(mention => !nextKeys.has(mentionKey(mention)));

    // Stamped with the edit time, not the comment's creation time: the inbox
    // is a keyset on `occurred_at`, and a backdated row lands buried under
    // everything the user already saw.
    await this.#writeMentionRows(comment, addedMentions, now);
    for (const mention of removedMentions) {
      await this.ops.deleteMany('work_item_comment_mentions', {
        comment_id: comment.id,
        mentioned_kind: mention.kind,
        mentioned_id: mention.id,
      });
    }
    return { comment, addedMentions, removedMentions };
  }

  async softDelete({
    orgId,
    commentId,
    deletedBy,
    now = new Date(),
  }: {
    orgId: string;
    commentId: string;
    deletedBy: string;
    now?: Date;
  }): Promise<WorkItemCommentRow | null> {
    let alreadyDeleted = false;
    const updated = await this.ops.updateAtomic<WorkItemCommentDbRow>(
      'work_item_comments',
      { id: commentId, org_id: orgId },
      current => {
        if (current.deleted_at) {
          alreadyDeleted = true;
          return null;
        }
        return {
          body: '',
          mentions: [],
          deleted_at: now,
          deleted_by: deletedBy,
          updated_at: now,
        };
      },
    );
    if (!updated || alreadyDeleted) return null;
    await this.ops.deleteMany('work_item_comment_mentions', { comment_id: commentId });
    return toComment(updated);
  }

  /**
   * Provenance write-back after an outbound publish. First platform wins, and
   * an existing `source_key` is kept: replacing a `local:comment:<token>` one
   * would let a client retry duplicate the row. So a web-born comment is never
   * key-deduped against its own platform echo — the host's bot-sender check is
   * the only echo layer for those rows (COR-1174).
   */
  async attachExternalSource({
    orgId,
    commentId,
    source,
  }: {
    orgId: string;
    commentId: string;
    source: ExternalWorkItemSource;
  }): Promise<WorkItemCommentRow | null> {
    const updated = await this.ops.updateAtomic<WorkItemCommentDbRow>(
      'work_item_comments',
      { id: commentId, org_id: orgId },
      current => {
        if (current.external_source) return null;
        return {
          external_source: source,
          source_key: current.source_key ?? commentSourceKey({ externalSource: source }),
          updated_at: new Date(),
        };
      },
    );
    return updated ? toComment(updated) : null;
  }

  async listMentionsForComment(commentId: string): Promise<WorkItemMentionRow[]> {
    return this.#listMentionRows(commentId);
  }

  /** Keyset inbox read for the mention attention provider, newest-first. */
  async listMentionsForUser({
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
  }): Promise<WorkItemMentionRow[]> {
    const rows = await this.ops.findMany<WorkItemMentionDbRow>(
      'work_item_comment_mentions',
      {
        org_id: orgId,
        factory_project_id: factoryProjectId,
        mentioned_id: userId,
      },
      {
        orderBy: [
          ['occurred_at', 'desc'],
          ['id', 'desc'],
        ],
        limit,
        ...(before ? { cursor: { values: [before.occurredAt, before.id] } } : {}),
      },
    );
    return rows.map(toMention);
  }

  async countForWorkItem({
    orgId,
    factoryProjectId,
    workItemId,
  }: {
    orgId: string;
    factoryProjectId: string;
    workItemId: string;
  }): Promise<number> {
    if (!this.ops.count) {
      throw new Error('[WorkItemCommentsStorage] storage backend does not support collection counts.');
    }
    return this.ops.count('work_item_comments', {
      org_id: orgId,
      factory_project_id: factoryProjectId,
      work_item_id: workItemId,
      deleted_at: null,
    });
  }

  /** Recent distinct comment authors of a project, for the roster fallback. */
  async listRecentAuthors({
    orgId,
    factoryProjectId,
    limit = 200,
  }: {
    orgId: string;
    factoryProjectId: string;
    limit?: number;
  }): Promise<FactoryActorRef[]> {
    const rows = await this.ops.findMany<WorkItemCommentDbRow>(
      'work_item_comments',
      { org_id: orgId, factory_project_id: factoryProjectId },
      {
        orderBy: [
          ['occurred_at', 'desc'],
          ['id', 'desc'],
        ],
        limit,
      },
    );
    const authors = new Map<string, FactoryActorRef>();
    for (const row of rows) {
      if (authors.has(row.author_id)) continue;
      authors.set(row.author_id, toComment(row).author);
    }
    return [...authors.values()];
  }

  async #listMentionRows(commentId: string): Promise<WorkItemMentionRow[]> {
    const rows = await this.ops.findMany<WorkItemMentionDbRow>('work_item_comment_mentions', {
      comment_id: commentId,
    });
    return rows.map(toMention);
  }

  /**
   * Self-mentions never get rows: the join exists solely for the attention
   * inbox, and `CollectionWhere` cannot express `author_id != userId` at read
   * time, so the filter happens at write time.
   */
  async #writeMentionRows(
    comment: WorkItemCommentRow,
    mentions: FactoryMentionRef[],
    occurredAt = comment.occurredAt,
  ): Promise<void> {
    for (const mention of mentions) {
      if (mention.id === comment.author.id) continue;
      await this.ops.upsertOne<WorkItemMentionDbRow>(
        'work_item_comment_mentions',
        ['comment_id', 'mentioned_kind', 'mentioned_id'],
        {
          comment_id: comment.id,
          mentioned_kind: mention.kind,
          mentioned_id: mention.id,
          author_id: comment.author.id,
          org_id: comment.orgId,
          factory_project_id: comment.factoryProjectId,
          work_item_id: comment.workItemId,
          occurred_at: occurredAt,
        },
      );
    }
  }
}
