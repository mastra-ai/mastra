/**
 * Comments domain — feed orchestration behind service methods, HTTP behind
 * `routes()`. Service methods take the author as a `FactoryActorRef` (never
 * derived from the request inside), so agent-authored comments later become a
 * thin tool over `createComment` instead of a re-implementation.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { Context } from 'hono';

import type { RouteAuth } from '../../../routes/route.js';
import type { AuditEmitter } from '../audit/domain.js';
import type { ChannelIdentityStorage } from '../channel-identity/base.js';
import type { FactoryProjectsStorage } from '../projects/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../work-items/base.js';
import { factoryMentionAttentionIdentity } from '../work-items/base.js';
import type { FactoryActorRef } from './actor.js';
import { actorFromAuthUser, isMentionableActorId } from './actor.js';
import type {
  EditWorkItemCommentResult,
  FactoryMentionRef,
  WorkItemCommentReplyRef,
  WorkItemCommentRow,
  WorkItemCommentsStorage,
} from './base.js';
import { MAX_COMMENT_BODY_LENGTH, MAX_COMMENT_MENTIONS, MAX_COMMENT_QUOTE_LENGTH } from './base.js';
import type { WorkItemFeedPublisher } from './feed-sync.js';

export interface FactoryRosterMember {
  id: string;
  name?: string;
  avatarUrl?: string;
}

export interface OrganizationMembersProvider {
  listOrganizationMembers(orgId: string): Promise<FactoryRosterMember[]>;
}

export interface CommentsDomainOptions {
  auth: RouteAuth;
  comments: WorkItemCommentsStorage;
  workItems: WorkItemsStorage;
  projects: FactoryProjectsStorage;
  channelIdentity?: ChannelIdentityStorage;
  /** Host-wired org membership listing for the mention roster (e.g. WorkOS). */
  members?: OrganizationMembersProvider;
  audit?: AuditEmitter;
  /** Outbound platform mirrors (COR-1174); empty until a platform wires one. */
  publishers?: WorkItemFeedPublisher[];
}

export interface CreateCommentServiceInput {
  orgId: string;
  workItemId: string;
  author: FactoryActorRef;
  body: string;
  replyTo?: { commentId: string; quote?: string };
  mentions?: FactoryMentionRef[];
  clientToken?: string;
}

export type CreateCommentServiceResult =
  | { status: 'created'; comment: WorkItemCommentRow; workItem: WorkItemRow }
  | { status: 'work_item_not_found' }
  | { status: 'invalid'; message: string };

export interface CommentEditor {
  userId: string;
  /** Lazily checked, only when the caller is not the author. */
  canModerate: () => Promise<boolean>;
}

export interface EditCommentServiceInput {
  orgId: string;
  workItemId: string;
  commentId: string;
  editor: CommentEditor;
  body: string;
  mentions?: FactoryMentionRef[];
}

export type EditCommentServiceResult =
  | ({ status: 'edited'; previousBody: string } & EditWorkItemCommentResult)
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'not_editable' }
  | { status: 'invalid'; message: string };

export interface DeleteCommentServiceInput {
  orgId: string;
  workItemId: string;
  commentId: string;
  editor: CommentEditor;
}

export type DeleteCommentServiceResult =
  | { status: 'deleted'; comment: WorkItemCommentRow }
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'not_editable' };

