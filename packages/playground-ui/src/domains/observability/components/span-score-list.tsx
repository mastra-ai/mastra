import { Table, Thead, Th, Tbody, Row, TxtCell, Cell } from '@/ds/components/Table';
import { Skeleton } from '@/ds/components/Skeleton';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { getShortId } from '@/ds/components/Text';
import { ScoreDialog } from '@/domains/scores';
import { useLinkComponent } from '@/lib/framework';
import { Icon } from '@/ds/icons';
import { getToNextEntryFn, getToPreviousEntryFn } from '../helpers';
import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { isToday, format } from 'date-fns';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, GaugeIcon } from 'lucide-react';

export const traceScoresListColumns = [
  { name: 'shortId', label: 'ID', width: undefined },
  { name: 'date', label: 'Date', width: undefined },
  { name: 'time', label: 'Time', width: undefined },
  { name: 'score', label: 'Score', width: undefined },
  { name: 'scorer', label: 'Scorer', width: undefined },
];

export type SpanScoreListProps = {
  scoresData?: ListScoresResponse | null;
  isLoadingScoresData?: boolean;
  initialScoreId?: string;
  traceId?: string;
  spanId?: string;
  onPageChange?: (page: number) => void;
  computeTraceLink: (traceId: string, spanId?: string) => string;
};

type SelectedScore = ScoreRowData | undefined;

export function SpanScoreListSkeleton() {
  return (
    <div className="rounded-lg border border-border1 overflow-clip">
      <Table>
        <Thead>
          {traceScoresListColumns.map(col => (
            <Th key={col.name} style={{ width: col.width }}>
              {col.label}
            </Th>
          ))}
        </Thead>
        <Tbody>
          {Array.from({ length: 3 }).map((_, index) => (
            <Row key={index}>
              <Cell>
                <Skeleton className="h-4 w-full" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-full" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-full" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-8" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-full" />
              </Cell>
            </Row>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

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
    const score = scoresData?.scores?.find((s: ScoreRowData) => s?.id === scoreId);
    setSelectedScore(score);
    setDialogIsOpen(true);
  };

  if (isLoadingScoresData) {
    return <SpanScoreListSkeleton />;
  }

  const updateSelectedScore = (scoreId: string) => {
    const score = scoresData?.scores?.find((s: ScoreRowData) => s?.id === scoreId);
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

  const scores = scoresData?.scores || [];
  const pagination = scoresData?.pagination;
  const hasMore = pagination?.hasMore;
  const currentPage = pagination?.page || 0;

  const handleNextPage = () => {
    if (hasMore) {
      onPageChange?.(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      onPageChange?.(currentPage - 1);
    }
  };

  if (scores.length === 0) {
    return (
      <div className="flex h-full items-center justify-center py-8">
        <EmptyState
          iconSlot={<GaugeIcon className="h-8 w-8 text-neutral3" />}
          titleSlot="No Scores"
          descriptionSlot="No scores found"
        />
      </div>
    );
  }

  return (
    <>
      <div>
        <div className="rounded-lg border border-border1 overflow-clip">
          <Table>
            <Thead>
              {traceScoresListColumns.map(col => (
                <Th key={col.name} style={{ width: col.width }}>
                  {col.label}
                </Th>
              ))}
            </Thead>
            <Tbody>
              {scores.map((score: ScoreRowData) => {
                const createdAtDate = new Date(score.createdAt);
                const isTodayDate = isToday(createdAtDate);

                return (
                  <Row key={score.id} onClick={() => handleOnScore(score.id)}>
                    <TxtCell>{getShortId(score?.id) || 'n/a'}</TxtCell>
                    <TxtCell>{isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd')}</TxtCell>
                    <TxtCell>{format(createdAtDate, 'h:mm:ss aaa')}</TxtCell>
                    <TxtCell>{String(score?.score ?? '')}</TxtCell>
                    <TxtCell>{String(score?.scorer?.name || score?.scorer?.id || '')}</TxtCell>
                  </Row>
                );
              })}
            </Tbody>
          </Table>
        </div>
        {(pagination?.page !== undefined || hasMore) && (
          <div className="flex pt-6 items-center justify-center text-neutral3 text-ui-md gap-8">
            <span>
              Page <b>{currentPage + 1}</b>
            </span>
            <div className="flex gap-4">
              {currentPage > 0 && (
                <Button variant="outline" size="sm" onClick={handlePrevPage}>
                  <Icon>
                    <ArrowLeftIcon />
                  </Icon>
                  Previous
                </Button>
              )}
              {hasMore && (
                <Button variant="outline" size="sm" onClick={handleNextPage}>
                  Next
                  <Icon>
                    <ArrowRightIcon />
                  </Icon>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <ScoreDialog
        scorerName={(selectedScore?.scorer?.name as string) || (selectedScore?.scorer?.id as string) || ''}
        score={selectedScore as ScoreRowData}
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
