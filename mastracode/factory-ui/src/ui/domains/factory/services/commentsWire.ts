export interface CommentAuthor {
  kind: 'user' | 'agent' | 'integration';
  id: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface CommentMentionRef {
  kind: 'user';
  id: string;
}

export interface CommentReplyRef {
  commentId: string;
  quote?: string;
  authorId?: string;
  authorName?: string;
}

export interface CommentOrigin {
  integrationId: string;
  type: string;
  url?: string;
}

export interface WorkItemComment {
  id: string;
  workItemId: string;
  kind: string;
  body: string;
  author: CommentAuthor;
  replyTo?: CommentReplyRef;
  mentions: CommentMentionRef[];
  origin?: CommentOrigin;
  occurredAt: string;
  editedAt: string | null;
  deletedAt: string | null;
}

export interface WorkItemCommentPage {
  comments: WorkItemComment[];
  nextCursor?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isCommentAuthor(value: unknown): value is CommentAuthor {
  if (!isRecord(value)) return false;
  return (
    (value.kind === 'user' || value.kind === 'agent' || value.kind === 'integration') &&
    typeof value.id === 'string' &&
    isOptionalString(value.displayName) &&
    isOptionalString(value.avatarUrl)
  );
}

function isCommentMentionRef(value: unknown): value is CommentMentionRef {
  return isRecord(value) && value.kind === 'user' && typeof value.id === 'string';
}

function isCommentReplyRef(value: unknown): value is CommentReplyRef {
  if (!isRecord(value)) return false;
  return (
    typeof value.commentId === 'string' &&
    isOptionalString(value.quote) &&
    isOptionalString(value.authorId) &&
    isOptionalString(value.authorName)
  );
}

function isCommentOrigin(value: unknown): value is CommentOrigin {
  if (!isRecord(value)) return false;
  return typeof value.integrationId === 'string' && typeof value.type === 'string' && isOptionalString(value.url);
}

export function isWorkItemComment(value: unknown): value is WorkItemComment {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.workItemId === 'string' &&
    typeof value.kind === 'string' &&
    typeof value.body === 'string' &&
    isCommentAuthor(value.author) &&
    (value.replyTo === undefined || isCommentReplyRef(value.replyTo)) &&
    Array.isArray(value.mentions) &&
    value.mentions.every(isCommentMentionRef) &&
    (value.origin === undefined || isCommentOrigin(value.origin)) &&
    typeof value.occurredAt === 'string' &&
    (value.editedAt === null || typeof value.editedAt === 'string') &&
    (value.deletedAt === null || typeof value.deletedAt === 'string')
  );
}

export function isWorkItemCommentPage(value: unknown): value is WorkItemCommentPage {
  if (!isRecord(value)) return false;
  return Array.isArray(value.comments) && value.comments.every(isWorkItemComment) && isOptionalString(value.nextCursor);
}
