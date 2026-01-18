import { Cell, DateTimeCell, Row, Table, Tbody, Th, Thead, TxtCell } from '@/ds/components/Table';
import { EmptyState } from '@/ds/components/EmptyState';
import { getShortId } from '@/ds/components/Text';
import { ScoreDialog } from '@/domains/scores';
import { useLinkComponent } from '@/lib/framework';
import type { ListScoresResponse, ScoreRowData } from '@mastra/core/evals';
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import React, { useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { ScrollableContainer } from '@/ds/components/ScrollableContainer';
import { CircleGaugeIcon } from 'lucide-react';

// Helper functions for navigation
function getToNextEntryFn({
  entries,
  id,
  update,
}: {
  entries: { id: string }[];
  id: string | undefined;
  update: (id: string) => void;
}) {
  const currentIndex = entries.findIndex(entry => entry.id === id);
  const thereIsNextItem = currentIndex < entries.length - 1;

  if (thereIsNextItem) {
    return () => {
      const nextItem = entries[currentIndex + 1];
      update(nextItem.id);
    };
  }

  return undefined;
}

function getToPreviousEntryFn({
  entries,
  id,
  update,
}: {
  entries: { id: string }[];
  id: string | undefined;
  update: (id: string) => void;
}) {
  const currentIndex = entries.findIndex(entry => entry.id === id);
  const thereIsPreviousItem = currentIndex > 0;

  if (thereIsPreviousItem) {
    return () => {
      const previousItem = entries[currentIndex - 1];
      update(previousItem.id);
    };
  }

  return undefined;
}

type SpanScoreTableData = ScoreRowData & {
  shortId: string;
  scorerName: string;
};

type SpanScoreTableProps = {
  scoresData?: ListScoresResponse | null;
  isLoadingScoresData?: boolean;
  initialScoreId?: string;
  traceId?: string;
  spanId?: string;
  onPageChange?: (page: number) => void;
  computeTraceLink: (traceId: string, spanId?: string) => string;
};

type SelectedScore = ScoreRowData | undefined;

const columns: ColumnDef<SpanScoreTableData>[] = [
  {
    header: 'ID',
    accessorKey: 'shortId',
    cell: ({ row }) => <TxtCell>{row.original.shortId}</TxtCell>,
  },
  {
    header: 'Date/Time',
    accessorKey: 'createdAt',
    cell: ({ row }) => <DateTimeCell dateTime={new Date(row.original.createdAt)} />,
  },
  {
    header: 'Score',
    accessorKey: 'score',
    cell: ({ row }) => <TxtCell>{String(row.original.score ?? '')}</TxtCell>,
  },
  {
    header: 'Scorer',
    accessorKey: 'scorerName',
    cell: ({ row }) => <TxtCell>{row.original.scorerName}</TxtCell>,
  },
];

export function SpanScoreTable({
  scoresData,
  isLoadingScoresData,
  traceId,
  spanId,
  initialScoreId,
  onPageChange,
  computeTraceLink,
}: SpanScoreTableProps) {
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

  const tableData: SpanScoreTableData[] = useMemo(
    () =>
      (scoresData?.scores || []).map((score: ScoreRowData) => ({
        ...score,
        shortId: getShortId(score?.id) || 'n/a',
        scorerName: String(score?.scorer?.name || score?.scorer?.id || ''),
      })),
    [scoresData?.scores],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const ths = table.getHeaderGroups()[0];
  const rows = table.getRowModel().rows;

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

  if (isLoadingScoresData) {
    return <SpanScoreTableSkeleton />;
  }

  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <EmptyState
          iconSlot={<CircleGaugeIcon />}
          titleSlot="No scores found"
          descriptionSlot="No scores have been recorded for this span yet."
          actionSlot={null}
        />
      </div>
    );
  }

  const pagination = scoresData?.pagination;
  const hasMore = pagination?.hasMore;
  const currentPage = pagination?.page || 0;

  return (
    <>
      <div>
        <ScrollableContainer>
          <Table size="small">
            <Thead className="sticky top-0">
              {ths.headers.map(header => (
                <Th key={header.id} style={{ width: header.column.getSize() ?? 'auto' }}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </Th>
              ))}
            </Thead>
            <Tbody>
              {rows.map(row => (
                <Row key={row.id} onClick={() => handleOnScore(row.original.id)}>
                  {row.getVisibleCells().map(cell => (
                    <React.Fragment key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </React.Fragment>
                  ))}
                </Row>
              ))}
            </Tbody>
          </Table>
        </ScrollableContainer>
        {onPageChange && pagination && (
          <div className="flex justify-center gap-4 mt-4">
            <button
              className="text-ui-sm text-neutral4 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              ← Previous
            </button>
            <span className="text-ui-sm text-neutral3">Page {currentPage + 1}</span>
            <button
              className="text-ui-sm text-neutral4 hover:text-neutral6 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!hasMore}
            >
              Next →
            </button>
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

const SpanScoreTableSkeleton = () => (
  <Table size="small">
    <Thead>
      <Th>ID</Th>
      <Th>Date/Time</Th>
      <Th>Score</Th>
      <Th>Scorer</Th>
    </Thead>
    <Tbody>
      {Array.from({ length: 3 }).map((_, index) => (
        <Row key={index}>
          <Cell>
            <Skeleton className="h-4 w-16" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-24" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-12" />
          </Cell>
          <Cell>
            <Skeleton className="h-4 w-20" />
          </Cell>
        </Row>
      ))}
    </Tbody>
  </Table>
);
