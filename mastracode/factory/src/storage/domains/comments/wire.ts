import type { FactoryActorRef } from './actor.js';
import type { FactoryMentionRef, WorkItemCommentReplyRef, WorkItemCommentRow } from './base.js';

export interface WireComment {
  id: string;
  workItemId: string;
  kind: string;
  body: string;
  bodyFormat: string;
  author: FactoryActorRef;
  replyTo?: WorkItemCommentReplyRef;
  mentions: FactoryMentionRef[];
  /** The viewer's own local sends only, so their client can match pending rows. */
  clientToken?: string;
  origin?: { integrationId: string; type: string; url?: string };
  revision: number;
  occurredAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface WireCommentPage {
  comments: WireComment[];
  nextCursor?: string;
}

const LOCAL_SOURCE_KEY_PREFIX = 'local:comment:';

export function toWireComment(comment: WorkItemCommentRow, viewerId: string): WireComment {
  const clientToken =
    comment.author.id === viewerId && comment.sourceKey?.startsWith(LOCAL_SOURCE_KEY_PREFIX)
      ? comment.sourceKey.slice(LOCAL_SOURCE_KEY_PREFIX.length)
      : undefined;
  return {
    id: comment.id,
    workItemId: comment.workItemId,
    kind: comment.kind,
    body: comment.body,
    bodyFormat: comment.bodyFormat,
    author: comment.author,
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
    revision: comment.revision,
    occurredAt: comment.occurredAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() ?? null,
    deletedAt: comment.deletedAt?.toISOString() ?? null,
  };
}
