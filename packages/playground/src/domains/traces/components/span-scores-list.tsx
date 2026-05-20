import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { DataList, DataListSkeleton, getShortId } from '@mastra/playground-ui';
import { isToday, format } from 'date-fns';

const COLUMNS = 'auto auto auto auto 1fr';

type SpanScoresListProps = {
  scoresData?: ListScoresResponse | null;
  isLoadingScoresData?: boolean;
  onPageChange?: (page: number) => void;
  onScoreSelect?: (score: ScoreRowData) => void;
};

export function SpanScoresList({ scoresData, isLoadingScoresData, onPageChange, onScoreSelect }: SpanScoresListProps) {
  if (isLoadingScoresData) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  return (
    <div className="grid gap-2">
      <DataList columns={COLUMNS} className="min-w-0">
        <DataList.Top>
          <DataList.TopCell>ID</DataList.TopCell>
          <DataList.TopCell>Date</DataList.TopCell>
          <DataList.TopCell>Time</DataList.TopCell>
          <DataList.TopCell>Score</DataList.TopCell>
          <DataList.TopCell>Scorer</DataList.TopCell>
        </DataList.Top>

        {scoresData?.scores && scoresData.scores.length > 0 ? (
          scoresData.scores.map((score: ScoreRowData) => {
            const createdAtDate = new Date(score.createdAt);
            const isTodayDate = isToday(createdAtDate);

            return (
              <DataList.RowButton key={score.id} onClick={() => onScoreSelect?.(score)}>
                <DataList.Cell height="compact" className="font-mono text-neutral3 text-ui-smd">
                  {getShortId(score?.id) || 'n/a'}
                </DataList.Cell>
                <DataList.Cell height="compact" className="text-neutral2 text-ui-smd">
                  {isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd')}
                </DataList.Cell>
                <DataList.Cell height="compact" className="font-mono text-neutral3 text-ui-smd">
                  {format(createdAtDate, 'h:mm:ss aaa')}
                </DataList.Cell>
                <DataList.Cell height="compact" className="text-ui-smd">
                  {String(score?.score ?? '')}
                </DataList.Cell>
                <DataList.Cell height="compact" className="text-ui-smd">
                  {String(score?.scorer?.name || score?.scorer?.id || '')}
                </DataList.Cell>
              </DataList.RowButton>
            );
          })
        ) : (
          <DataList.NoMatch message="No scores found" />
        )}
      </DataList>

      <DataList.Pagination
        currentPage={scoresData?.pagination?.page || 0}
        hasMore={scoresData?.pagination?.hasMore}
        onNextPage={() => onPageChange?.((scoresData?.pagination?.page || 0) + 1)}
        onPrevPage={() => onPageChange?.((scoresData?.pagination?.page || 0) - 1)}
      />
    </div>
  );
}
