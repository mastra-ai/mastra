/**
 * Work-item comments domain — the item feed: one message list per work item.
 *
 * Feed rows are a materialized view of every source. Local creates and later
 * platform mirrors (Slack, Linear, GitHub) converge on one idempotency story:
 * `external_source` json + derived `source_key` under a partial unique index.
 * A local retry (`clientToken`) is just a source like any other
 * (`local:comment:<uuid>`).
 *
 * Ordering is `occurred_at` (caller-settable, audit semantics), never insert
 * time: platform ingest backdates to the platform timestamp, and retries
 * arrive out of order. Deletes are soft — the tombstone keeps feed ordering
 * stable and its kept `source_key` stops a platform redelivery from
 * resurrecting the row.
 */

import { FactoryStorageDomain, UniqueViolationError } from '@mastra/core/storage';
import type { CollectionWhere, FactoryStorageOps } from '@mastra/core/storage';

import type { ExternalWorkItemSource } from '../work-items/base.js';
import type { FactoryActorExternalIdentity, FactoryActorRef } from './actor.js';
import { WORK_ITEM_COMMENT_MENTIONS_SCHEMA, WORK_ITEM_COMMENTS_SCHEMA } from './schema.js';

export { WORK_ITEM_COMMENT_MENTIONS_SCHEMA, WORK_ITEM_COMMENTS_SCHEMA } from './schema.js';

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
  if (input.externalSource) {
    const source = input.externalSource;
    return `${source.integrationId}:${source.type}:${source.externalId}`;
  }
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

function dedupeMentions(mentions: FactoryMentionRef[] | undefined): FactoryMentionRef[] {
  if (!mentions?.length) return [];
  return [...new Map(mentions.map(mention => [`${mention.kind}\0${mention.id}`, mention])).values()];
}

export class WorkItemCommentsStorage extends FactoryStorageDomain {
  constructor() {
    super('work-item-comments');
  }

  async init(): Promise<void> {
    await this.ensureCollections([WORK_ITEM_COMMENTS_SCHEMA, WORK_ITEM_COMMENT_MENTIONS_SCHEMA]);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.ops.deleteMany('work_item_comment_mentions', {});
    await this.ops.deleteMany('work_item_comments', {});
  }

  get #db(): FactoryStorageOps {
    return this.ops;
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
    // Local-token recovery is strict — a token resolving to another item or
    // author is a conflict, not a silent recovery. External keys stay lenient:
    // a platform redelivery after a thread re-link maps to a new item id and
    // must still no-op.
    if (sourceKey) {
      const sourceWhere = { factory_project_id: input.factoryProjectId, source_key: sourceKey };
      const recover = (found: WorkItemCommentDbRow): WorkItemCommentRow => {
        if (!input.externalSource && (found.work_item_id !== input.workItemId || found.author_id !== author.id)) {
          throw new CommentTokenConflictError();
        }
        return toComment(found);
      };
      const existing = await this.#db.findOne<WorkItemCommentDbRow>('work_item_comments', sourceWhere);
      if (existing) return recover(existing);
      try {
        const inserted = await this.#db.insertOne<WorkItemCommentDbRow>('work_item_comments', row);
        const comment = toComment(inserted);
        await this.#writeMentionRows(comment, comment.mentions);
        return comment;
      } catch (error) {
        if (!(error instanceof UniqueViolationError)) throw error;
        const raced = await this.#db.findOne<WorkItemCommentDbRow>('work_item_comments', sourceWhere);
        if (!raced) throw error;
        return recover(raced);
      }
    }

