import { ArrivalScope, Arriving } from '@mastra/playground-ui/components/Arrival';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { queryKeys } from '../../../../../api/keys';
import { relativeTime } from '../../../../../lib/date/relativeTime';
import {
  useDeleteWorkItemCommentMutation,
  useEditWorkItemCommentMutation,
  usePendingCommentCreates,
  useWorkItemComments,
} from '../../../../../hooks/useWorkItemComments';
import { workItemMeta } from '../../boardItems';
import type { WorkItemComment } from '../../services/commentsWire';
import type { FactoryMentionMember } from '../../services/members';
import type { WorkItem } from '../../services/workItems';
import { CommentRow } from './CommentRow';
import type { CommentQuoteDraft } from './CommentQuote';
import { resolveMentions } from './mentions';

const CONTINUATION_WINDOW_MS = 5 * 60_000;
const MAX_DEEP_LINK_PAGE_LOADS = 3;

export interface FeedUser {
  userId?: string;
  name?: string;
  avatarUrl?: string;
}

function isContinuation(previous: WorkItemComment | undefined, comment: WorkItemComment): boolean {
  if (!previous) return false;
  if (previous.deletedAt !== null || comment.deletedAt !== null) return false;
  if (previous.author.kind !== comment.author.kind || previous.author.id !== comment.author.id) return false;
  return Date.parse(comment.occurredAt) - Date.parse(previous.occurredAt) < CONTINUATION_WINDOW_MS;
}

function pendingComment(
  variables: { body: string; clientToken: string; replyTo?: { commentId: string; quote?: string } },
  workItemId: string,
  user: FeedUser | undefined,
): WorkItemComment {
  return {
    id: `pending-${variables.clientToken}`,
    workItemId,
    kind: 'comment',
    body: variables.body,
    author: { kind: 'user', id: user?.userId ?? '', displayName: user?.name, avatarUrl: user?.avatarUrl },
    ...(variables.replyTo ? { replyTo: variables.replyTo } : {}),
    mentions: [],
    revision: 0,
    occurredAt: new Date().toISOString(),
    editedAt: null,
    deletedAt: null,
  };
}

