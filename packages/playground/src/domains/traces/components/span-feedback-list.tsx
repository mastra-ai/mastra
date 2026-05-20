import type { FeedbackRecord, ListFeedbackResponse } from '@mastra/core/storage';
import { EntryList, EntryListSkeleton } from '@mastra/playground-ui';
import { isToday, format } from 'date-fns';
import { useState } from 'react';
import { FeedbackDialog } from './feedback-dialog';

const feedbackListColumns = [
  { name: 'source', label: 'Source', size: '1fr' },
  { name: 'date', label: 'Date', size: '0.8fr' },
  { name: 'time', label: 'Time', size: '0.8fr' },
  { name: 'value', label: 'Value', size: '0.6fr' },
  { name: 'comment', label: 'Comment', size: '2fr' },
];

type SpanFeedbackListProps = {
  feedbackData?: ListFeedbackResponse | null;
  isLoadingFeedbackData?: boolean;
  onPageChange?: (page: number) => void;
};

function formatValue(fb: FeedbackRecord): string {
  if (fb.feedbackType === 'thumbs') {
    if (fb.value === 1) return '\u{1F44D}';
    if (fb.value === 0 || fb.value === -1) return '\u{1F44E}';
    return String(fb.value);
  }
  if (typeof fb.value === 'number') {
    return String(fb.value);
  }
  // text-only feedback (comment, correction) — value shown in comment column
  return '—';
}

function formatComment(fb: FeedbackRecord): string {
  // For text-type feedback, the value IS the comment
  const text = fb.comment || (typeof fb.value === 'string' ? fb.value : '');
  if (!text) return '—';
  return text.length > 60 ? text.slice(0, 60) + '…' : text;
}

export function SpanFeedbackList({ feedbackData, isLoadingFeedbackData, onPageChange }: SpanFeedbackListProps) {
  const [dialogIsOpen, setDialogIsOpen] = useState(false);
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackRecord | undefined>();

  const feedbackItems = feedbackData?.feedback ?? [];

  const handleOnFeedback = (index: number) => {
    setSelectedFeedback(feedbackItems[index]);
    setDialogIsOpen(true);
  };

  if (isLoadingFeedbackData) {
    return <EntryListSkeleton columns={feedbackListColumns} />;
  }

  const selectedIndex = selectedFeedback ? feedbackItems.indexOf(selectedFeedback) : -1;

  const toNext =
    selectedIndex >= 0 && selectedIndex < feedbackItems.length - 1
      ? () => setSelectedFeedback(feedbackItems[selectedIndex + 1])
      : undefined;

  const toPrevious = selectedIndex > 0 ? () => setSelectedFeedback(feedbackItems[selectedIndex - 1]) : undefined;

  return (
    <>
      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={feedbackListColumns} />
          {feedbackItems.length > 0 ? (
            <EntryList.Entries>
              {feedbackItems.map((fb, index) => {
                const ts = new Date(fb.timestamp);
                const isTodayDate = isToday(ts);

                const entry = {
                  id: `${fb.traceId}-${index}`,
                  source: fb.feedbackUserId || fb.feedbackSource || 'unknown',
                  date: isTodayDate ? 'Today' : format(ts, 'MMM dd'),
                  time: format(ts, 'h:mm:ss aaa'),
                  value: formatValue(fb),
                  comment: formatComment(fb),
                };

                return (
                  <EntryList.Entry
                    key={entry.id}
                    columns={feedbackListColumns}
                    onClick={() => handleOnFeedback(index)}
                    entry={entry}
                  >
                    {feedbackListColumns.map(col => (
                      <EntryList.EntryText key={`col-${col.name}`}>
                        {String(entry[col.name as keyof typeof entry] ?? '')}
                      </EntryList.EntryText>
                    ))}
                  </EntryList.Entry>
                );
              })}
            </EntryList.Entries>
          ) : (
            <EntryList.Message message="No feedback found" type="info" />
          )}
        </EntryList.Trim>
        <EntryList.Pagination
          currentPage={feedbackData?.pagination?.page || 0}
          hasMore={feedbackData?.pagination?.hasMore}
          onNextPage={() => onPageChange?.((feedbackData?.pagination?.page || 0) + 1)}
          onPrevPage={() => {
            const currentPage = feedbackData?.pagination?.page || 0;
            if (currentPage > 0) onPageChange?.(currentPage - 1);
          }}
        />
      </EntryList>
      <FeedbackDialog
        feedback={selectedFeedback}
        isOpen={dialogIsOpen}
        onClose={() => setDialogIsOpen(false)}
        onNext={toNext}
        onPrevious={toPrevious}
      />
    </>
  );
}