    const inserted = await this.#db.insertOne<WorkItemCommentDbRow>('work_item_comments', row);
    const comment = toComment(inserted);
    await this.#writeMentionRows(comment, comment.mentions);
    return comment;
  }

  /**
   * Idempotent counter refresh on the parent work item: an absolute recount
   * (never an increment — replays and races double an increment; a recount
   * can't drift). Counted BEFORE `updateAtomic`: its mutator runs inside an
   * open transaction holding a pool connection, and a query in there checks
   * out a second one — concurrent posts would exhaust the pool. A count gone
   * stale by write time converges on the next feed mutation. Touches ONLY the
   * counter columns: `revision`/`updated_at` are the stage-transition
   * concurrency token.
   */
  async bumpWorkItemFeedActivity({
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
    await this.#db.updateAtomic<Record<string, unknown>>(
      'work_items',
      { id: workItemId, org_id: orgId, factory_project_id: factoryProjectId },
      () => ({
        comment_count: commentCount,
        feed_activity_at: now,
      }),
    );
  }

  async get({ orgId, commentId }: { orgId: string; commentId: string }): Promise<WorkItemCommentRow | null> {
    const row = await this.#db.findOne<WorkItemCommentDbRow>('work_item_comments', {
      id: commentId,
      org_id: orgId,
    });
    return row ? toComment(row) : null;
  }

  async listByIds({ orgId, ids }: { orgId: string; ids: string[] }): Promise<WorkItemCommentRow[]> {
    if (ids.length === 0) return [];
    const rows = await this.#db.findMany<WorkItemCommentDbRow>('work_item_comments', {
      org_id: orgId,
      id: { in: ids },
    });
    return rows.map(toComment);
  }

  async list(input: ListWorkItemCommentsInput): Promise<WorkItemCommentPage> {
    const limit = clampCommentLimit(input.limit);
    const cursor = input.before ? decodeCommentCursor(input.before) : undefined;
    const rows = await this.#db.findMany<WorkItemCommentDbRow>(
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
    const rows = await this.#db.findMany<WorkItemCommentDbRow>(
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

  async edit(input: EditWorkItemCommentInput): Promise<EditWorkItemCommentResult | null> {
    const now = input.now ?? new Date();
    let blocked = false;
    const updated = await this.#db.updateAtomic<WorkItemCommentDbRow>(
      'work_item_comments',
      { id: input.commentId, org_id: input.orgId },
      current => {
        if (current.deleted_at) {
          blocked = true;
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
    if (!updated || blocked) return null;
    const comment = toComment(updated);

    const existing = await this.#listMentionRows(comment.id);
    const existingKeys = new Set(existing.map(mention => `${mention.mentionedKind}\0${mention.mentionedId}`));
    const nextKeys = new Set(comment.mentions.map(mention => `${mention.kind}\0${mention.id}`));
    // Self-mentions (author, or the acting editor) never become rows, so they
    // must not report as "added" either — they would re-report on every edit.
    const skippedIds = new Set([comment.author.id, ...(input.editorId ? [input.editorId] : [])]);
    const addedMentions = comment.mentions.filter(
      mention => !existingKeys.has(`${mention.kind}\0${mention.id}`) && !skippedIds.has(mention.id),
    );
    const removedMentions = existing
      .filter(mention => !nextKeys.has(`${mention.mentionedKind}\0${mention.mentionedId}`))
      .map(mention => ({ kind: mention.mentionedKind, id: mention.mentionedId }));

    // Stamped with the edit time, not the comment's creation time: the inbox
    // is a keyset on `occurred_at`, and a backdated row lands buried under
    // everything the user already saw.
    await this.#writeMentionRows(comment, addedMentions, now);
    for (const mention of removedMentions) {
      await this.#db.deleteMany('work_item_comment_mentions', {
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
    let blocked = false;
    const updated = await this.#db.updateAtomic<WorkItemCommentDbRow>(
      'work_item_comments',
      { id: commentId, org_id: orgId },
      current => {
        if (current.deleted_at) {
          blocked = true;
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
    if (!updated || blocked) return null;
    await this.#db.deleteMany('work_item_comment_mentions', { comment_id: commentId });
    return toComment(updated);
  }

  /**
   * Provenance write-back after an outbound publish. First platform wins: an
   * existing `external_source` is never overwritten (it may carry the thread
   * ref a publisher needs back). Keeps an existing `source_key`: replacing a
   * `local:comment:<token>` key would let a client retry duplicate the row —
   * which also means a web-born comment is NEVER deduped by key against its
   * own platform echo; the host's bot-sender check is the only echo layer for
   * those rows and must ship with any inbound sync (COR-1174).
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
    const updated = await this.#db.updateAtomic<WorkItemCommentDbRow>(
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
    const rows = await this.#db.findMany<WorkItemMentionDbRow>(
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
    return this.#countRows('work_item_comments', {
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
    const rows = await this.#db.findMany<WorkItemCommentDbRow>(
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

  async #countRows(collection: string, where: CollectionWhere): Promise<number> {
    const count = this.#db.count;
    if (!count) throw new Error('[WorkItemCommentsStorage] storage backend does not support collection counts.');
    return count.call(this.#db, collection, where);
  }

  async #listMentionRows(commentId: string): Promise<WorkItemMentionRow[]> {
    const rows = await this.#db.findMany<WorkItemMentionDbRow>('work_item_comment_mentions', {
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
      await this.#db.upsertOne<WorkItemMentionDbRow>(
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
