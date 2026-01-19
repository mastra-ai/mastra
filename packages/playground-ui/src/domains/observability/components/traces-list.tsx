import { Table, Thead, Th, Tbody, Row, TxtCell, Cell } from '@/ds/components/Table';
import { Skeleton } from '@/ds/components/Skeleton';
import { EmptyState } from '@/ds/components/EmptyState';
import { getShortId } from '@/ds/components/Text';
import { SpanRecord } from '@mastra/core/storage';
import { format, isToday } from 'date-fns';
import { EyeIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export const tracesListColumns = [
  { name: 'shortId', label: 'ID', width: '6rem' },
  { name: 'date', label: 'Date', width: '4.5rem' },
  { name: 'time', label: 'Time', width: '6.5rem' },
  { name: 'name', label: 'Name', width: undefined },
  { name: 'entityId', label: 'Entity', width: '10rem' },
  { name: 'status', label: 'Status', width: '3rem' },
];

type Trace = Pick<SpanRecord, 'traceId' | 'name' | 'entityType' | 'entityId' | 'entityName'> & {
  attributes?: Record<string, any> | null;
  createdAt: Date | string;
};

export type TracesListProps = {
  selectedTraceId?: string;
  onTraceClick?: (id: string) => void;
  traces?: Trace[];
  errorMsg?: string;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
};

export function TracesListSkeleton() {
  return (
    <div className="rounded-lg border border-border1 overflow-clip">
      <Table>
        <Thead>
          {tracesListColumns.map(col => (
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
                <Skeleton className="h-4 w-1/2" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-full" />
              </Cell>
              <Cell>
                <Skeleton className="h-4 w-3" />
              </Cell>
            </Row>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}

type StatusCellProps = {
  status?: string;
};

function StatusCell({ status }: StatusCellProps) {
  return (
    <Cell>
      <div className="flex justify-center items-center w-full">
        {status ? (
          <div
            className={cn('w-[0.6rem] h-[0.6rem] rounded-full', {
              'bg-green-600': status === 'success',
              'bg-red-700': status === 'failed',
            })}
          />
        ) : (
          <span className="text-neutral2 text-ui-sm">-</span>
        )}
      </div>
    </Cell>
  );
}

export function TracesList({
  traces,
  selectedTraceId,
  onTraceClick,
  errorMsg,
  setEndOfListElement,
  filtersApplied,
  isFetchingNextPage,
  hasNextPage,
}: TracesListProps) {
  if (!traces) {
    return null;
  }

  if (errorMsg) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<EyeIcon className="h-8 w-8 text-red-500" />}
          titleSlot="Error"
          descriptionSlot={errorMsg}
        />
      </div>
    );
  }

  if (traces.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<EyeIcon className="h-8 w-8 text-neutral3" />}
          titleSlot="No Traces"
          descriptionSlot={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg border border-border1 overflow-clip">
        <Table>
          <Thead>
            {tracesListColumns.map(col => (
              <Th key={col.name} style={{ width: col.width }}>
                {col.label}
              </Th>
            ))}
          </Thead>
          <Tbody>
            {traces.map(trace => {
              const createdAtDate = new Date(trace.createdAt);
              const isTodayDate = isToday(createdAtDate);

              const entityId =
                trace?.entityName || trace?.entityId || trace?.attributes?.agentId || trace?.attributes?.workflowId;

              return (
                <Row
                  key={trace.traceId}
                  onClick={() => onTraceClick?.(trace.traceId)}
                  selected={selectedTraceId === trace.traceId}
                >
                  <TxtCell>{getShortId(trace?.traceId) || 'n/a'}</TxtCell>
                  <TxtCell>{isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd')}</TxtCell>
                  <TxtCell>{format(createdAtDate, 'h:mm:ss aaa')}</TxtCell>
                  <TxtCell>{trace?.name}</TxtCell>
                  <TxtCell>{entityId}</TxtCell>
                  <StatusCell status={trace?.attributes?.status} />
                </Row>
              );
            })}
          </Tbody>
        </Table>
      </div>
      <div ref={setEndOfListElement} className="text-ui-md text-neutral3 opacity-50 flex mt-8 justify-center">
        {isFetchingNextPage && 'Loading more traces...'}
        {!hasNextPage && !isFetchingNextPage && 'All traces loaded'}
      </div>
    </div>
  );
}
