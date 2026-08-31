import type { FactoryActorKind, FactoryActorRef } from './actor.js';
import type { FactoryMentionRef, WorkItemCommentReplyRef, WorkItemCommentRow } from './base.js';
import type { CommentMirrorRow } from './mirrors.js';

/**
 * Display-only author. The stored `FactoryActorRef` also carries the platform
 * join keys (team, message, bot flag) that linked a sender to a tenant user;
 * those never reach a thread reader.
 */
export interface WireCommentAuthor {
  kind: FactoryActorKind;
  id: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface WireComment {
  id: string;
  workItemId: string;
  kind: string;
  body: string;
  bodyFormat: string;
  author: WireCommentAuthor;
  replyTo?: WorkItemCommentReplyRef;
  mentions: FactoryMentionRef[];
  /** The viewer's own local sends only, so their client can match pending rows. */
  clientToken?: string;
  origin?: { integrationId: string; type: string; url?: string };
  /**
   * Set only while a platform still owes this comment, or has given up on it.
   * A delivered comment says nothing — silence is the good case.
   */
  delivery?: { platform: string; status: 'pending' | 'failed' };
  revision: number;
  occurredAt: string;
  editedAt?: string;
  deletedAt?: string;
}

export interface WireCommentPage {
  comments: WireComment[];
  nextCursor?: string;
}

const LOCAL_SOURCE_KEY_PREFIX = 'local:comment:';

function toWireAuthor({ kind, id, displayName, avatarUrl }: FactoryActorRef): WireCommentAuthor {
  return {
    kind,
    id,
    ...(displayName ? { displayName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
}

/** The delivery worth telling a reader about: still owed beats already given up on. */
export function pendingDelivery(mirrors: CommentMirrorRow[] | undefined): WireComment['delivery'] {
  const owed = mirrors?.find(mirror => mirror.status === 'pending' || mirror.status === 'failed');
  return owed ? { platform: owed.publisherId, status: owed.status === 'failed' ? 'failed' : 'pending' } : undefined;
}

export function toWireComment(
  comment: WorkItemCommentRow,
  viewerId: string,
  mirrors?: CommentMirrorRow[],
): WireComment {
  const clientToken =
    comment.author.id === viewerId && comment.sourceKey?.startsWith(LOCAL_SOURCE_KEY_PREFIX)
      ? comment.sourceKey.slice(LOCAL_SOURCE_KEY_PREFIX.length)
      : undefined;
  const delivery = pendingDelivery(mirrors);
  return {
    id: comment.id,
    workItemId: comment.workItemId,
    kind: comment.kind,
    body: comment.body,
    bodyFormat: comment.bodyFormat,
    author: toWireAuthor(comment.author),
    ...(comment.replyTo ? { replyTo: comment.replyTo } : {}),
    mentions: comment.mentions,
    ...(clientToken ? { clientToken } : {}),
    ...(comment.externalSource
      ? {
          origin: {
            integrationId: comment.externalSource.integrationId,
            type: comment.externalSource.type,
            ...(comment.externalSource.url ? { url: comment.externalSource.url } : {}),
          },
        }
      : {}),
    ...(delivery ? { delivery } : {}),
    revision: comment.revision,
    occurredAt: comment.occurredAt.toISOString(),
    ...(comment.editedAt ? { editedAt: comment.editedAt.toISOString() } : {}),
    ...(comment.deletedAt ? { deletedAt: comment.deletedAt.toISOString() } : {}),
  };
}
