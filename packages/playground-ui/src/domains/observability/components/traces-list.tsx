import {
  EntryList,
  EntryListEntries,
  EntryListEntryStatusCol,
  EntryListHeader,
  EntryListMessage,
  EntryListTrim,
  getShortId,
} from '@/components/ui/elements';
import { EntryListNextPageLoading } from '@/components/ui/elements/entry-list/entry-list-next-page-loading';
import { format, isToday } from 'date-fns';

export const tracesListColumns = [
  { name: 'shortId', label: 'ID', size: '6rem' },
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'status', label: 'Status', size: '3rem' },
];

type TracesListProps = {
  selectedTraceId?: string;
  onTraceClick?: (id: string) => void;
  traces?: any[];
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

  const entries = traces.map(trace => {
    const createdAtDate = new Date(trace.createdAt);
    const isTodayDate = isToday(createdAtDate);

    return {
      id: trace.traceId,
      shortId: getShortId(trace?.traceId) || 'n/a',
      date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
      time: format(createdAtDate, 'h:mm:ss aaa'),
      name: trace?.name,
      entityId: trace?.attributes?.agentId || trace?.attributes?.workflowId,
      status: <EntryListEntryStatusCol status={trace?.attributes?.status} />,
    };
  });

  return (
    <EntryList>
      <EntryListTrim>
        <EntryListHeader columns={tracesListColumns} />
        {errorMsg ? (
          <EntryListMessage message={errorMsg} type="error" />
        ) : (
          <>
            {entries.length > 0 ? (
              <EntryListEntries
                entries={entries}
                selectedEntryId={selectedTraceId}
                columns={tracesListColumns}
                onEntryClick={onTraceClick}
              />
            ) : (
              <EntryListMessage
                message={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
              />
            )}
          </>
        )}
      </EntryListTrim>
      <EntryListNextPageLoading
        setEndOfListElement={setEndOfListElement}
        loadingText="Loading more traces..."
        noMoreDataText="All traces loaded"
        isLoading={isFetchingNextPage}
        hasMore={hasNextPage}
      />
    </EntryList>
  );
}
