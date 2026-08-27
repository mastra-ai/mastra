import { requestJson } from './request';
import type { CommentMentionRef, WorkItemComment, WorkItemCommentPage } from './commentsWire';

export interface CreateWorkItemCommentInput {
  body: string;
  clientToken: string;
  replyTo?: { commentId: string; quote?: string };
  mentions?: CommentMentionRef[];
}

export interface EditWorkItemCommentInput {
  body: string;
  mentions?: CommentMentionRef[];
  /** The revision the editor saw; the server 409s when it moved meanwhile. */
  expectedRevision?: number;
}

export async function listWorkItemComments(
  baseUrl: string,
  workItemId: string,
  options: { before?: string; signal?: AbortSignal } = {},
): Promise<WorkItemCommentPage> {
  const query = options.before ? `?before=${encodeURIComponent(options.before)}` : '';
  return requestJson<WorkItemCommentPage>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments${query}`,
    { signal: options.signal },
  );
}

export async function createWorkItemComment(
  baseUrl: string,
  workItemId: string,
  input: CreateWorkItemCommentInput,
): Promise<WorkItemComment> {
  const { comment } = await requestJson<{ comment: WorkItemComment }>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments`,
    { method: 'POST', body: JSON.stringify(input) },
  );
  return comment;
}

export async function editWorkItemComment(
  baseUrl: string,
  workItemId: string,
  commentId: string,
  input: EditWorkItemCommentInput,
): Promise<WorkItemComment> {
  const { comment } = await requestJson<{ comment: WorkItemComment }>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
  return comment;
}

export async function deleteWorkItemComment(
  baseUrl: string,
  workItemId: string,
  commentId: string,
): Promise<WorkItemComment> {
  const { comment } = await requestJson<{ comment: WorkItemComment }>(
    `${baseUrl}/web/factory/work-items/${encodeURIComponent(workItemId)}/comments/${encodeURIComponent(commentId)}`,
    { method: 'DELETE' },
  );
  return comment;
}
