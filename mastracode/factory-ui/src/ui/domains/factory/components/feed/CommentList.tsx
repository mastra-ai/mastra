import { ArrivalScope, useWatched } from '@mastra/playground-ui/components/Arrival';
import { Button } from '@mastra/playground-ui/components/Button';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MessageCircle, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import './comment-arrival.css';

import {
  useDeleteWorkItemCommentMutation,
  useEditWorkItemCommentMutation,
  usePendingCommentCreates,
  useWorkItemComments,
} from '../../../../../hooks/useWorkItemComments';
import type { PendingCommentCreate } from '../../../../../hooks/useWorkItemComments';
import type { WorkItemComment, WorkItemCommentPage } from '../../services/commentsWire';
import type { AuditActorProfile, AuditEvent } from '../../services/audit';
import type { WorkItem } from '../../services/workItems';
import { ActivityEvent } from '../WorkItemActivity';
import { CommentRow } from './CommentRow';
import type { CommentQuoteDraft } from './CommentQuote';
import { useCentreInViewport } from './useCentreInViewport';
import { useMentionResolver } from './useMentionResolver';

const CONTINUATION_WINDOW_MS = 5 * 60_000;
// Stable defaults: a fresh `[]` per render would read as new input downstream.
const NO_EVENTS: AuditEvent[] = [];
const NO_ACTORS: Record<string, AuditActorProfile> = {};

/** The feed's own entrance: a row the reader watched land rises into place. */
function ArrivingComment({ children }: { children: ReactNode }) {
  const watched = useWatched();

  return (
    <div className={watched ? 'comment-arriving' : undefined}>
      <ArrivalScope>{children}</ArrivalScope>
    </div>
  );
}

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

/** A row as the list renders it: server comments and not-yet-landed sends alike, and the item's other events between them. */
type FeedRow = { kind: 'comment'; comment: WorkItemComment; pending: boolean } | { kind: 'event'; event: AuditEvent };

function rowTime(row: FeedRow): number {
  return Date.parse(row.kind === 'comment' ? row.comment.occurredAt : row.event.occurredAt);
}

// The clientToken key hands the pending row's DOM node to the landed server row, so its entrance plays once.
function rowKey(row: FeedRow): string {
  return row.kind === 'event' ? row.event.id : (row.comment.clientToken ?? row.comment.id);
}

/**
 * Everything oldest-first. Sends whose server row has not landed yet are
 * matched by `clientToken`, so a landed one is never shown twice.
 */
function feedRows(
  pages: WorkItemCommentPage[],
  pendingCreates: PendingCommentCreate[],
  events: AuditEvent[],
  workItemId: string,
  user: FeedUser | undefined,
): FeedRow[] {
  const ordered = pages.flatMap(page => page.comments).reverse();
  const landedTokens = new Set(ordered.map(comment => comment.clientToken).filter(token => token !== undefined));
  const rows: FeedRow[] = [
    ...ordered.map(comment => ({ kind: 'comment' as const, comment, pending: false })),
    ...pendingCreates
      .filter(pending => !landedTokens.has(pending.input.clientToken))
      .map(pending => ({
        kind: 'comment' as const,
        comment: pendingComment(pending, workItemId, user),
        pending: true,
      })),
    ...events.map(event => ({ kind: 'event' as const, event })),
  ];
  return rows.sort((left, right) => rowTime(left) - rowTime(right));
}

