import { requestJson } from './request';
import type { CommentMentionRef, WorkItemComment, WorkItemCommentPage } from './commentsWire';
import { isWorkItemComment, isWorkItemCommentPage } from './commentsWire';

export interface CreateWorkItemCommentInput {
  body: string;
  clientToken: string;
  replyTo?: { commentId: string; quote?: string };
  mentions?: CommentMentionRef[];
}

export interface EditWorkItemCommentInput {
  body: string;
  mentions?: CommentMentionRef[];
}

function requireCommentPage(data: unknown): WorkItemCommentPage {
  if (!isWorkItemCommentPage(data)) throw new Error('Unexpected comments response shape');
  return data;
}

function requireComment(data: unknown): WorkItemComment {
  if (typeof data !== 'object' || data === null || !('comment' in data) || !isWorkItemComment(data.comment)) {
    throw new Error('Unexpected comment response shape');
  }
  return data.comment;
}

export async function listWorkItemComments(
  baseUrl: string,
  workItemId: string,
  options: { before?: string; signal?: AbortSignal } = {},
): Promise<WorkItemCommentPage> {
  const query = options.before ? `?before=${encodeURIComponent(options.before)}` : '';
  const data = await requestJson<unknown>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments${query}`,
    { signal: options.signal },
  );
  return requireCommentPage(data);
}

export async function createWorkItemComment(
  baseUrl: string,
  workItemId: string,
  input: CreateWorkItemCommentInput,
): Promise<WorkItemComment> {
  const data = await requestJson<unknown>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return requireComment(data);
}

export async function editWorkItemComment(
  baseUrl: string,
  workItemId: string,
  commentId: string,
  input: EditWorkItemCommentInput,
): Promise<WorkItemComment> {
  const data = await requestJson<unknown>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return requireComment(data);
}

export async function deleteWorkItemComment(
  baseUrl: string,
  workItemId: string,
  commentId: string,
): Promise<WorkItemComment> {
  const data = await requestJson<unknown>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
  );
  return requireComment(data);
}
