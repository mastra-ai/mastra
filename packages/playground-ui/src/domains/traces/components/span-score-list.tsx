import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { isToday, format } from 'date-fns';
import { EntryList, EntryListSkeleton } from '@/ds/components/EntryList';
import { getShortId } from '@/ds/components/Text';

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
  onPageChange?: (page: number) => void;
  onScoreSelect?: (score: ScoreRowData) => void;
};

export function SpanScoreList({ scoresData, isLoadingScoresData, onPageChange, onScoreSelect }: SpanScoreListProps) {
  if (isLoadingScoresData) {
    return <EntryListSkeleton columns={traceScoresListColumns} />;
  }

  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={traceScoresListColumns} />
        {scoresData?.scores && scoresData.scores.length > 0 ? (
          <EntryList.Entries>
            {scoresData?.scores?.map((score: ScoreRowData) => {
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
                  onClick={() => onScoreSelect?.(score)}
                  entry={entry}
                >
                  {traceScoresListColumns.map(col => {
                    const key = `col-${col.name}`;
                    return (
                      <EntryList.EntryText key={key}>
                        {String(entry?.[col.name as keyof typeof entry] ?? '')}
                      </EntryList.EntryText>
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
  );
}
