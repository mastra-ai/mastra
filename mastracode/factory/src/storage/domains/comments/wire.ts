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
  /** Present on locally created comments, so clients can match pending sends. */
  clientToken?: string;
  origin?: { integrationId: string; type: string; url?: string };
  revision: number;
  occurredAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
}

const LOCAL_SOURCE_KEY_PREFIX = 'local:comment:';

export function toWireComment(comment: WorkItemCommentRow): WireComment {
  const clientToken = comment.sourceKey?.startsWith(LOCAL_SOURCE_KEY_PREFIX)
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
    occurredAt: comment.occurredAt,
    editedAt: comment.editedAt,
    deletedAt: comment.deletedAt,
  };
}
