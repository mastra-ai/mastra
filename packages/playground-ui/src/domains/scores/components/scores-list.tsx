import { ClientScoreRowData } from '@mastra/client-js';
import { Table, Thead, Th, Tbody, Row, TxtCell, Cell } from '@/ds/components/Table';
import { Skeleton } from '@/ds/components/Skeleton';
import { EmptyState } from '@/ds/components/EmptyState';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { ArrowLeftIcon, ArrowRightIcon, GaugeIcon } from 'lucide-react';
import { format, isToday } from 'date-fns';

export const scoresListColumns = [
  { name: 'date', label: 'Date', width: '4.5rem' },
  { name: 'time', label: 'Time', width: '6.5rem' },
  { name: 'input', label: 'Input', width: undefined },
  { name: 'entityId', label: 'Entity', width: '10rem' },
  { name: 'score', label: 'Score', width: '3rem' },
];

export type ScoresListProps = {
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

export function ScoresListSkeleton() {
  return (
    <div className="rounded-lg border border-border1 overflow-clip">
      <Table>
        <Thead>
          {scoresListColumns.map(col => (
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
                <Skeleton className="h-4 w-1/2" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-full" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-8" />
              </Cell>
            </Row>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

export function EmptyScoresList() {
  return (
    <div className="flex h-full items-center justify-center">
      <EmptyState
        iconSlot={<GaugeIcon className="h-8 w-8 text-neutral3" />}
        titleSlot="No Scores"
        descriptionSlot="No scores for this scorer yet."
      />
    </div>
  );
}

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

  if (errorMsg) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<GaugeIcon className="h-8 w-8 text-red-500" />}
          titleSlot="Error"
          descriptionSlot={errorMsg}
        />
      </div>
    );
  }

  if (scores.length === 0) {
    return <EmptyScoresList />;
  }

  return (
    <div>
      <div className="rounded-lg border border-border1 overflow-clip">
        <Table>
          <Thead>
            {scoresListColumns.map(col => (
              <Th key={col.name} style={{ width: col.width }}>
                {col.label}
              </Th>
            ))}
          </Thead>
          <Tbody>
            {scores.map(score => {
              const createdAtDate = new Date(score.createdAt);
              const isTodayDate = isToday(createdAtDate);

              return (
                <Row key={score.id} onClick={() => onScoreClick?.(score.id)} selected={selectedScoreId === score.id}>
                  <TxtCell>{isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd')}</TxtCell>
                  <TxtCell>{format(createdAtDate, 'h:mm:ss aaa')}</TxtCell>
                  <TxtCell>{JSON.stringify(score?.input)}</TxtCell>
                  <TxtCell>{score.entityId}</TxtCell>
                  <TxtCell>{score.score}</TxtCell>
                </Row>
              );
            })}
          </Tbody>
        </Table>
      </div>
      {(pagination?.page !== undefined || scoresHasMore) && (
        <div className="flex pt-6 items-center justify-center text-neutral3 text-ui-md gap-8">
          <span>
            Page <b>{(pagination?.page || 0) + 1}</b>
          </span>
          <div className="flex gap-4">
            {(pagination?.page || 0) > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrevPage}>
                <Icon>
                  <ArrowLeftIcon />
                </Icon>
                Previous
              </Button>
            )}
            {scoresHasMore && (
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
  );
}
