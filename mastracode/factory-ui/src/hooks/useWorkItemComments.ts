import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { skipToken, useInfiniteQuery, useMutation, useMutationState, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import {
  createWorkItemComment,
  deleteWorkItemComment,
  editWorkItemComment,
  listWorkItemComments,
} from '../ui/domains/factory/services/comments';
import type { CreateWorkItemCommentInput, EditWorkItemCommentInput } from '../ui/domains/factory/services/comments';
import type { WorkItemComment, WorkItemCommentPage } from '../ui/domains/factory/services/commentsWire';

export interface WorkItemFeedScope {
  workItemId: string | undefined;
  factoryProjectId: string | undefined;
}

type CommentsData = InfiniteData<WorkItemCommentPage, string | undefined>;

/** Invalidation refetches every loaded page serially, so keep the window bounded. */
const MAX_COMMENT_PAGES = 5;

function createMutationKey(workItemId: string | undefined) {
  return [...queryKeys.workItemCommentsRoot(workItemId), 'create'] as const;
}

function patchComments(
  queryClient: QueryClient,
  listKey: QueryKey,
  commentId: string,
  patch: (comment: WorkItemComment) => WorkItemComment,
) {
  queryClient.setQueryData<CommentsData>(listKey, data =>
    data
      ? {
          ...data,
          pages: data.pages.map(page => ({
            ...page,
            comments: page.comments.map(comment => (comment.id === commentId ? patch(comment) : comment)),
          })),
        }
      : undefined,
  );
}

/**
 * The feed has no poll of its own: the board work-items query already flows
 * every 5s on both feed surfaces, so a moving `feedActivityAt` on the item is
 * the refetch signal (create, edit, and delete all bump it server-side).
 */
function useFeedActivityInvalidation(workItemId: string | undefined, feedActivityAt: string | null | undefined) {
  const queryClient = useQueryClient();
  const lastSeen = useRef(feedActivityAt);
  useEffect(() => {
    const previous = lastSeen.current;
    lastSeen.current = feedActivityAt;
    // `undefined` is "not watching yet" or "no longer watching", never a move.
    if (previous === undefined || feedActivityAt === undefined || previous === feedActivityAt) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.workItemCommentsRoot(workItemId) });
  }, [feedActivityAt, queryClient, workItemId]);
}

/** Newest-first pages of a work item's comment feed; rendering reverses them. */
export function useWorkItemComments({
  workItemId,
  feedActivityAt,
  enabled = true,
}: {
  workItemId: string | undefined;
  feedActivityAt?: string | null;
  enabled?: boolean;
}) {
  const { baseUrl } = useApiConfig();
  useFeedActivityInvalidation(workItemId, enabled ? feedActivityAt : undefined);
  const initialPageParam: string | undefined = undefined;
  return useInfiniteQuery({
    queryKey: queryKeys.workItemComments(workItemId),
    queryFn:
      enabled && workItemId
        ? ({ pageParam, signal }: { pageParam: string | undefined; signal: AbortSignal }) =>
            listWorkItemComments(baseUrl, workItemId, { before: pageParam, signal })
        : skipToken,
    initialPageParam,
    getNextPageParam: lastPage => lastPage.nextCursor,
    maxPages: MAX_COMMENT_PAGES,
    // The activity watcher swallows its first value on remount, so the global
    // 30s staleTime would show a reopened feed stale. Always refetch on mount.
    staleTime: 0,
  });
}

/**
 * Create renders its pending row from mutation state and writes nothing into
 * the query cache: a poll tick landing mid-flight would wholesale-replace the
 * pages and drop a cache-inserted row. Only the work-items query is
 * invalidated — its refetched `feedActivityAt` drives the one comments
 * refetch through the activity watcher.
 */
export function useCreateWorkItemCommentMutation({ workItemId, factoryProjectId }: WorkItemFeedScope) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: createMutationKey(workItemId),
    mutationFn: (input: CreateWorkItemCommentInput) => {
      if (!workItemId) throw new Error('Work item is required');
      return createWorkItemComment(baseUrl, workItemId, input);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
    },
  });
}

export interface PendingCommentCreate {
  input: CreateWorkItemCommentInput;
  /** The mutation's submit time — a stable timestamp for the pending row. */
  submittedAt: number;
}

/**
 * Comment creations still rendered as pending rows: in-flight ones, plus
 * succeeded ones whose server row has not landed in the feed yet (the list
 * dedups them by clientToken once it does).
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

function isCreateCommentVariables(value: unknown): value is CreateWorkItemCommentInput {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  return (
    'body' in value && typeof value.body === 'string' && 'clientToken' in value && typeof value.clientToken === 'string'
  );
}

export function useEditWorkItemCommentMutation({ workItemId, factoryProjectId }: WorkItemFeedScope) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItemComments(workItemId);
  return useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: EditWorkItemCommentInput }) => {
      if (!workItemId) throw new Error('Work item is required');
      return editWorkItemComment(baseUrl, workItemId, commentId, input);
    },
    onMutate: async ({ commentId, input }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workItemCommentsRoot(workItemId) });
      const previous = queryClient.getQueryData<CommentsData>(listKey);
      patchComments(queryClient, listKey, commentId, comment => ({
        ...comment,
        body: input.body,
        mentions: input.mentions ?? comment.mentions,
        editedAt: new Date().toISOString(),
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    // The server row replaces the optimistic patch right away, so a follow-up
    // edit sends the fresh revision instead of 409ing on its own predecessor.
    onSuccess: comment => {
      patchComments(queryClient, listKey, comment.id, () => comment);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
    },
  });
}

export function useDeleteWorkItemCommentMutation({ workItemId, factoryProjectId }: WorkItemFeedScope) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  const listKey = queryKeys.workItemComments(workItemId);
  return useMutation({
    mutationFn: (commentId: string) => {
      if (!workItemId) throw new Error('Work item is required');
      return deleteWorkItemComment(baseUrl, workItemId, commentId);
    },
    onMutate: async commentId => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workItemCommentsRoot(workItemId) });
      const previous = queryClient.getQueryData<CommentsData>(listKey);
      patchComments(queryClient, listKey, commentId, comment => ({
        ...comment,
        body: '',
        mentions: [],
        deletedAt: new Date().toISOString(),
      }));
      return { previous };
    },
    onError: (_error, _commentId, context) => {
      if (context?.previous) queryClient.setQueryData(listKey, context.previous);
    },
    onSuccess: comment => {
      patchComments(queryClient, listKey, comment.id, () => comment);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.workItems(factoryProjectId) });
    },
  });
}
