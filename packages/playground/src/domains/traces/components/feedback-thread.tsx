import type { FeedbackItem, ListFeedbackResponse } from '@mastra/client-js';
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
import { Txt } from '@mastra/playground-ui/components/Txt';
import { format } from 'date-fns';
import { Trash2Icon } from 'lucide-react';
import { useState } from 'react';

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
};

function formatBody(fb: FeedbackItem): string {
  const text = fb.comment || (typeof fb.value === 'string' ? fb.value : '');
  if (text) return text;
  if (fb.feedbackType === 'thumbs') return fb.value === 1 ? '\u{1F44D}' : '\u{1F44E}';
  return String(fb.value ?? '');
}

function FeedbackItems({
  variant,
  items,
  onDelete,
  isDeleting,
}: {
  variant: CommentVariant;
  items: FeedbackItem[];
  onDelete?: (feedbackId: string) => void | Promise<unknown>;
  isDeleting: boolean;
}) {
  const rows = items.map((fb, index) => {
    const ts = new Date(fb.timestamp);
    const author = feedbackAuthorLabel(fb);
    const avatar = author ? <Avatar name={author} src={fb.author?.avatarUrl} size="sm" /> : null;
    const name = author && <CommentItemAuthor>{author}</CommentItemAuthor>;
    const timestamp = (
      <CommentItemTimestamp dateTime={ts.toISOString()}>{format(ts, 'MMM d, h:mm:ss aaa')}</CommentItemTimestamp>
    );
    const feedbackId = fb.feedbackId;
    const actions =
      onDelete && feedbackId ? (
        <CommentItemActions className="ml-auto">
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete feedback"
            disabled={isDeleting}
            onClick={() => onDelete(feedbackId)}
          >
            <Trash2Icon />
          </Button>
        </CommentItemActions>
      ) : null;
    const body = <CommentItemBody>{formatBody(fb)}</CommentItemBody>;
    const key = feedbackId ?? `${fb.traceId}-${index}`;

    // The thread variant lays the row out as avatar gutter + content column.
    if (variant === 'thread') {
      return (
        <CommentItem key={key}>
          <CommentItemAvatar>{avatar}</CommentItemAvatar>
          <CommentItemContent>
            <CommentItemHeader>
              {name}
              {timestamp}
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
 * Feedback rendered as a comment thread: existing records above, a composer below.
 * Owns nothing but the draft text — pagination and submission are driven by the caller.
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
}: FeedbackThreadProps) {
  const [text, setText] = useState('');
  const sendBlocked = text.trim().length === 0 || isSubmitting;

  const feedbackItems = feedbackData?.feedback ?? [];
  const currentPage = feedbackData?.pagination?.page ?? 0;
  const hasMore = feedbackData?.pagination?.hasMore ?? false;

  return (
    <Comment variant={variant} className="min-h-0 gap-4 px-3">
      <div className="min-h-0 overflow-y-auto">
        {isLoadingFeedbackData ? (
          <Txt variant="ui-md" className="text-neutral3">
            Loading feedback...
          </Txt>
        ) : feedbackItems.length === 0 ? (
          <Txt variant="ui-md" className="text-neutral3">
            No feedback yet
          </Txt>
        ) : (
          <FeedbackItems variant={variant} items={feedbackItems} onDelete={onDelete} isDeleting={isDeleting} />
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
    </Comment>
  );
}
