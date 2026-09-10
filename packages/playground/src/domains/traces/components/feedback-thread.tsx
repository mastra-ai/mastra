import type { FeedbackItem, ListFeedbackResponse } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Avatar } from '@mastra/playground-ui/components/Avatar';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Comment,
  type CommentVariant,
  CommentComposer,
  CommentComposerInput,
  CommentComposerSend,
  CommentItem,
  CommentItemActions,
  CommentItemAuthor,
  CommentItemAvatar,
  CommentItemBody,
  CommentItemContent,
  CommentItemHeader,
  CommentItemTimestamp,
  CommentList,
} from '@mastra/playground-ui/components/Comment';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { format } from 'date-fns';
import { MessageSquareIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

import { ReviewStatusBadge } from '@/domains/review/components/review-status-badge';
import { feedbackAuthorLabel } from '@/domains/traces/utils/feedback-author';

type FeedbackThreadProps = {
  feedbackData?: ListFeedbackResponse | null;
  isLoadingFeedbackData?: boolean;
  onPageChange?: (page: number) => void;
  /** Rejecting (or throwing) keeps the draft in the composer so it can be retried. */
  onSubmit: (text: string) => void | Promise<unknown>;
  isSubmitting?: boolean;
  /** When provided, records with a feedbackId get a delete action. */
  onDelete?: (feedbackId: string) => void | Promise<unknown>;
  isDeleting?: boolean;
  /**
   * Comment layout variant. Defaults to `thread` (avatar gutter + content column);
   * `embed` renders a compact card suitable for inline use.
   */
  variant?: CommentVariant;
  /** When provided, unreviewed rows get a "Mark reviewed" action. */
  onMarkReviewed?: (feedbackId: string) => void;
  /** feedbackId whose review-status update is in flight (disables its action). */
  pendingFeedbackId?: string;
};

// The server defaults `reviewStatus` to `needs-review`, so a missing value means the same.
function FeedbackReviewStatusBadge({ status }: { status: FeedbackItem['reviewStatus'] }) {
  const resolved = status === 'reviewed' ? 'reviewed' : 'needs-review';
  return (
    <ReviewStatusBadge data-slot="feedback-review-status" status={resolved}>
      {resolved === 'reviewed' ? 'Reviewed' : 'Needs review'}
    </ReviewStatusBadge>
  );
}

function formatBody(fb: FeedbackItem): string {
  const text = fb.comment || (typeof fb.value === 'string' ? fb.value : '');
  if (text) return text;
  if (fb.feedbackType === 'thumbs') return fb.value === 1 ? '\u{1F44D}' : '\u{1F44E}';
  return String(fb.value ?? '');
}

type FeedbackItemsProps = Pick<FeedbackThreadProps, 'onMarkReviewed' | 'pendingFeedbackId'> & {
  variant: CommentVariant;
  items: FeedbackItem[];
  onRequestDelete?: (feedbackId: string) => void;
  isDeleting: boolean;
};

function FeedbackItems({
  variant,
  items,
  onRequestDelete,
  isDeleting,
  onMarkReviewed,
  pendingFeedbackId,
}: FeedbackItemsProps) {
  const rows = items.map((fb, index) => {
    const ts = new Date(fb.timestamp);
    const author = feedbackAuthorLabel(fb);
    const avatar = author ? <Avatar name={author} src={fb.author?.avatarUrl} size="sm" /> : null;
    const name = author && <CommentItemAuthor>{author}</CommentItemAuthor>;
    const timestamp = (
      <CommentItemTimestamp dateTime={ts.toISOString()}>{format(ts, 'MMM d, h:mm:ss aaa')}</CommentItemTimestamp>
    );
    const feedbackId = fb.feedbackId;
    const status = <FeedbackReviewStatusBadge status={fb.reviewStatus} />;
    const markReviewed = onMarkReviewed && feedbackId && fb.reviewStatus !== 'reviewed' && (
      <Button
        variant="ghost"
        size="sm"
        disabled={pendingFeedbackId === feedbackId}
        onClick={() => onMarkReviewed(feedbackId)}
      >
        Mark reviewed
      </Button>
    );
    const deleteAction = onRequestDelete && feedbackId && (
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Delete feedback"
        disabled={isDeleting}
        onClick={() => onRequestDelete(feedbackId)}
      >
        <Trash2Icon />
      </Button>
    );
    const actions = (markReviewed || deleteAction) && (
      <CommentItemActions className="ml-auto">
        {markReviewed}
        {deleteAction}
      </CommentItemActions>
    );
    const body = <CommentItemBody>{formatBody(fb)}</CommentItemBody>;
    const key = feedbackId ?? `${fb.traceId}-${index}`;

    // The thread variant lays the row out as avatar gutter + content column.
    // Without an author there is nothing to align under, so skip the gutter entirely.
    if (variant === 'thread') {
      return (
        <CommentItem key={key}>
          {avatar && <CommentItemAvatar>{avatar}</CommentItemAvatar>}
          <CommentItemContent>
            <CommentItemHeader>
              {name}
              {timestamp}
              {status}
              {actions}
            </CommentItemHeader>
            {body}
          </CommentItemContent>
        </CommentItem>
      );
    }

    // Stacked variants have no gutter, so the avatar sits inline in the header.
    return (
      <CommentItem key={key}>
        <CommentItemHeader>
          {avatar}
          {name}
          {timestamp}
          {status}
          {actions}
        </CommentItemHeader>
        {body}
      </CommentItem>
    );
  });

  // Thread rows are stream entries rendered as `div`s, not list items.
  return variant === 'thread' ? <>{rows}</> : <CommentList>{rows}</CommentList>;
}

/**
 * Feedback rendered as a comment thread: a composer above, existing records below.
 * Pagination, submission, deletion, and review status are driven by the caller.
 */
export function FeedbackThread({
  feedbackData,
  isLoadingFeedbackData,
  onPageChange,
  onSubmit,
  isSubmitting = false,
  onDelete,
  isDeleting = false,
  variant = 'thread',
  onMarkReviewed,
  pendingFeedbackId,
}: FeedbackThreadProps) {
  const [text, setText] = useState('');
  const [feedbackIdToDelete, setFeedbackIdToDelete] = useState<string>();
  const sendBlocked = text.trim().length === 0 || isSubmitting;

  const feedbackItems = feedbackData?.feedback ?? [];
  const currentPage = feedbackData?.pagination?.page ?? 0;
  const hasMore = feedbackData?.pagination?.hasMore ?? false;

  const handleDeleteConfirm = async () => {
    if (!feedbackIdToDelete || !onDelete) return;

    try {
      await onDelete(feedbackIdToDelete);
      setFeedbackIdToDelete(undefined);
    } catch {
      // Keep the confirmation open so the deletion can be retried.
    }
  };

  return (
    <Comment variant={variant} className="min-h-0 gap-4 px-3">
      <CommentComposer
        aria-label="Leave feedback"
        onSubmit={async event => {
          event.preventDefault();
          if (sendBlocked) return;
          try {
            await onSubmit(text.trim());
            setText('');
          } catch {
            // Keep the draft so the comment isn't lost; the caller surfaces the failure.
          }
        }}
      >
        <CommentComposerInput
          aria-label="Leave feedback"
          placeholder="Leave feedback..."
          value={text}
          onChange={event => setText(event.target.value)}
        >
          <CommentComposerSend aria-label="Send feedback" disabled={sendBlocked} />
        </CommentComposerInput>
      </CommentComposer>

      <div className="min-h-0 overflow-y-auto">
        {isLoadingFeedbackData ? (
          <Txt variant="ui-md" className="text-neutral3">
            Loading feedback...
          </Txt>
        ) : feedbackItems.length === 0 ? (
          <EmptyState
            iconSlot={<MessageSquareIcon />}
            titleSlot="No feedback yet"
            descriptionSlot="Leave feedback on this trace to see it here."
          />
        ) : (
          <FeedbackItems
            variant={variant}
            items={feedbackItems}
            onRequestDelete={onDelete ? setFeedbackIdToDelete : undefined}
            isDeleting={isDeleting}
            onMarkReviewed={onMarkReviewed}
            pendingFeedbackId={pendingFeedbackId}
          />
        )}
      </div>

      {(hasMore || currentPage > 0) && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            disabled={currentPage === 0}
            onClick={() => onPageChange?.(currentPage - 1)}
          >
            Previous
          </Button>
          <Button size="sm" variant="ghost" disabled={!hasMore} onClick={() => onPageChange?.(currentPage + 1)}>
            Next
          </Button>
        </div>
      )}

      <AlertDialog
        open={feedbackIdToDelete !== undefined}
        onOpenChange={open => {
          if (!open && !isDeleting) setFeedbackIdToDelete(undefined);
        }}
      >
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete feedback?</AlertDialog.Title>
            <AlertDialog.Description>
              This permanently deletes this feedback comment. This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel disabled={isDeleting}>Cancel</AlertDialog.Cancel>
            <Button variant="primary" disabled={isDeleting} onClick={handleDeleteConfirm}>
              {isDeleting ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </Comment>
  );
}
