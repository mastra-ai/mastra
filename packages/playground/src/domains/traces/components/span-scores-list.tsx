import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { DataList, DataListSkeleton, useDataListKeyboard } from '@mastra/playground-ui/components/DataList';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { isToday, format } from 'date-fns';
import { CircleGaugeIcon } from 'lucide-react';

const COLUMNS = 'auto auto auto auto 1fr';

type SpanScoresListProps = {
  scoresData?: ListScoresResponse | null;
  isLoadingScoresData?: boolean;
  onPageChange?: (page: number) => void;
  onScoreSelect?: (score: ScoreRowData) => void;
};

export function SpanScoresList({ scoresData, isLoadingScoresData, onPageChange, onScoreSelect }: SpanScoresListProps) {
  const { containerRef, getRowProps } = useDataListKeyboard({ count: scoresData?.scores?.length ?? 0 });

  if (isLoadingScoresData) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  if (!scoresData?.scores || scoresData.scores.length === 0) {
    return (
      <EmptyState
        iconSlot={<CircleGaugeIcon />}
        titleSlot="No scores yet"
        descriptionSlot="Score this trace to see results here."
      />
    );
  }

  return (
    <div className="grid gap-2">
      <DataList columns={COLUMNS} className="min-w-0" scrollRef={containerRef}>
        <DataList.Top>
          <DataList.TopCell>ID</DataList.TopCell>
          <DataList.TopCell>Date</DataList.TopCell>
          <DataList.TopCell>Time</DataList.TopCell>
          <DataList.TopCell>Score</DataList.TopCell>
          <DataList.TopCell>Scorer</DataList.TopCell>
        </DataList.Top>

        {scoresData.scores.map((score: ScoreRowData, index) => {
          const createdAtDate = new Date(score.createdAt);
          const isTodayDate = isToday(createdAtDate);

          return (
            <DataList.RowButton key={score.id} onClick={() => onScoreSelect?.(score)} {...getRowProps(index)}>
              <DataList.Cell className="text-neutral3 text-ui-smd font-mono">
                {getShortId(score?.id) || 'n/a'}
              </DataList.Cell>
              <DataList.Cell className="text-neutral2 text-ui-smd">
                {isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd')}
              </DataList.Cell>
              <DataList.Cell className="text-neutral3 text-ui-smd font-mono">
                {format(createdAtDate, 'h:mm:ss aaa')}
              </DataList.Cell>
              <DataList.Cell className="text-ui-smd">{String(score?.score ?? '')}</DataList.Cell>
              <DataList.Cell className="text-ui-smd">
                {String(score?.scorer?.name || score?.scorer?.id || '')}
              </DataList.Cell>
            </DataList.RowButton>
          );
        })}
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
