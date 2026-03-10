import { EntryList } from '@/ds/components/EntryList';
import { getShortId } from '@/ds/components/Text';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { cn } from '@/lib/utils';
import { SpanRecord } from '@mastra/core/storage';
import { format, isToday } from 'date-fns';
import { ChevronRightIcon } from 'lucide-react';
import { groupTracesByThread } from '../utils/group-traces-by-thread';

export const tracesListColumns = [
  { name: 'shortId', label: 'ID', size: '6rem' },
  { name: 'date', label: 'Date', size: '4.5rem' },
  { name: 'time', label: 'Time', size: '6.5rem' },
  { name: 'name', label: 'Name', size: '1fr' },
  { name: 'entityId', label: 'Entity', size: '10rem' },
  { name: 'status', label: 'Status', size: '3rem' },
];

type Trace = Pick<SpanRecord, 'traceId' | 'name' | 'entityType' | 'entityId' | 'entityName'> & {
  attributes?: Record<string, any> | null;
  createdAt: Date | string;
  threadId?: string | null;
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
  groupByThread?: boolean;
  threadTitles?: Record<string, string>;
  columns?: typeof tracesListColumns;
};

function traceToEntry(trace: Trace, selectedTraceId?: string) {
  const createdAtDate = new Date(trace.createdAt);
  const isTodayDate = isToday(createdAtDate);

  return {
    id: trace.traceId,
    shortId: getShortId(trace?.traceId) || 'n/a',
    date: isTodayDate ? 'Today' : format(createdAtDate, 'MMM dd'),
    time: format(createdAtDate, 'h:mm:ss aaa'),
    name: trace?.name,
    entityId:
      trace?.entityName || trace?.entityId || trace?.attributes?.agentId || trace?.attributes?.workflowId,
    status: trace?.attributes?.status,
    isSelected: selectedTraceId === trace.traceId,
  };
}

function TraceEntries({
  traces,
  selectedTraceId,
  onTraceClick,
}: {
  traces: Trace[];
  selectedTraceId?: string;
  onTraceClick?: (id: string) => void;
}) {
  return (
    <EntryList.Entries>
      {traces.map(trace => {
        const entry = traceToEntry(trace, selectedTraceId);
        return (
          <EntryList.Entry
            key={entry.id}
            entry={entry}
            isSelected={entry.isSelected}
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
  );
}

function GroupedTracesList({
  traces,
  selectedTraceId,
  onTraceClick,
  filtersApplied,
  threadTitles,
}: {
  traces: Trace[];
  selectedTraceId?: string;
  onTraceClick?: (id: string) => void;
  filtersApplied?: boolean;
  threadTitles?: Record<string, string>;
}) {
  const { groups, ungrouped } = groupTracesByThread(traces as SpanRecord[]);

  if (groups.length === 0 && ungrouped.length === 0) {
    return (
      <EntryList.Trim>
        <EntryList.Header columns={tracesListColumns} />
        <EntryList.Message
          message={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
        />
      </EntryList.Trim>
    );
  }

  return (
    <div className={cn('grid gap-2')}>
      {groups.map(group => (
        <Collapsible key={group.threadId} defaultOpen>
          <div className={cn('rounded-lg border border-border1 overflow-clip')}>
            <CollapsibleTrigger
              className={cn(
                'flex w-full items-center gap-2 px-4 py-2 bg-surface2 hover:bg-surface3 text-ui-md text-neutral4',
              )}
            >
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {threadTitles?.[group.threadId]
                  ? <>Thread '{threadTitles[group.threadId]}' ({getShortId(group.threadId) || group.threadId})</>
                  : <>Thread {getShortId(group.threadId) || group.threadId}</>}
              </span>
              <span className="text-neutral3">({group.traces.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <EntryList.Header columns={tracesListColumns} />
              <TraceEntries
                traces={group.traces as Trace[]}
                selectedTraceId={selectedTraceId}
                onTraceClick={onTraceClick}
              />
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
      {ungrouped.length > 0 && (
        <Collapsible defaultOpen>
          <div className={cn('rounded-lg border border-border1 overflow-clip')}>
            <CollapsibleTrigger
              className={cn(
                'flex w-full items-center gap-2 px-4 py-2 bg-surface2 hover:bg-surface3 text-ui-md text-neutral4',
              )}
            >
              <ChevronRightIcon className="h-3.5 w-3.5 shrink-0" />
              <span>No thread</span>
              <span className="text-neutral3">({ungrouped.length})</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <EntryList.Header columns={tracesListColumns} />
              <TraceEntries
                traces={ungrouped as Trace[]}
                selectedTraceId={selectedTraceId}
                onTraceClick={onTraceClick}
              />
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}
    </div>
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
  groupByThread,
  threadTitles,
  columns = tracesListColumns,
}: TracesListProps) {
  if (!traces) {
    return null;
  }

  if (groupByThread) {
    return (
      <EntryList>
        {errorMsg ? (
          <EntryList.Trim>
            <EntryList.Header columns={tracesListColumns} />
            <EntryList.Message message={errorMsg} type="error" />
          </EntryList.Trim>
        ) : (
          <GroupedTracesList
            traces={traces}
            selectedTraceId={selectedTraceId}
            onTraceClick={onTraceClick}
            filtersApplied={filtersApplied}
            threadTitles={threadTitles}
          />
        )}
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

  return (
    <EntryList>
      <EntryList.Trim>
        <EntryList.Header columns={tracesListColumns} />
        {errorMsg ? (
          <EntryList.Message message={errorMsg} type="error" />
        ) : (
          <>
            {traces.length > 0 ? (
              <TraceEntries traces={traces} selectedTraceId={selectedTraceId} onTraceClick={onTraceClick} />
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