function previousComment(rows: FeedRow[], index: number): WorkItemComment | undefined {
  const previous = rows[index - 1];
  return previous?.kind === 'comment' ? previous.comment : undefined;
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

interface LandingStyle extends CSSProperties {
  '--i': number;
}

/** The row's turn in the staggered landing. */
function landingStyle(turn: number): LandingStyle {
  return { '--i': turn };
}

/** Mounts when the stream first shows: what is on screen then lands staggered, later arrivals have their own entrance. */
function StreamLanding({ initialRows, children }: { initialRows: number; children: (landing: number) => ReactNode }) {
  const [landing] = useState(initialRows);
  return children(landing);
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
  events = NO_EVENTS,
  actors = NO_ACTORS,
  leading,
  leadingLoaded = true,
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
  /** The item's other history, shown between the comments in time order. */
  events?: AuditEvent[];
  actors?: Record<string, AuditActorProfile>;
  /** Scrolls with the stream, above its first row. */
  leading?: ReactNode;
  /** False while `leading` still loads: the skeleton holds so both land together. */
  leadingLoaded?: boolean;
}) {
  const scope = { workItemId: item.id, factoryProjectId };
  const resolveMentions = useMentionResolver(factoryProjectId);
  const comments = useWorkItemComments({
    workItemId: item.id,
    aroundCommentId: highlightCommentId,
    enabled,
  });
  const editComment = useEditWorkItemCommentMutation(scope);
  const deleteComment = useDeleteWorkItemCommentMutation(scope);
  const pendingCreates = usePendingCommentCreates(item.id);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const rows = feedRows(comments.data?.pages ?? [], pendingCreates, events, item.id, currentUser);

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
  const showSkeleton = !leadingLoaded || (comments.isPending && enabled && item.commentCount > 0);
  // A failed background refetch keeps its cached rows on screen; only a feed
  // that never loaded falls back to the retry alone.
  const nothingToShow = comments.isError && comments.data === undefined;

  const centreHighlightedRow = useCentreInViewport(viewportRef);

  return (
    <ScrollArea
      maxHeight={maxHeight}
      autoScroll={highlightCommentId === undefined}
      viewportRef={viewportRef}
      // The viewport fills by flex: the card it sits in has no definite height to take a percentage of.
      className={cn('flex flex-col', className)}
      viewPortClassName="flex min-h-0 grow flex-col"
    >
      <ArrivalScope>
        {!showSkeleton && leading !== undefined && (
          <div className="stream-landing" style={landingStyle(0)}>
            {leading}
          </div>
        )}
        {/* Chat anchoring: a short stream sits against the composer, not the description. */}
        <div className="mt-auto flex min-h-40 flex-col justify-end py-2">
          {!showSkeleton && leading !== undefined && (
            <div
              aria-hidden
              className="text-ui-xs text-icon3 stream-landing flex items-center gap-2 px-3 pb-1"
              style={landingStyle(1)}
            >
              <span className="bg-border1 h-px flex-1" />
              Activity
              <span className="bg-border1 h-px flex-1" />
            </div>
          )}
          {showSkeleton ? (
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
          {!showSkeleton && !comments.isError && rows.length === 0 ? (
            <div className="text-ui-sm text-neutral6/40 flex items-center justify-center gap-1.5 px-2 py-6">
              <MessageCircle size={14} aria-hidden />
              <span>No activity yet</span>
            </div>
          ) : null}
          {/* Mounted through loading so the live region exists before the first addition. */}
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Activity"
            className="flex flex-col px-1 py-1"
          >
            {showSkeleton || nothingToShow ? null : (
              <StreamLanding initialRows={rows.length}>
                {landing => (
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
                    {rows.map((row, index) => (
                      <div
                        key={rowKey(row)}
                        className={index < landing ? 'stream-landing' : undefined}
                        style={index < landing ? landingStyle(index + 2) : undefined}
                      >
                        {row.kind === 'event' ? (
                          <ActivityEvent event={row.event} actors={actors} className="px-2 py-1.5" />
                        ) : (
                          <ArrivingComment>
                            <CommentRow
                              ref={row.comment.id === highlightCommentId ? centreHighlightedRow : undefined}
                              comment={row.comment}
                              currentUserId={currentUser?.userId}
                              showHeader={!isContinuation(previousComment(rows, index), row.comment)}
                              pending={row.pending}
                              highlighted={row.comment.id === highlightCommentId}
                              commentUrl={row.pending ? undefined : commentUrl?.(row.comment.id)}
                              onQuote={row.pending ? undefined : onQuote}
                              onSaveEdit={row.pending ? undefined : body => submitEdit(row.comment, body)}
                              onDelete={row.pending ? undefined : () => deleteComment.mutate(row.comment.id)}
                            />
                          </ArrivingComment>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </StreamLanding>
            )}
          </div>
        </div>
      </ArrivalScope>
    </ScrollArea>
  );
}
