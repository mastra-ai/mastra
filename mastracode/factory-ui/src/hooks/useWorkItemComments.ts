import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { skipToken, useInfiniteQuery, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { isRecord } from '../lib/isRecord';
import { queryKeys } from '../api/keys';
import {
  createWorkItemComment,
  deleteWorkItemComment,
  editWorkItemComment,
  listWorkItemComments,
} from '../ui/domains/factory/services/comments';
import type { CreateWorkItemCommentInput, EditWorkItemCommentInput } from '../ui/domains/factory/services/comments';
import { useFeedEventsConnected } from '../ui/domains/factory/context/FeedEventsProvider';
import type { WorkItemComment, WorkItemCommentPage } from '../ui/domains/factory/services/commentsWire';

export interface WorkItemFeedScope {
  workItemId: string | undefined;
  factoryProjectId: string | undefined;
}

type CommentsData = InfiniteData<WorkItemCommentPage, string | undefined>;

/** Invalidation refetches every loaded page serially, so keep the window bounded. */
const MAX_COMMENT_PAGES = 5;

/** Only runs while the feed stream is down; the provider's reconnect closes the gap. */
export const FEED_FALLBACK_POLL_MS = 5_000;

function requireWorkItemId(workItemId: string | undefined): string {
  if (!workItemId) throw new Error('Work item is required');
  return workItemId;
}

function createMutationKey(workItemId: string | undefined) {
  return [...queryKeys.workItemCommentsRoot(workItemId), 'create'] as const;
}

type CommentPatch = (comment: WorkItemComment) => WorkItemComment;

function patchPage(page: WorkItemCommentPage, commentId: string, patch: CommentPatch): WorkItemCommentPage {
  return {
    ...page,
    comments: page.comments.map(comment => (comment.id === commentId ? patch(comment) : comment)),
  };
}

/** Every anchor the work item is read under holds its own pages; all of them carry the row. */
function patchComments(queryClient: QueryClient, rootKey: QueryKey, commentId: string, patch: CommentPatch) {
  queryClient.setQueriesData<CommentsData>({ queryKey: rootKey }, data => {
    if (!data) return undefined;
    return { ...data, pages: data.pages.map(page => patchPage(page, commentId, patch)) };
  });
}

function findComment(queryClient: QueryClient, rootKey: QueryKey, commentId: string): WorkItemComment | undefined {
  return queryClient
    .getQueriesData<CommentsData>({ queryKey: rootKey })
    .flatMap(([, data]) => data?.pages.flatMap(page => page.comments) ?? [])
    .find(comment => comment.id === commentId);
}

/**
 * Newest-first pages of a work item's comment feed; rendering reverses them.
 * `aroundCommentId` anchors the first page on a deep-linked comment, so it
 * arrives with the feed instead of being paged back to.
 */
export function useWorkItemComments({
  workItemId,
  aroundCommentId,
  enabled = true,
}: {
  workItemId: string | undefined;
  aroundCommentId?: string;
  enabled?: boolean;
}) {
  const { baseUrl } = useApiConfig();
  const connected = useFeedEventsConnected();
  const initialPageParam: string | undefined = undefined;
  const queryFn =
    enabled && workItemId
      ? ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
          listWorkItemComments(baseUrl, workItemId, {
            before: pageParam,
            // The anchor shapes the first page only; older pages walk its cursor.
            ...(pageParam === undefined && aroundCommentId ? { around: aroundCommentId } : {}),
            signal,
          })
      : skipToken;
  return useInfiniteQuery({
    queryKey: queryKeys.workItemComments(workItemId, aroundCommentId),
    queryFn,
    initialPageParam,
    getNextPageParam: lastPage => lastPage.nextCursor,
    maxPages: MAX_COMMENT_PAGES,
    refetchInterval: connected ? false : FEED_FALLBACK_POLL_MS,
  });
}

/** Newest-first pages, so a fresh comment belongs at the head of the first one. */
function prependComment(queryClient: QueryClient, rootKey: QueryKey, comment: WorkItemComment) {
  queryClient.setQueriesData<CommentsData>({ queryKey: rootKey }, data => {
    const [newest, ...older] = data?.pages ?? [];
    if (!data || !newest) return data;
    if (data.pages.some(page => page.comments.some(existing => existing.id === comment.id))) return data;
    return { ...data, pages: [{ ...newest, comments: [comment, ...newest.comments] }, ...older] };
  });
}

/**
 * Writes nothing into the query cache — a poll tick landing mid-flight would
 * replace the pages wholesale and drop the row. The pending row is rendered
 * from mutation state instead, and the settled create pulls its own row in:
 * an author never waits on the broker to see what they just wrote.
 */
export function useCreateWorkItemCommentMutation({ workItemId, factoryProjectId }: WorkItemFeedScope) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: createMutationKey(workItemId),
    mutationFn: (input: CreateWorkItemCommentInput) =>
      createWorkItemComment(baseUrl, requireWorkItemId(workItemId), input),
    onSuccess: comment => prependComment(queryClient, queryKeys.workItemCommentsRoot(workItemId), comment),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsRoot(workItemId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) }),
      ]);
    },
  });
}

