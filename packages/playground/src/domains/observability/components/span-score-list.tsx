import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { DataList, DataListSkeleton } from '@mastra/playground-ui';
import { format } from 'date-fns';
import { useLinkComponent } from '@/lib/framework';

const traceScoresListColumns = [
  { label: 'ID', size: '1fr' },
  { label: 'Date', size: '1fr' },
  { label: 'Time', size: '1fr' },
  { label: 'Score', size: '1fr' },
  { label: 'Scorer', size: '1fr' },
] as const;

const gridColumns = traceScoresListColumns.map(c => c.size).join(' ');

type SpanScoreListProps = {
  scoresData?: ListScoresResponse | null;
  isLoadingScoresData?: boolean;
  traceId?: string;
  spanId?: string;
  onPageChange?: (page: number) => void;
  computeTraceLink: (traceId: string, spanId?: string) => string;
};

export function SpanScoreList({
  scoresData,
  isLoadingScoresData,
  traceId,
  spanId,
  onPageChange,
  computeTraceLink,
}: SpanScoreListProps) {
  const { navigate } = useLinkComponent();

  const handleOnScore = (scoreId: string) => {
    if (traceId) {
      navigate(`${computeTraceLink(traceId, spanId)}&tab=scores&scoreId=${encodeURIComponent(scoreId)}`);
    }
  };

  if (isLoadingScoresData) {
    return <DataListSkeleton columns={gridColumns} />;
  }

  const scores = scoresData?.scores ?? [];
  const currentPage = scoresData?.pagination?.page ?? 0;

  return (
    <DataList columns={gridColumns}>
      <DataList.Top>
        {traceScoresListColumns.map(col => (
          <DataList.TopCell key={col.label}>{col.label}</DataList.TopCell>
        ))}
      </DataList.Top>

      {scores.length === 0 ? (
        <DataList.NoMatch message="No scores found" />
      ) : (
        scores.map((score: ScoreRowData) => {
          const createdAtDate = new Date(score.createdAt);
          return (
            <DataList.RowButton key={score.id} onClick={() => handleOnScore(score.id)}>
              <DataList.IdCell id={score.id} />
              <DataList.DateCell timestamp={createdAtDate} />
              <DataList.Cell height="compact">{format(createdAtDate, 'h:mm:ss aaa')}</DataList.Cell>
              <DataList.Cell height="compact">{String(score?.score ?? '')}</DataList.Cell>
              <DataList.Cell height="compact">{String(score?.scorer?.name ?? score?.scorer?.id ?? '')}</DataList.Cell>
            </DataList.RowButton>
          );
        })
      )}

      <DataList.Pagination
        currentPage={currentPage}
        hasMore={scoresData?.pagination?.hasMore}
        onNextPage={() => onPageChange?.(currentPage + 1)}
        onPrevPage={() => onPageChange?.(currentPage - 1)}
      />
    </DataList>
  );
}