export interface WireComment {
  id: string;
  workItemId: string;
  kind: string;
  body: string;
  bodyFormat: string;
  author: FactoryActorRef;
  replyTo?: WorkItemCommentReplyRef;
  mentions: FactoryMentionRef[];
  origin?: { integrationId: string; type: string; url?: string };
  occurredAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

export function toWireComment(comment: WorkItemCommentRow): WireComment {
  return {
    id: comment.id,
    workItemId: comment.workItemId,
    kind: comment.kind,
    body: comment.body,
    bodyFormat: comment.bodyFormat,
    author: comment.author,
    ...(comment.replyTo ? { replyTo: comment.replyTo } : {}),
    mentions: comment.mentions,
    ...(comment.externalSource
      ? {
          origin: {
            integrationId: comment.externalSource.integrationId,
            type: comment.externalSource.type,
            ...(comment.externalSource.url ? { url: comment.externalSource.url } : {}),
          },
        }
      : {}),
    occurredAt: comment.occurredAt,
    editedAt: comment.editedAt,
    deletedAt: comment.deletedAt,
  };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLIENT_TOKEN_RE = /^[A-Za-z0-9-]{8,64}$/;
const MAX_ROSTER_SIZE = 100;
const ROSTER_CACHE_TTL_MS = 60_000;
const MAX_AUDIT_BODY_SNAPSHOT = 1024;

function loose(c: unknown): Context {
  return c as Context;
}

function readFactoryAuthUserFromContext(
  context: Context,
): { name?: string; email?: string; avatarUrl?: string } | undefined {
  const user = context.get('factoryAuthUser') as { name?: string; email?: string; avatarUrl?: string } | undefined;
  return user ?? undefined;
}

async function readJson(c: Context): Promise<unknown | undefined> {
  try {
    return await c.req.json();
  } catch {
    return undefined;
  }
}

function parseMentions(raw: unknown): FactoryMentionRef[] | null | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw) || raw.length > MAX_COMMENT_MENTIONS) return null;
  const mentions: FactoryMentionRef[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const mention = entry as Record<string, unknown>;
    if (mention.kind !== 'user' || typeof mention.id !== 'string' || !isMentionableActorId(mention.id)) return null;
    mentions.push({ kind: 'user', id: mention.id });
  }
  return mentions;
}

function parseCommentBodyField(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > MAX_COMMENT_BODY_LENGTH) return null;
  return raw;
}

interface ParsedCreateComment {
  body: string;
  clientToken?: string;
  replyTo?: { commentId: string; quote?: string };
  mentions?: FactoryMentionRef[];
}

function parseCreateCommentBody(raw: unknown): ParsedCreateComment | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const body = parseCommentBodyField(input.body);
  if (body === null) return null;

  const mentions = parseMentions(input.mentions);
  if (mentions === null) return null;

  let clientToken: string | undefined;
  if (input.clientToken !== undefined) {
    if (typeof input.clientToken !== 'string' || !CLIENT_TOKEN_RE.test(input.clientToken)) return null;
    clientToken = input.clientToken;
  }

  let replyTo: ParsedCreateComment['replyTo'];
  if (input.replyTo !== undefined) {
    if (!input.replyTo || typeof input.replyTo !== 'object') return null;
    const reply = input.replyTo as Record<string, unknown>;
    if (typeof reply.commentId !== 'string' || !UUID_RE.test(reply.commentId)) return null;
    if (reply.quote !== undefined && typeof reply.quote !== 'string') return null;
    const quote = typeof reply.quote === 'string' ? reply.quote.slice(0, MAX_COMMENT_QUOTE_LENGTH) : undefined;
    replyTo = { commentId: reply.commentId, ...(quote ? { quote } : {}) };
  }

  return {
    body,
    ...(clientToken ? { clientToken } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(mentions ? { mentions } : {}),
  };
}

interface ParsedEditComment {
  body: string;
  mentions?: FactoryMentionRef[];
}

function parseEditCommentBody(raw: unknown): ParsedEditComment | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const body = parseCommentBodyField(input.body);
  if (body === null) return null;
  const mentions = parseMentions(input.mentions);
  if (mentions === null) return null;
  return { body, ...(mentions ? { mentions } : {}) };
}

export class CommentsDomain {
  readonly #auth: RouteAuth;
  readonly #comments: WorkItemCommentsStorage;
  readonly #workItems: WorkItemsStorage;
  readonly #projects: FactoryProjectsStorage;
  readonly #channelIdentity: ChannelIdentityStorage | undefined;
  readonly #members: OrganizationMembersProvider | undefined;
  readonly #audit: AuditEmitter | undefined;
  readonly #publishers: WorkItemFeedPublisher[];
  readonly #rosterCache = new Map<string, { at: number; members: FactoryRosterMember[] }>();

  constructor({
    auth,
    comments,
    workItems,
    projects,
    channelIdentity,
    members,
    audit,
    publishers,
  }: CommentsDomainOptions) {
    this.#auth = auth;
    this.#comments = comments;
    this.#workItems = workItems;
    this.#projects = projects;
    this.#channelIdentity = channelIdentity;
    this.#members = members;
    this.#audit = audit;
    this.#publishers = publishers ?? [];
  }