export interface PendingCommentCreate {
  input: CreateWorkItemCommentInput;
  /** The mutation's submit time — a stable timestamp for the pending row. */
  submittedAt: number;
}

/**
 * Creations still rendered as pending rows: in flight, plus succeeded ones
 * whose server row has not landed yet (the list dedups them by clientToken).
 */
export function usePendingCommentCreates(workItemId: string | undefined): PendingCommentCreate[] {
  return useMutationState({
    filters: {
      mutationKey: createMutationKey(workItemId),
      predicate: mutation => mutation.state.status === 'pending' || mutation.state.status === 'success',
    },
    select: (mutation): PendingCommentCreate | undefined => {
      const variables = mutation.state.variables;
      return isCreateCommentVariables(variables)
        ? { input: variables, submittedAt: mutation.state.submittedAt }
        : undefined;
    },
  }).filter(pending => pending !== undefined);
}

/** `useMutationState` hands variables back as `unknown`; the pending row needs these two. */
function isCreateCommentVariables(value: unknown): value is CreateWorkItemCommentInput {
  return isRecord(value) && typeof value.body === 'string' && typeof value.clientToken === 'string';
}

/**
 * The shared half of an edit or a delete: patch the row, roll back that one
 * row on failure, then let the server row take over so a follow-up edit sends
 * the fresh revision. A whole-feed rollback would revive its neighbours' too.
 */
function useOptimisticCommentPatch<TVariables>(
  { workItemId, factoryProjectId }: WorkItemFeedScope,
  optimistic: (variables: TVariables) => { commentId: string; patch: CommentPatch },
) {
  const queryClient = useQueryClient();
  const rootKey = queryKeys.workItemCommentsRoot(workItemId);
  return {
    onMutate: async (variables: TVariables) => {
      await queryClient.cancelQueries({ queryKey: rootKey });
      const { commentId, patch } = optimistic(variables);
      const previous = findComment(queryClient, rootKey, commentId);
      patchComments(queryClient, rootKey, commentId, patch);
      return { previous };
    },
    onError: (_error: Error, _variables: TVariables, context: { previous?: WorkItemComment } | undefined) => {
      const previous = context?.previous;
      if (previous) patchComments(queryClient, rootKey, previous.id, () => previous);
    },
    onSuccess: (comment: WorkItemComment) => {
      patchComments(queryClient, rootKey, comment.id, () => comment);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
    },
  };
}

interface EditCommentVariables {
  commentId: string;
  input: EditWorkItemCommentInput;
}

export function useEditWorkItemCommentMutation(scope: WorkItemFeedScope) {
  const { baseUrl } = useApiConfig();
  const { workItemId } = scope;
  const optimistic = useOptimisticCommentPatch<EditCommentVariables>(scope, ({ commentId, input }) => ({
    commentId,
    patch: comment => ({
      ...comment,
      body: input.body,
      mentions: input.mentions ?? comment.mentions,
      editedAt: new Date().toISOString(),
    }),
  }));
  return useMutation({
    mutationFn: ({ commentId, input }: EditCommentVariables) =>
      editWorkItemComment(baseUrl, requireWorkItemId(workItemId), commentId, input),
    ...optimistic,
  });
}

export function useDeleteWorkItemCommentMutation(scope: WorkItemFeedScope) {
  const { baseUrl } = useApiConfig();
  const { workItemId } = scope;
  const optimistic = useOptimisticCommentPatch<string>(scope, commentId => ({
    commentId,
    patch: comment => ({ ...comment, body: '', mentions: [], deletedAt: new Date().toISOString() }),
  }));
  return useMutation({
    mutationFn: (commentId: string) => deleteWorkItemComment(baseUrl, requireWorkItemId(workItemId), commentId),
    ...optimistic,
  });
}
