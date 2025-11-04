import { ClientScoreRowData } from '@mastra/client-js';
import { EntryList } from '@/components/ui/elements';
import { format, isToday } from 'date-fns';

export const scoresListColumns = [
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'input', label: 'Input', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'score', label: 'Score', size: '3rem' },
];

type ScoresListProps = {
  selectedScoreId?: string;
  onScoreClick?: (id: string) => void;
  scores?: ClientScoreRowData[];
  pagination?: {
    total: number;
    hasMore: boolean;
    perPage: number;
    page: number;
  };
  onPageChange?: (page: number) => void;
  errorMsg?: string;
};

export function ScoresList({
  scores,
  pagination,
  onScoreClick,
  onPageChange,
  errorMsg,
  selectedScoreId,
}: ScoresListProps) {
  if (!scores) {
    return null;
  }

  const scoresHasMore = pagination?.hasMore;

  const handleNextPage = () => {
    if (scoresHasMore) {
      onPageChange?.(pagination.page + 1);
    }
  };

  const handlePrevPage = () => {
    if (pagination?.page && pagination.page > 0) {
      onPageChange?.(pagination.page - 1);
    }
  };

  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={scoresListColumns} />
        {errorMsg ? (
          <EntryList.Message message={errorMsg} type="error" />
        ) : (
          <>
            {scores.length > 0 ? (
              <EntryList.Entries>
                {scores.map(score => {
                  const createdAtDate = new Date(score.createdAt);
                  const isTodayDate = isToday(createdAtDate);

                  const entry = {
                    id: score.id,
                    date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
                    time: format(createdAtDate, 'h:mm:ss aaa'),
                    input: JSON.stringify(score?.input),
                    entityId: score.entityId,
                    score: score.score,
                  };

                  return (
                    <EntryList.Entry
                      key={entry.id}
                      entry={entry}
                      isSelected={selectedScoreId === score.id}
                      columns={scoresListColumns}
                      onClick={onScoreClick}
                    >
                      {scoresListColumns.map((col, index) => {
                        const key = `${index}-${score.id}`;
                        return (
                          <EntryList.EntryText key={key}>{entry?.[col.name as keyof typeof entry]}</EntryList.EntryText>
                        );
                      })}
                    </EntryList.Entry>
                  );
                })}
              </EntryList.Entries>
            ) : (
              <EntryList.Message message="No scores for this scorer yet" />
            )}
          </>
        )}
      </EntryList.Trim>
      <EntryList.Pagination
        currentPage={pagination?.page || 0}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
        hasMore={scoresHasMore}
      />
    </EntryList>
  );
}