export function CommentList({
  item,
  factoryProjectId,
  enabled = true,
  currentUser,
  highlightCommentId,
  commentUrl,
  onQuote,
  className,
  maxHeight,
}: {
  item: WorkItem;
  factoryProjectId: string | undefined;
  enabled?: boolean;
  currentUser?: FeedUser;
  highlightCommentId?: string;
  commentUrl?: (commentId: string) => string;
  onQuote: (draft: CommentQuoteDraft) => void;
  className?: string;
  maxHeight?: string;
}) {
  const scope = { workItemId: item.id, factoryProjectId };
  const queryClient = useQueryClient();
  const comments = useWorkItemComments({ ...scope, enabled });
  const editComment = useEditWorkItemCommentMutation(scope);
  const deleteComment = useDeleteWorkItemCommentMutation(scope);
  const pendingCreates = usePendingCommentCreates(item.id);
  const deepLinkLoads = useRef(0);
  const highlightScrolled = useRef(false);
  const lastHighlight = useRef(highlightCommentId);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  if (lastHighlight.current !== highlightCommentId) {
    lastHighlight.current = highlightCommentId;
    deepLinkLoads.current = 0;
    highlightScrolled.current = false;
  }

  // Newest-first pages, reversed twice over: oldest page first, oldest comment first.
  const ordered = (comments.data?.pages ?? []).flatMap(page => page.comments).reverse();
  const knownTokens = new Set(ordered.map(comment => comment.clientToken).filter(token => token !== undefined));
  const rows = [
    ...ordered,
    ...pendingCreates
      .filter(variables => !knownTokens.has(variables.clientToken))
      .map(variables => pendingComment(variables, item.id, currentUser)),
  ];

  const saveEdit = (comment: WorkItemComment, body: string) => {
    // Re-resolve mentions from the roster when it is cached; without it, omit
    // the field so the server keeps the existing rows instead of wiping them.
    const roster = queryClient.getQueryData<FactoryMentionMember[]>(queryKeys.factoryMembers(factoryProjectId));
    editComment.mutate({
      commentId: comment.id,
      input: {
        body,
        expectedRevision: comment.revision,
        ...(roster ? { mentions: resolveMentions(body, roster) } : {}),
      },
    });
  };

  const highlightLoaded = highlightCommentId !== undefined && ordered.some(c => c.id === highlightCommentId);
  useEffect(() => {
    if (!highlightCommentId || highlightLoaded || comments.isPending) return;
    if (!comments.hasNextPage || comments.isFetchingNextPage) return;
    if (deepLinkLoads.current >= MAX_DEEP_LINK_PAGE_LOADS) return;
    deepLinkLoads.current += 1;
    void comments.fetchNextPage();
  }, [comments, highlightCommentId, highlightLoaded]);

  useEffect(() => {
    if (!highlightCommentId || !highlightLoaded || highlightScrolled.current) return;
    highlightScrolled.current = true;
    const viewport = viewportRef.current;
    const target = viewport?.querySelector(`[data-comment-id="${CSS.escape(highlightCommentId)}"]`);
    if (!viewport || !(target instanceof HTMLElement)) return;
    // Scroll the feed viewport only: scrollIntoView would also scroll every
    // ancestor, yanking the page around behind the popover.
    const viewportRect = viewport.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    viewport.scrollTop += targetRect.top - viewportRect.top - (viewport.clientHeight - targetRect.height) / 2;
  }, [highlightCommentId, highlightLoaded]);

  const loading = comments.isPending && enabled;

  return (
    <ScrollArea
      maxHeight={maxHeight}
      autoScroll={highlightCommentId === undefined}
      viewportRef={viewportRef}
      className={className}
    >
      <ArrivalScope>
        {loading ? (
          <div className="flex flex-col gap-2 px-2 py-2" role="status" aria-label="Loading comments">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-4/5" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : null}
        {comments.isError ? (
          <div className="text-ui-sm text-icon3 flex items-center gap-2 px-2 py-2">
            <span>Unable to load comments.</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => void comments.refetch()}>
              <RefreshCw aria-hidden />
              Try again
            </Button>
          </div>
        ) : null}
        {/* The log element stays mounted (empty) through loading, so screen
            readers have the live region before the first addition lands. */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Comments"
          className="flex flex-col px-1 py-1"
        >
          {loading || comments.isError ? null : (
            <>
              {comments.hasNextPage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-center"
                  disabled={comments.isFetchingNextPage}
                  onClick={() => void comments.fetchNextPage()}
                >
                  {comments.isFetchingNextPage ? 'Loading…' : 'Show earlier comments'}
                </Button>
              ) : (
                <p className="text-ui-xs text-icon2 m-0 px-2 py-1.5">
                  Item created · {workItemMeta(item)} · {relativeTime(item.createdAt)}
                </p>
              )}
              {rows.length === 0 ? <p className="text-ui-sm text-icon2 m-0 px-2 py-1.5">No comments yet.</p> : null}
              {rows.map((comment, index) => {
                const pending = comment.id.startsWith('pending-');
                return (
                  <Arriving key={comment.id}>
                    <CommentRow
                      comment={comment}
                      currentUserId={currentUser?.userId}
                      showHeader={!isContinuation(rows[index - 1], comment)}
                      pending={pending}
                      highlighted={comment.id === highlightCommentId}
                      commentUrl={pending ? undefined : commentUrl?.(comment.id)}
                      onQuote={pending ? undefined : onQuote}
                      onSaveEdit={pending ? undefined : body => saveEdit(comment, body)}
                      onDelete={pending ? undefined : () => deleteComment.mutate(comment.id)}
                    />
                  </Arriving>
                );
              })}
            </>
          )}
        </div>
      </ArrivalScope>
    </ScrollArea>
  );
}
