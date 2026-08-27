import { ArrivalScope, Arriving } from '@mastra/playground-ui/components/Arrival';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { RefreshCw } from 'lucide-react';
import { useRef } from 'react';

import {
  useDeleteWorkItemCommentMutation,
  useEditWorkItemCommentMutation,
  usePendingCommentCreates,
  useWorkItemComments,
} from '../../../../../hooks/useWorkItemComments';
import type { PendingCommentCreate } from '../../../../../hooks/useWorkItemComments';
import type { WorkItemComment, WorkItemCommentPage } from '../../services/commentsWire';
import type { WorkItem } from '../../services/workItems';
import { CommentRow } from './CommentRow';
import type { CommentQuoteDraft } from './CommentQuote';
import { useCentreInViewport } from './useCentreInViewport';
import { useMentionResolver } from './useMentionResolver';

const CONTINUATION_WINDOW_MS = 5 * 60_000;

export interface FeedUser {
  userId?: string;
  name?: string;
  avatarUrl?: string;
}

function isContinuation(previous: WorkItemComment | undefined, comment: WorkItemComment): boolean {
  if (!previous) return false;
  if (previous.deletedAt !== undefined || comment.deletedAt !== undefined) return false;
  if (previous.author.kind !== comment.author.kind || previous.author.id !== comment.author.id) return false;
  return Date.parse(comment.occurredAt) - Date.parse(previous.occurredAt) < CONTINUATION_WINDOW_MS;
}

/** A comment as the list renders it: server rows and not-yet-landed sends alike. */
interface FeedRow {
  comment: WorkItemComment;
  pending: boolean;
}

/**
 * Server rows oldest-first, followed by the sends whose server row has not
 * landed yet — matched by `clientToken`, so a landed one is never shown twice.
 */
function feedRows(
  pages: WorkItemCommentPage[],
  pendingCreates: PendingCommentCreate[],
  workItemId: string,
  user: FeedUser | undefined,
): FeedRow[] {
  const ordered = pages.flatMap(page => page.comments).reverse();
  const landedTokens = new Set(ordered.map(comment => comment.clientToken).filter(token => token !== undefined));
  return [
    ...ordered.map(comment => ({ comment, pending: false })),
    ...pendingCreates
      .filter(pending => !landedTokens.has(pending.input.clientToken))
      .map(pending => ({ comment: pendingComment(pending, workItemId, user), pending: true })),
  ];
}

function pendingComment(
  { input, submittedAt }: PendingCommentCreate,
  workItemId: string,
  user: FeedUser | undefined,
): WorkItemComment {
  return {
    id: `pending-${input.clientToken}`,
    workItemId,
    kind: 'comment',
    body: input.body,
    bodyFormat: 'markdown',
    author: { kind: 'user', id: user?.userId ?? '', displayName: user?.name, avatarUrl: user?.avatarUrl },
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    mentions: [],
    clientToken: input.clientToken,
    revision: 0,
    occurredAt: new Date(submittedAt).toISOString(),
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
  const resolveMentions = useMentionResolver(factoryProjectId);
  const comments = useWorkItemComments({
    workItemId: item.id,
    feedActivityAt: item.feedActivityAt,
    aroundCommentId: highlightCommentId,
    enabled,
  });
  const editComment = useEditWorkItemCommentMutation(scope);
  const deleteComment = useDeleteWorkItemCommentMutation(scope);
  const pendingCreates = usePendingCommentCreates(item.id);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const rows = feedRows(comments.data?.pages ?? [], pendingCreates, item.id, currentUser);

  const submitEdit = async (comment: WorkItemComment, body: string) => {
    // An unreadable roster omits the field, so the server keeps the mention
    // rows it already has instead of wiping them.
    const mentions = await resolveMentions(body);
    await editComment.mutateAsync({
      commentId: comment.id,
      input: { body, expectedRevision: comment.revision, ...(mentions ? { mentions } : {}) },
    });
  };

  // The board snapshot already knows an empty feed: no skeleton flash for it.
  const loadingFirstPage = comments.isPending && enabled && item.commentCount > 0;
  // A failed background refetch keeps its cached rows on screen; only a feed
  // that never loaded falls back to the retry alone.
  const nothingToShow = comments.isError && comments.data === undefined;

  const centreHighlightedRow = useCentreInViewport(viewportRef);

  return (
    <ScrollArea
      maxHeight={maxHeight}
      autoScroll={highlightCommentId === undefined}
      viewportRef={viewportRef}
      className={className}
      // Chat anchoring: a short feed sits against the composer, not the header.
      viewPortClassName="flex flex-col [&>*]:mt-auto"
    >
      <ArrivalScope>
        {loadingFirstPage ? (
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
        {/* Mounted through loading so the live region exists before the first addition. */}
        <div
          role="log"
          aria-live="polite"
          aria-relevant="additions"
          aria-label="Comments"
          className="flex flex-col px-1 py-1"
        >
          {loadingFirstPage || nothingToShow ? null : (
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
              ) : null}
              {rows.map(({ comment, pending }, index) => (
                // The clientToken key hands the pending row's DOM node to the
                // landed server row, so the entrance animation plays once.
                <Arriving key={comment.clientToken ?? comment.id}>
                  <CommentRow
                    ref={comment.id === highlightCommentId ? centreHighlightedRow : undefined}
                    comment={comment}
                    currentUserId={currentUser?.userId}
                    showHeader={!isContinuation(rows[index - 1]?.comment, comment)}
                    pending={pending}
                    highlighted={comment.id === highlightCommentId}
                    commentUrl={pending ? undefined : commentUrl?.(comment.id)}
                    onQuote={pending ? undefined : onQuote}
                    onSaveEdit={pending ? undefined : body => submitEdit(comment, body)}
                    onDelete={pending ? undefined : () => deleteComment.mutate(comment.id)}
                  />
                </Arriving>
              ))}
            </>
          )}
        </div>
      </ArrivalScope>
    </ScrollArea>
  );
}
