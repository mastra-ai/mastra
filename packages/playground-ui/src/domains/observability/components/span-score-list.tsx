import {
  EntryList,
  EntryListSkeleton,
  getShortId,
  getToNextEntryFn,
  getToPreviousEntryFn,
} from '@/components/ui/elements';
import { ScoreDialog } from '@/domains/scores';
import { useLinkComponent } from '@/lib/framework';
import { ClientScoreRowData, ListScoresResponse } from '@mastra/client-js';
import { isToday, format } from 'date-fns';
import { useEffect, useState } from 'react';

export const traceScoresListColumns = [
  { name: 'shortId', label: 'ID', size: '1fr' },
  { name: 'date', label: 'Date', size: '1fr' },
  { name: 'time', label: 'Time', size: '1fr' },
  { name: 'score', label: 'Score', size: '1fr' },
  { name: 'scorer', label: 'Scorer', size: '1fr' },
];

type SpanScoreListProps = {
  scoresData?: ListScoresResponse | null;
  isLoadingScoresData?: boolean;
  initialScoreId?: string;
  traceId?: string;
  spanId?: string;
  onPageChange?: (page: number) => void;
  computeTraceLink: (traceId: string, spanId?: string) => string;
};

type SelectedScore = ClientScoreRowData | undefined;

export function SpanScoreList({
  scoresData,
  isLoadingScoresData,
  traceId,
  spanId,
  initialScoreId,
  onPageChange,
  computeTraceLink,
}: SpanScoreListProps) {
  const { navigate } = useLinkComponent();
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedScore, setSelectedScore] = useState<SelectedScore | undefined>();

  useEffect(() => {
    if (initialScoreId) {
      handleOnScore(initialScoreId);
    }
  }, [initialScoreId]);

  const handleOnScore = (scoreId: string) => {
    const score = scoresData?.scores?.find(s => s?.id === scoreId);
    setSelectedScore(score);
    setDialogIsOpen(true);
  };

  if (isLoadingScoresData) {
    return <EntryListSkeleton columns={traceScoresListColumns} />;
  }

  const updateSelectedScore = (scoreId: string) => {
    const score = scoresData?.scores?.find(s => s?.id === scoreId);
    setSelectedScore(score);
  };

  const toNextScore = getToNextEntryFn({
    entries: scoresData?.scores || [],
    id: selectedScore?.id,
    update: updateSelectedScore,
  });

  const toPreviousScore = getToPreviousEntryFn({
    entries: scoresData?.scores || [],
    id: selectedScore?.id,
    update: updateSelectedScore,
  });

  return (
    <>
      <EntryList>
        <EntryList.Trim>
          <EntryList.Header columns={traceScoresListColumns} />
          {scoresData?.scores && scoresData.scores.length > 0 ? (
            <EntryList.Entries>
              {scoresData?.scores?.map(score => {
                const createdAtDate = new Date(score.createdAt);
                const isTodayDate = isToday(createdAtDate);

                const entry = {
                  id: score?.id,
                  shortId: getShortId(score?.id) || 'n/a',
                  date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
                  time: format(createdAtDate, 'h:mm:ss aaa'),
                  score: score?.score,
                  scorer: score?.scorer?.name || score?.scorer?.id,
                };

                return (
                  <EntryList.Entry
                    key={score.id}
                    columns={traceScoresListColumns}
                    onClick={() => handleOnScore(score.id)}
                    entry={entry}
                  >
                    {traceScoresListColumns.map(col => {
                      const key = `col-${col.name}`;
                      return (
                        <EntryList.EntryText key={key}>{entry?.[col.name as keyof typeof entry]}</EntryList.EntryText>
                      );
                    })}
                  </EntryList.Entry>
                );
              })}
            </EntryList.Entries>
          ) : (
            <EntryList.Message message="No scores found" type="info" />
          )}
        </EntryList.Trim>
        <EntryList.Pagination
          currentPage={scoresData?.pagination?.page || 0}
          hasMore={scoresData?.pagination?.hasMore}
          onNextPage={() => onPageChange && onPageChange((scoresData?.pagination?.page || 0) + 1)}
          onPrevPage={() => onPageChange && onPageChange((scoresData?.pagination?.page || 0) - 1)}
        />
      </EntryList>
      <ScoreDialog
        scorerName={selectedScore?.scorer?.name || selectedScore?.scorer?.id || ''}
        score={selectedScore as ClientScoreRowData}
        isOpen={dialogIsOpen}
        onClose={() => {
          if (traceId) {
            navigate(`${computeTraceLink(traceId, spanId)}&tab=scores`);
          }
          setDialogIsOpen(false);
        }}
        dialogLevel={3}
        onNext={toNextScore}
        onPrevious={toPreviousScore}
        computeTraceLink={(traceId, spanId) => `/observability?traceId=${traceId}${spanId ? `&spanId=${spanId}` : ''}`}
        usageContext="SpanDialog"
      />
    </>
  );
}