  async createComment(input: CreateCommentServiceInput): Promise<CreateCommentServiceResult> {
    await this.#comments.ensureReady();
    await this.#workItems.ensureReady();

    if (!input.body.trim() || input.body.length > MAX_COMMENT_BODY_LENGTH) {
      return { status: 'invalid', message: 'Comment body must be non-empty and at most 16k characters.' };
    }
    if ((input.mentions?.length ?? 0) > MAX_COMMENT_MENTIONS) {
      return { status: 'invalid', message: `At most ${MAX_COMMENT_MENTIONS} mentions per comment.` };
    }

    const workItem = await this.#workItems.get({ orgId: input.orgId, id: input.workItemId });
    if (!workItem) return { status: 'work_item_not_found' };

    let replyTo: WorkItemCommentReplyRef | undefined;
    if (input.replyTo) {
      const parent = await this.#comments.get({ orgId: input.orgId, commentId: input.replyTo.commentId });
      if (!parent || parent.workItemId !== input.workItemId) {
        return { status: 'invalid', message: 'Reply target is not a comment on this work item.' };
      }
      replyTo = {
        commentId: parent.id,
        ...(input.replyTo.quote ? { quote: input.replyTo.quote.slice(0, MAX_COMMENT_QUOTE_LENGTH) } : {}),
        authorId: parent.author.id,
        ...(parent.author.displayName ? { authorName: parent.author.displayName } : {}),
      };
    }

    const comment = await this.#comments.create({
      orgId: input.orgId,
      factoryProjectId: workItem.factoryProjectId,
      workItemId: input.workItemId,
      author: input.author,
      body: input.body,
      ...(replyTo ? { replyTo } : {}),
      ...(input.mentions ? { mentions: input.mentions } : {}),
      ...(input.clientToken ? { clientToken: input.clientToken } : {}),
    });
    await this.#comments.bumpWorkItemFeedActivity({
      orgId: input.orgId,
      factoryProjectId: workItem.factoryProjectId,
      workItemId: input.workItemId,
    });
    await this.#mirrorComment(comment, workItem);
    return { status: 'created', comment, workItem };
  }

  /**
   * Best-effort: a failed publish never fails the create. The write-back is
   * the replay guard — a replayed create sees its own platform on the row and
   * skips it (single-publisher only: `external_source` is single-valued).
   */
  async #mirrorComment(comment: WorkItemCommentRow, workItem: WorkItemRow): Promise<void> {
    let current = comment;
    for (const publisher of this.#publishers) {
      if (current.externalSource?.integrationId === publisher.id) continue;
      try {
        const { source } = await publisher.publish(current, workItem);
        current =
          (await this.#comments.attachExternalSource({ orgId: current.orgId, commentId: current.id, source })) ??
          current;
      } catch {
        // Swallowed by design: the next publish pass (COR-1174) retries.
      }
    }
  }

  async editComment(input: EditCommentServiceInput): Promise<EditCommentServiceResult> {
    await this.#comments.ensureReady();

    if (!input.body.trim() || input.body.length > MAX_COMMENT_BODY_LENGTH) {
      return { status: 'invalid', message: 'Comment body must be non-empty and at most 16k characters.' };
    }
    if ((input.mentions?.length ?? 0) > MAX_COMMENT_MENTIONS) {
      return { status: 'invalid', message: `At most ${MAX_COMMENT_MENTIONS} mentions per comment.` };
    }

    const existing = await this.#comments.get({ orgId: input.orgId, commentId: input.commentId });
    if (!existing || existing.workItemId !== input.workItemId) return { status: 'not_found' };
    if (existing.deletedAt) return { status: 'not_editable' };
    if (existing.author.id !== input.editor.userId && !(await input.editor.canModerate())) {
      return { status: 'forbidden' };
    }

    const edited = await this.#comments.edit({
      orgId: input.orgId,
      commentId: input.commentId,
      body: input.body,
      ...(input.mentions ? { mentions: input.mentions } : {}),
    });
    if (!edited) return { status: 'not_editable' };

    await this.#cleanupMentionReceipts(existing, edited.removedMentions);
    await this.#comments.bumpWorkItemFeedActivity({
      orgId: existing.orgId,
      factoryProjectId: existing.factoryProjectId,
      workItemId: existing.workItemId,
    });
    return { status: 'edited', previousBody: existing.body, ...edited };
  }

  async deleteComment(input: DeleteCommentServiceInput): Promise<DeleteCommentServiceResult> {
    await this.#comments.ensureReady();

    const existing = await this.#comments.get({ orgId: input.orgId, commentId: input.commentId });
    if (!existing || existing.workItemId !== input.workItemId) return { status: 'not_found' };
    if (existing.deletedAt) return { status: 'not_editable' };
    if (existing.author.id !== input.editor.userId && !(await input.editor.canModerate())) {
      return { status: 'forbidden' };
    }

    const deleted = await this.#comments.softDelete({
      orgId: input.orgId,
      commentId: input.commentId,
      deletedBy: input.editor.userId,
    });
    if (!deleted) return { status: 'not_editable' };

    await this.#workItems.deleteAttentionReceipts({
      orgId: existing.orgId,
      factoryProjectId: existing.factoryProjectId,
      identities: [factoryMentionAttentionIdentity(existing.id)],
    });
    await this.#comments.bumpWorkItemFeedActivity({
      orgId: existing.orgId,
      factoryProjectId: existing.factoryProjectId,
      workItemId: existing.workItemId,
    });
    return { status: 'deleted', comment: deleted };
  }

  /**
   * A removed mention deletes only that user's receipt: the receipt identity
   * is per-comment, and other still-mentioned users must keep their read state.
   */
  async #cleanupMentionReceipts(comment: WorkItemCommentRow, removed: FactoryMentionRef[]): Promise<void> {
    for (const mention of removed) {
      await this.#workItems.deleteAttentionReceipts({
        orgId: comment.orgId,
        factoryProjectId: comment.factoryProjectId,
        userId: mention.id,
        identities: [factoryMentionAttentionIdentity(comment.id)],
      });
    }
  }

  async mentionRoster({
    orgId,
    factoryProjectId,
  }: {
    orgId: string;
    factoryProjectId: string;
  }): Promise<FactoryRosterMember[]> {
    const cacheKey = `${orgId}\0${factoryProjectId}`;
    const cached = this.#rosterCache.get(cacheKey);
    if (cached && Date.now() - cached.at < ROSTER_CACHE_TTL_MS) return cached.members;

    const members = new Map<string, FactoryRosterMember>();
    if (this.#members) {
      try {
        for (const member of await this.#members.listOrganizationMembers(orgId)) {
          if (!isMentionableActorId(member.id)) continue;
          members.set(member.id, member);
        }
      } catch (err) {
        console.warn('[Comments] Failed to list organization members for the mention roster', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    if (members.size === 0) {
      for (const author of await this.#comments.listRecentAuthors({ orgId, factoryProjectId })) {
        if (author.kind !== 'user' || !isMentionableActorId(author.id)) continue;
        members.set(author.id, {
          id: author.id,
          ...(author.displayName ? { name: author.displayName } : {}),
          ...(author.avatarUrl ? { avatarUrl: author.avatarUrl } : {}),
        });
      }
      if (this.#channelIdentity) {
        await this.#channelIdentity.ensureReady();
        for (const link of await this.#channelIdentity.listAccountLinksForOrg(orgId)) {
          if (members.has(link.userId)) continue;
          members.set(link.userId, {
            id: link.userId,
            ...(link.externalUserName ? { name: link.externalUserName } : {}),
          });
        }
      }
    }

    const roster = [...members.values()].slice(0, MAX_ROSTER_SIZE);
    this.#rosterCache.set(cacheKey, { at: Date.now(), members: roster });
    return roster;
  }

  routes(): ApiRoute[] {
    return [
      registerApiRoute('/web/factory/work-items/:workItemId/comments', {
        method: 'GET',
        handler: async cc => {
          const c = loose(cc);
          const tenant = await this.#resolveTenant(c);
          if ('response' in tenant) return tenant.response;

          const workItemId = c.req.param('workItemId');
          if (!workItemId || !UUID_RE.test(workItemId)) return c.json({ error: 'Work item not found' }, 404);
          await this.#workItems.ensureReady();
          const workItem = await this.#workItems.get({ orgId: tenant.orgId, id: workItemId });
          if (!workItem) return c.json({ error: 'Work item not found' }, 404);

          await this.#comments.ensureReady();
          const limitRaw = c.req.query('limit');
          const limit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
          const page = await this.#comments.list({
            orgId: tenant.orgId,
            factoryProjectId: workItem.factoryProjectId,
            workItemId,
            before: c.req.query('before') || undefined,
            ...(limit !== undefined && Number.isFinite(limit) ? { limit } : {}),
          });
          return c.json({
            comments: page.comments.map(toWireComment),
            ...(page.nextCursor ? { nextCursor: page.nextCursor } : {}),
          });
        },
      }),

      registerApiRoute('/web/factory/work-items/:workItemId/comments', {
        method: 'POST',
        handler: async cc => {
          const c = loose(cc);
          const tenant = await this.#resolveTenant(c);
          if ('response' in tenant) return tenant.response;

          const workItemId = c.req.param('workItemId');
          if (!workItemId || !UUID_RE.test(workItemId)) return c.json({ error: 'Work item not found' }, 404);

          const parsed = parseCreateCommentBody(await readJson(c));
          if (!parsed) return c.json({ error: 'invalid_comment' }, 422);

          const author = actorFromAuthUser(tenant.userId, readFactoryAuthUserFromContext(c));
          const result = await this.createComment({
            orgId: tenant.orgId,
            workItemId,
            author,
            body: parsed.body,
            ...(parsed.replyTo ? { replyTo: parsed.replyTo } : {}),
            ...(parsed.mentions ? { mentions: parsed.mentions } : {}),
            ...(parsed.clientToken ? { clientToken: parsed.clientToken } : {}),
          });
          if (result.status === 'work_item_not_found') return c.json({ error: 'Work item not found' }, 404);
          if (result.status === 'invalid') return c.json({ error: 'invalid_comment', message: result.message }, 422);

          await this.#audit?.emit({
            context: c,
            input: {
              action: 'factory.work_item.comment_created',
              factoryProjectId: result.workItem.factoryProjectId,
              targets: [{ type: 'work_item', id: result.workItem.id, name: result.workItem.title }],
              metadata: { commentId: result.comment.id },
            },
          });
          const mentionedIds = result.comment.mentions
            .map(mention => mention.id)
            .filter(id => id !== result.comment.author.id);
          if (mentionedIds.length > 0) {
            await this.#audit?.emit({
              context: c,
              input: {
                action: 'factory.work_item.comment_mentioned',
                factoryProjectId: result.workItem.factoryProjectId,
                targets: [{ type: 'work_item', id: result.workItem.id, name: result.workItem.title }],
                metadata: { commentId: result.comment.id, mentionedIds },
              },
            });
          }
          return c.json({ comment: toWireComment(result.comment) }, 201);
        },
      }),

      registerApiRoute('/web/factory/work-items/:workItemId/comments/:commentId', {
        method: 'PATCH',
        handler: async cc => {
          const c = loose(cc);
          const tenant = await this.#resolveTenant(c);
          if ('response' in tenant) return tenant.response;

          const workItemId = c.req.param('workItemId');
          const commentId = c.req.param('commentId');
          if (!workItemId || !UUID_RE.test(workItemId) || !commentId || !UUID_RE.test(commentId)) {
            return c.json({ error: 'Comment not found' }, 404);
          }

          const parsed = parseEditCommentBody(await readJson(c));
          if (!parsed) return c.json({ error: 'invalid_comment' }, 422);

          const result = await this.editComment({
            orgId: tenant.orgId,
            workItemId,
            commentId,
            editor: this.#editorFor(c, tenant),
            body: parsed.body,
            ...(parsed.mentions ? { mentions: parsed.mentions } : {}),
          });
          if (result.status === 'not_found') return c.json({ error: 'Comment not found' }, 404);
          if (result.status === 'forbidden') return c.json({ error: 'not_comment_author' }, 403);
          if (result.status === 'not_editable') return c.json({ error: 'comment_not_editable' }, 409);
          if (result.status === 'invalid') return c.json({ error: 'invalid_comment', message: result.message }, 422);

          await this.#audit?.emit({
            context: c,
            input: {
              action: 'factory.work_item.comment_edited',
              factoryProjectId: result.comment.factoryProjectId,
              targets: [{ type: 'work_item', id: result.comment.workItemId }],
              metadata: {
                commentId: result.comment.id,
                previousBody: result.previousBody.slice(0, MAX_AUDIT_BODY_SNAPSHOT),
              },
            },
          });
          if (result.addedMentions.length > 0) {
            await this.#audit?.emit({
              context: c,
              input: {
                action: 'factory.work_item.comment_mentioned',
                factoryProjectId: result.comment.factoryProjectId,
                targets: [{ type: 'work_item', id: result.comment.workItemId }],
                metadata: { commentId: result.comment.id, mentionedIds: result.addedMentions.map(m => m.id) },
              },
            });
          }
          return c.json({ comment: toWireComment(result.comment) });
        },
      }),

      registerApiRoute('/web/factory/work-items/:workItemId/comments/:commentId', {
        method: 'DELETE',
        handler: async cc => {
          const c = loose(cc);
          const tenant = await this.#resolveTenant(c);
          if ('response' in tenant) return tenant.response;

          const workItemId = c.req.param('workItemId');
          const commentId = c.req.param('commentId');
          if (!workItemId || !UUID_RE.test(workItemId) || !commentId || !UUID_RE.test(commentId)) {
            return c.json({ error: 'Comment not found' }, 404);
          }

          const result = await this.deleteComment({
            orgId: tenant.orgId,
            workItemId,
            commentId,
            editor: this.#editorFor(c, tenant),
          });
          if (result.status === 'not_found') return c.json({ error: 'Comment not found' }, 404);
          if (result.status === 'forbidden') return c.json({ error: 'not_comment_author' }, 403);
          if (result.status === 'not_editable') return c.json({ error: 'comment_not_editable' }, 409);

          await this.#audit?.emit({
            context: c,
            input: {
              action: 'factory.work_item.comment_deleted',
              factoryProjectId: result.comment.factoryProjectId,
              targets: [{ type: 'work_item', id: result.comment.workItemId }],
              metadata: { commentId: result.comment.id },
            },
          });
          return c.json({ comment: toWireComment(result.comment) });
        },
      }),

      registerApiRoute('/web/factory/projects/:id/mention-roster', {
        method: 'GET',
        handler: async cc => {
          const c = loose(cc);
          const tenant = await this.#resolveTenant(c);
          if ('response' in tenant) return tenant.response;

          const projectId = c.req.param('id');
          if (!projectId || !UUID_RE.test(projectId)) return c.json({ error: 'Project not found' }, 404);
          await this.#projects.ensureReady();
          const project = await this.#projects.get({ orgId: tenant.orgId, id: projectId });
          if (!project) return c.json({ error: 'Project not found' }, 404);

          await this.#comments.ensureReady();
          const roster = await this.mentionRoster({ orgId: tenant.orgId, factoryProjectId: projectId });
          const query = c.req.query('q')?.trim().toLowerCase();
          const members = query
            ? roster.filter(member => (member.name ?? member.id).toLowerCase().startsWith(query))
            : roster;
          return c.json({ members });
        },
      }),
    ];
  }

  #editorFor(c: Context, tenant: { orgId: string; userId: string }): CommentEditor {
    return {
      userId: tenant.userId,
      canModerate: () => this.#auth.isOrganizationAdmin(c, tenant.orgId),
    };
  }

  async #resolveTenant(c: Context): Promise<{ orgId: string; userId: string } | { response: Response }> {
    await this.#auth.ensureUser(c);
    const tenant = this.#auth.tenant(c);
    if (!tenant) return { response: c.json({ error: 'unauthorized' }, 401) };
    if (!tenant.orgId) {
      return {
        response: c.json({ error: 'organization_required', message: 'The item feed requires an organization.' }, 403),
      };
    }
    return { orgId: tenant.orgId, userId: tenant.userId };
  }
}
