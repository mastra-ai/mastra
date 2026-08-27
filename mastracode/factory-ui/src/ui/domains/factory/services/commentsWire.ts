/**
 * The comment feed's wire contract, owned by the server package: the routes
 * and the UI move together or the build breaks.
 */

import type { FactoryActorRef } from '@mastra/factory/storage/domains/comments/actor';
import type { FactoryMentionRef, WorkItemCommentReplyRef } from '@mastra/factory/storage/domains/comments/base';
import type { WireComment, WireCommentPage } from '@mastra/factory/storage/domains/comments/wire';

export type WorkItemComment = WireComment;
export type WorkItemCommentPage = WireCommentPage;
export type CommentAuthor = FactoryActorRef;
export type CommentMentionRef = FactoryMentionRef;
export type CommentReplyRef = WorkItemCommentReplyRef;
