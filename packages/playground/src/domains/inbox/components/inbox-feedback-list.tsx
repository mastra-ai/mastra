import type { FeedbackRecord } from '@mastra/core/storage';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { ListSearch } from '@mastra/playground-ui/components/ListSearch';
import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';

const COLUMNS = 'minmax(0, 2fr) auto minmax(0, 1fr) auto auto';
import { feedbackDisplayValue } from '@/domains/inbox/utils/feedback-display-value';

export interface InboxFeedbackListProps {
  items: FeedbackRecord[];
  isLoading: boolean;
  error?: Error;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  onMarkReviewed: (feedbackId: string) => void;
  pendingFeedbackId?: string;
  /** Opens the trace side panel for the row's feedback. */
  onSelect: (feedback: FeedbackRecord) => void;
  selectedFeedbackId?: string;
}

export function InboxFeedbackList({
  items,
  isLoading,
  error,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  onMarkReviewed,
  pendingFeedbackId,
  onSelect,
  selectedFeedbackId,
}: InboxFeedbackListProps) {
  const [search, setSearch] = useState('');
  const term = search.trim().toLowerCase();
  const filtered = term
    ? items.filter(
        feedback =>
          feedbackDisplayValue(feedback).toLowerCase().includes(term) ||
          (feedback.traceId ?? '').toLowerCase().includes(term) ||
          (feedback.feedbackSource ?? '').toLowerCase().includes(term),
      )
    : items;

  const { containerRef, getRowProps } = useDataListKeyboard({ count: filtered.length });
  // The sentinel observes the list's own scroll viewport, not the window.
  const { inView, setRef: setEndOfListElement } = useInView({ root: containerRef });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  if (error) {
    return <ErrorState title="Failed to load feedback" message={error.message} />;
  }

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_1fr] gap-4">
      <div className="max-w-120">
        <ListSearch
          onSearch={setSearch}
          label="Filter feedback"
          placeholder="Filter loaded feedback by text, trace or source"
        />
      </div>

      <div className="min-h-0 overflow-hidden">
        <DataList columns={COLUMNS} fit="container" scrollRef={containerRef}>
          <DataList.Top>
            <DataList.TopCell>Feedback</DataList.TopCell>
            <DataList.TopCell>Source</DataList.TopCell>
            <DataList.TopCell>Trace</DataList.TopCell>
            <DataList.TopCell>Date</DataList.TopCell>
            <DataList.TopCell>&nbsp;</DataList.TopCell>
          </DataList.Top>

          {filtered.length === 0 ? (
            <DataList.NoMatch message={term ? 'No feedback matches your search' : 'No feedback needs review'} />
          ) : (
            filtered.map((feedback, index) => {
              const feedbackId = feedback.feedbackId;

              return (
                <DataList.RowWrapper key={feedbackId ?? `${String(feedback.timestamp)}-${feedback.traceId}`}>
                  <DataList.RowButton
                    colEnd={-2}
                    disabled={!feedback.traceId}
                    featured={feedbackId !== undefined && feedbackId === selectedFeedbackId}
                    onClick={() => onSelect(feedback)}
                    {...getRowProps(index)}
                  >
                    <DataList.TextCell className="min-w-0">
                      <span className="block truncate">{feedbackDisplayValue(feedback)}</span>
                    </DataList.TextCell>
                    <DataList.Cell>
                      <Badge size="sm">{feedback.feedbackSource}</Badge>
                    </DataList.Cell>
                    <DataList.TextCell font="mono" className="min-w-0">
                      <span className="block truncate">{feedback.traceId ?? '—'}</span>
                    </DataList.TextCell>
                    <DataList.TextCell>{format(feedback.timestamp, 'MMM d, h:mm a')}</DataList.TextCell>
                  </DataList.RowButton>
                  <DataList.ActionsCell className="pl-2">
                    {feedbackId ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onMarkReviewed(feedbackId)}
                        disabled={pendingFeedbackId === feedbackId}
                      >
                        Mark reviewed
                      </Button>
                    ) : null}
                  </DataList.ActionsCell>
                </DataList.RowWrapper>
              );
            })
          )}

          <DataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </DataList>
      </div>
    </div>
  );
}
