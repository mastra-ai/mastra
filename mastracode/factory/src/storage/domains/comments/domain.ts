/**
 * Comments domain — feed orchestration behind service methods; the HTTP layer
 * lives in `routes.ts` and only maps their result statuses. Service methods
 * take the author as a `FactoryActorRef` (never derived from the request
 * inside), so agent-authored comments later become a thin tool over
 * `createComment` instead of a re-implementation.
 */

import type { PubSub } from '@mastra/core/events';
import type { ApiRoute } from '@mastra/core/server';

import { touchFeed } from '../../../feed-events.js';
import type { RouteAuth } from '../../../routes/route.js';
import type { AuditEmitter } from '../audit/domain.js';
import type { ChannelIdentityStorage } from '../channel-identity/base.js';
import type { FactoryProjectsStorage } from '../projects/base.js';
import type { ExternalWorkItemSource, WorkItemRow, WorkItemsStorage } from '../work-items/base.js';
import { factoryMentionAttentionIdentity } from '../work-items/base.js';
import type { FactoryActorRef } from './actor.js';
import { isMentionableActorId } from './actor.js';
import type {
  EditWorkItemCommentResult,
  FactoryMentionRef,
  WorkItemCommentReplyRef,
  WorkItemCommentRow,
  WorkItemCommentsStorage,
} from './base.js';
import { CommentTokenConflictError, commentBodyError, MAX_COMMENT_MENTIONS, MAX_COMMENT_QUOTE_LENGTH } from './base.js';
import type { WorkItemFeedPublisher } from './feed-sync.js';
import { buildCommentRoutes } from './routes.js';

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
  /** Carries feed touches to every replica's open SSE streams. */
  pubsub: PubSub;
}

export interface CreateCommentServiceInput {
  orgId: string;
  workItemId: string;
  author: FactoryActorRef;
  body: string;
  replyTo?: { commentId: string; quote?: string };
  mentions?: FactoryMentionRef[];
  clientToken?: string;
  /** Set when the comment is a platform message being ingested, never by the web UI. */
  externalSource?: ExternalWorkItemSource;
  /** The platform's own timestamp; defaults to now for locally authored comments. */
  occurredAt?: Date;
}

export type CreateCommentServiceResult =
  /** `mirrored` settles when the platforms have been posted to; nothing in the response waits on it. */
  | { status: 'created'; comment: WorkItemCommentRow; workItem: WorkItemRow; mirrored: Promise<void> }
  | { status: 'work_item_not_found' }
  | { status: 'token_conflict' }
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
  expectedRevision?: number;
}

export type EditCommentServiceResult =
  | ({ status: 'edited'; previousBody: string } & EditWorkItemCommentResult)
  | { status: 'not_found' }
  | { status: 'forbidden' }
  | { status: 'not_editable' }
  | { status: 'conflict' }
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

const MAX_ROSTER_SIZE = 100;
const ROSTER_CACHE_TTL_MS = 60_000;

