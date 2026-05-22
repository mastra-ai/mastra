import type { FeedbackRecord, ListFeedbackResponse } from '@mastra/core/storage';
import { DataList, DataListSkeleton } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { useState } from 'react';
import { FeedbackDialog } from './feedback-dialog';

const feedbackListColumns = [
  { label: 'Source', size: '1fr' },
  { label: 'Date', size: '0.8fr' },
  { label: 'Time', size: '0.8fr' },
  { label: 'Value', size: '0.6fr' },
  { label: 'Comment', size: '2fr' },
] as const;

const gridColumns = feedbackListColumns.map(c => c.size).join(' ');

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

  if (isLoadingFeedbackData) {
    return <DataListSkeleton columns={gridColumns} />;
  }

  const feedbackItems = feedbackData?.feedback ?? [];
  const currentPage = feedbackData?.pagination?.page ?? 0;

  const handleOnFeedback = (index: number) => {
    setSelectedFeedback(feedbackItems[index]);
    setDialogIsOpen(true);
  };

  const selectedIndex = selectedFeedback ? feedbackItems.indexOf(selectedFeedback) : -1;
  const toNext =
    selectedIndex >= 0 && selectedIndex < feedbackItems.length - 1
      ? () => setSelectedFeedback(feedbackItems[selectedIndex + 1])
      : undefined;
  const toPrevious = selectedIndex > 0 ? () => setSelectedFeedback(feedbackItems[selectedIndex - 1]) : undefined;

  return (
    <>
      <DataList columns={gridColumns}>
        <DataList.Top>
          {feedbackListColumns.map(col => (
            <DataList.TopCell key={col.label}>{col.label}</DataList.TopCell>
          ))}
        </DataList.Top>

        {feedbackItems.length === 0 ? (
          <DataList.NoMatch message="No feedback found" />
        ) : (
          feedbackItems.map((fb, index) => {
            const ts = new Date(fb.timestamp);
            const source = fb.feedbackUserId || fb.feedbackSource || 'unknown';
            return (
              <DataList.RowButton key={`${fb.traceId}-${index}`} onClick={() => handleOnFeedback(index)}>
                <DataList.Cell height="compact">{source}</DataList.Cell>
                <DataList.DateCell timestamp={ts} />
                <DataList.Cell height="compact">{format(ts, 'h:mm:ss aaa')}</DataList.Cell>
                <DataList.Cell height="compact">{formatValue(fb)}</DataList.Cell>
                <DataList.Cell height="compact">{formatComment(fb)}</DataList.Cell>
              </DataList.RowButton>
            );
          })
        )}

        <DataList.Pagination
          currentPage={currentPage}
          hasMore={feedbackData?.pagination?.hasMore}
          onNextPage={() => onPageChange?.(currentPage + 1)}
          onPrevPage={() => {
            if (currentPage > 0) onPageChange?.(currentPage - 1);
          }}
        />
      </DataList>
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
