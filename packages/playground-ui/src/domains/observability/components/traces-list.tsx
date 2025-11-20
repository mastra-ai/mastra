import { EntryList, getShortId } from '@/components/ui/elements';
import { SpanRecord } from '@mastra/core/storage';
import { format, isToday } from 'date-fns';

export const tracesListColumns = [
  { name: 'shortId', label: 'ID', size: '6rem' },
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'status', label: 'Status', size: '3rem' },
];

type Trace = Pick<SpanRecord, 'traceId' | 'name'> & {
  attributes?: Record<string, any> | null;
  createdAt: Date | string;
};

type TracesListProps = {
  selectedTraceId?: string;
  onTraceClick?: (id: string) => void;
  traces?: Trace[];
  errorMsg?: string;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
};

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

  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={tracesListColumns} />
        {errorMsg ? (
          <EntryList.Message message={errorMsg} type="error" />
        ) : (
          <>
            {traces.length > 0 ? (
              <EntryList.Entries>
                {traces.map(trace => {
                  const createdAtDate = new Date(trace.createdAt);
                  const isTodayDate = isToday(createdAtDate);

                  const entry = {
                    id: trace.traceId,
                    shortId: getShortId(trace?.traceId) || 'n/a',
                    date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
                    time: format(createdAtDate, 'h:mm:ss aaa'),
                    name: trace?.name,
                    entityId: trace?.attributes?.agentId || trace?.attributes?.workflowId,
                    status: trace?.attributes?.status,
                  };

                  return (
                    <EntryList.Entry
                      key={entry.id}
                      entry={entry}
                      isSelected={selectedTraceId === trace.traceId}
                      columns={tracesListColumns}
                      onClick={onTraceClick}
                    >
                      {tracesListColumns.map((col, index) => {
                        const key = `${index}-${trace.traceId}`;
                        return col.name === 'status' ? (
                          <EntryList.EntryStatus key={key} status={entry?.[col.name as keyof typeof entry]} />
                        ) : (
                          <EntryList.EntryText key={key}>{entry?.[col.name as keyof typeof entry]}</EntryList.EntryText>
                        );
                      })}
                    </EntryList.Entry>
                  );
                })}
              </EntryList.Entries>
            ) : (
              <EntryList.Message
                message={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
              />
            )}
          </>
        )}
      </EntryList.Trim>
      <EntryList.NextPageLoading
        setEndOfListElement={setEndOfListElement}
        loadingText="Loading more traces..."
        noMoreDataText="All traces loaded"
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </EntryList>
  );
}