export class CommentsDomain {
  readonly #auth: RouteAuth;
  readonly #comments: WorkItemCommentsStorage;
  readonly #workItems: WorkItemsStorage;
  readonly #projects: FactoryProjectsStorage;
  readonly #channelIdentity: ChannelIdentityStorage | undefined;
  readonly #members: OrganizationMembersProvider | undefined;
  readonly #audit: AuditEmitter | undefined;
  readonly #publishers: WorkItemFeedPublisher[];
  readonly #pubsub: PubSub;
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
    pubsub,
  }: CommentsDomainOptions) {
    this.#auth = auth;
    this.#comments = comments;
    this.#workItems = workItems;
    this.#projects = projects;
    this.#channelIdentity = channelIdentity;
    this.#members = members;
    this.#audit = audit;
    this.#publishers = publishers ?? [];
    this.#pubsub = pubsub;
  }

  /** The one seam every feed mutation routes through, platform ingest included. */
  async #touchFeed(scope: { orgId: string; factoryProjectId: string; workItemId: string }): Promise<void> {
    await this.#comments.refreshWorkItemFeedActivity(scope);
    touchFeed(this.#pubsub, scope, scope.workItemId);
  }

  async createComment(input: CreateCommentServiceInput): Promise<CreateCommentServiceResult> {
    await this.#comments.ensureReady();
    await this.#workItems.ensureReady();

    const bodyError = commentBodyError(input.body);
    if (bodyError) return { status: 'invalid', message: bodyError };
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

    let comment: WorkItemCommentRow;
    try {
      comment = await this.#comments.create({
        orgId: input.orgId,
        factoryProjectId: workItem.factoryProjectId,
        workItemId: input.workItemId,
        author: input.author,
        body: input.body,
        ...(replyTo ? { replyTo } : {}),
        ...(input.mentions ? { mentions: input.mentions } : {}),
        ...(input.clientToken ? { clientToken: input.clientToken } : {}),
        ...(input.externalSource ? { externalSource: input.externalSource } : {}),
        ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      });
    } catch (error) {
      if (error instanceof CommentTokenConflictError) return { status: 'token_conflict' };
      throw error;
    }
    await this.#touchFeed({
      orgId: input.orgId,
      factoryProjectId: workItem.factoryProjectId,
      workItemId: input.workItemId,
    });
    return { status: 'created', comment, workItem, mirrored: this.#mirrorComment(comment, workItem) };
  }

  /**
   * Runs past the response — the comment is stored, the feed frame is already
   * out, and nobody is waiting on Slack. A failed publish never fails the
   * create. The write-back is the replay guard: a replayed create sees its own
   * platform on the row and skips it. Known ceiling, single publisher only:
   * `external_source` is single-valued, so with two publishers a replayed
   * create re-publishes to the one that is not recorded, and a process that
   * restarts mid-flight drops the post. Both need an outbox.
   */
  async #mirrorComment(comment: WorkItemCommentRow, workItem: WorkItemRow): Promise<void> {
    let current = comment;
    for (const publisher of this.#publishers) {
      if (current.externalSource?.integrationId === publisher.id) continue;
      try {
        const published = await publisher.publish(current, workItem);
        if (!published) continue;
        current =
          (await this.#comments.attachExternalSource({
            orgId: current.orgId,
            commentId: current.id,
            source: published.source,
          })) ?? current;
      } catch (err) {
        console.warn('[Comments] Failed to mirror a comment to a platform', {
          publisherId: publisher.id,
          commentId: current.id,
          orgId: current.orgId,
          workItemId: workItem.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  async editComment(input: EditCommentServiceInput): Promise<EditCommentServiceResult> {
    await this.#comments.ensureReady();
    await this.#workItems.ensureReady();

    const bodyError = commentBodyError(input.body);
    if (bodyError) return { status: 'invalid', message: bodyError };
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
      editorId: input.editor.userId,
      ...(input.mentions ? { mentions: input.mentions } : {}),
      ...(input.expectedRevision !== undefined ? { expectedRevision: input.expectedRevision } : {}),
    });
    if (edited === 'conflict') return { status: 'conflict' };
    if (!edited) return { status: 'not_editable' };

    await this.#cleanupMentionReceipts(existing, edited.removedMentions);
    await this.#touchFeed({
      orgId: existing.orgId,
      factoryProjectId: existing.factoryProjectId,
      workItemId: existing.workItemId,
    });
    return { status: 'edited', previousBody: existing.body, ...edited };
  }

  async deleteComment(input: DeleteCommentServiceInput): Promise<DeleteCommentServiceResult> {
    await this.#comments.ensureReady();
    await this.#workItems.ensureReady();

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
    await this.#touchFeed({
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

  /**
   * Mentionable people: the host's org roster when it answers, otherwise the
   * people the project has actually seen (comment authors, linked channel
   * accounts). Cached per project so a dropdown session costs one read.
   */
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

    const members = await this.#organizationRoster(orgId);
    if (members.size === 0) await this.#seenRoster(orgId, factoryProjectId, members);

    const roster = [...members.values()].slice(0, MAX_ROSTER_SIZE);
    // Sweep on write: a long-lived server would otherwise hold one roster per
    // project it ever served.
    const cutoff = Date.now() - ROSTER_CACHE_TTL_MS;
    for (const [key, entry] of this.#rosterCache) {
      if (entry.at < cutoff) this.#rosterCache.delete(key);
    }
    this.#rosterCache.set(cacheKey, { at: Date.now(), members: roster });
    return roster;
  }

  /** Empty when no provider is wired, or when the host listing fails. */
  async #organizationRoster(orgId: string): Promise<Map<string, FactoryRosterMember>> {
    const members = new Map<string, FactoryRosterMember>();
    if (!this.#members) return members;
    try {
      for (const member of await this.#members.listOrganizationMembers(orgId)) {
        if (isMentionableActorId(member.id)) members.set(member.id, member);
      }
    } catch (err) {
      console.warn('[Comments] Failed to list organization members for the mention roster', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return members;
  }

  async #seenRoster(orgId: string, factoryProjectId: string, members: Map<string, FactoryRosterMember>): Promise<void> {
    for (const author of await this.#comments.listRecentAuthors({ orgId, factoryProjectId })) {
      if (author.kind !== 'user' || !isMentionableActorId(author.id)) continue;
      members.set(author.id, {
        id: author.id,
        ...(author.displayName ? { name: author.displayName } : {}),
        ...(author.avatarUrl ? { avatarUrl: author.avatarUrl } : {}),
      });
    }
    if (!this.#channelIdentity) return;
    await this.#channelIdentity.ensureReady();
    for (const link of await this.#channelIdentity.listAccountLinksForOrg(orgId)) {
      if (members.has(link.userId)) continue;
      members.set(link.userId, {
        id: link.userId,
        ...(link.externalUserName ? { name: link.externalUserName } : {}),
      });
    }
  }

  routes(): ApiRoute[] {
    return buildCommentRoutes({
      domain: this,
      auth: this.#auth,
      comments: this.#comments,
      workItems: this.#workItems,
      projects: this.#projects,
      pubsub: this.#pubsub,
      ...(this.#audit ? { audit: this.#audit } : {}),
    });
  }
}

export { toWireComment } from './wire.js';
export type { WireComment, WireCommentPage } from './wire.js';
