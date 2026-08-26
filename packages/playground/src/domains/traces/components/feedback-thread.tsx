import type { FeedbackRecord, ListFeedbackResponse } from '@mastra/core/storage';
import { Button } from '@mastra/playground-ui/components/Button';
import {
  Comment,
  CommentComposer,
  CommentComposerInput,
  CommentComposerSend,
  CommentItem,
  CommentItemBody,
  CommentItemHeader,
  CommentItemTimestamp,
  CommentList,
} from '@mastra/playground-ui/components/Comment';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { format } from 'date-fns';
import { useState } from 'react';

type FeedbackThreadProps = {
  feedbackData?: ListFeedbackResponse | null;
  isLoadingFeedbackData?: boolean;
  onPageChange?: (page: number) => void;
  /** Rejecting (or throwing) keeps the draft in the composer so it can be retried. */
  onSubmit: (text: string) => void | Promise<unknown>;
  isSubmitting?: boolean;
};

function formatBody(fb: FeedbackRecord): string {
  const text = fb.comment || (typeof fb.value === 'string' ? fb.value : '');
  if (text) return text;
  if (fb.feedbackType === 'thumbs') return fb.value === 1 ? '\u{1F44D}' : '\u{1F44E}';
  return String(fb.value ?? '');
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
}: FeedbackThreadProps) {
  const [text, setText] = useState('');
  const sendBlocked = text.trim().length === 0 || isSubmitting;

  const feedbackItems = feedbackData?.feedback ?? [];
  const currentPage = feedbackData?.pagination?.page ?? 0;
  const hasMore = feedbackData?.pagination?.hasMore ?? false;

  return (
    <Comment className="min-h-0 gap-4 px-3">
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
          <CommentList>
            {feedbackItems.map((fb, index) => {
              const ts = new Date(fb.timestamp);
              return (
                <CommentItem key={`${fb.traceId}-${index}`}>
                  <CommentItemHeader>
                    <CommentItemTimestamp dateTime={ts.toISOString()}>
                      {format(ts, 'MMM d, h:mm:ss aaa')}
                    </CommentItemTimestamp>
                  </CommentItemHeader>
                  <CommentItemBody>{formatBody(fb)}</CommentItemBody>
                </CommentItem>
              );
            })}
          </CommentList>
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
