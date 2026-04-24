import React from 'react';
import { groupTracesByThread } from '../utils/group-traces-by-thread';
import { getInputPreview } from '../utils/span-utils';
import { DataListSkeleton, TracesDataList } from '@/ds/components/DataList';
import { cn } from '@/lib/utils';

/** Span attributes fields the list view reads directly. Extra unknown keys are allowed so callers
 *  can pass the full attributes record from @mastra/core/storage without mapping. */
export type TraceAttributes = {
  status?: string | null;
  agentId?: string | null;
  workflowId?: string | null;
  [key: string]: unknown;
};

export type TracesListViewTrace = {
  traceId: string;
  name: string;
  entityType?: string | null;
  entityId?: string | null;
  entityName?: string | null;
  attributes?: TraceAttributes | null;
  input?: unknown;
  startedAt?: Date | string | null;
  createdAt: Date | string;
  threadId?: string | null;
};

const COLUMNS = 'auto auto auto auto minmax(5rem,1fr) auto auto';

export type TracesListViewProps = {
  traces: TracesListViewTrace[];
  isLoading?: boolean;
  isFetchingNextPage?: boolean;
  hasNextPage?: boolean;
  setEndOfListElement?: (element: HTMLDivElement | null) => void;
  filtersApplied?: boolean;
  /** Currently featured/selected trace — its row gets the highlighted background. */
  featuredTraceId?: string | null;
  /** Called when a row is clicked. The current selection logic (toggle on same id) is the consumer's call. */
  onTraceClick: (trace: TracesListViewTrace) => void;
  groupByThread?: boolean;
  threadTitles?: Record<string, string>;
};

/**
 * Pure presentational list. Renders the TracesDataList primitive with rows, optional thread grouping,
 * empty state, and infinite-paging loader. Owns no state.
 */
export function TracesListView({
  traces,
  isLoading,
  isFetchingNextPage,
  hasNextPage,
  setEndOfListElement,
  filtersApplied,
  featuredTraceId,
  onTraceClick,
  groupByThread,
  threadTitles,
}: TracesListViewProps) {
  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  const renderRows = (rows: TracesListViewTrace[]) =>
    rows.map(trace => {
      const isFeatured = trace.traceId === featuredTraceId;
      const displayDate = trace.startedAt ?? trace.createdAt;
      const entityName =
        trace.entityName || trace.entityId || trace.attributes?.agentId || trace.attributes?.workflowId;

      return (
        <TracesDataList.RowButton
          key={trace.traceId}
          onClick={() => onTraceClick(trace)}
          className={cn(isFeatured && 'bg-surface4')}
        >
          <TracesDataList.IdCell traceId={trace.traceId} />
          <TracesDataList.DateCell timestamp={displayDate} />
          <TracesDataList.TimeCell timestamp={displayDate} />
          <TracesDataList.NameCell name={trace.name} />
          <TracesDataList.InputCell input={getInputPreview(trace.input)} />
          <TracesDataList.EntityCell entityType={trace.entityType} entityName={entityName} />
          <TracesDataList.StatusCell status={trace.attributes?.status} />
        </TracesDataList.RowButton>
      );
    });

  return (
    <TracesDataList columns={COLUMNS} className="min-w-0">
      <TracesDataList.Top>
        <TracesDataList.TopCell>ID</TracesDataList.TopCell>
        <TracesDataList.TopCell>Date</TracesDataList.TopCell>
        <TracesDataList.TopCell>Time</TracesDataList.TopCell>
        <TracesDataList.TopCell>Name</TracesDataList.TopCell>
        <TracesDataList.TopCell>Input</TracesDataList.TopCell>
        <TracesDataList.TopCell>Entity</TracesDataList.TopCell>
        <TracesDataList.TopCell>Status</TracesDataList.TopCell>
      </TracesDataList.Top>

      {traces.length === 0 ? (
        <TracesDataList.NoMatch
          message={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
        />
      ) : groupByThread ? (
        (() => {
          const { groups, ungrouped } = groupTracesByThread(traces);
          return (
            <>
              {groups.map(group => (
                <React.Fragment key={group.threadId}>
                  <TracesDataList.Subheader>
                    <TracesDataList.SubHeading className="flex gap-2">
                      <span className="uppercase">Thread</span>
                      {threadTitles?.[group.threadId] && <b>'{threadTitles[group.threadId]}'</b>}
                      <b># {group.threadId}</b>
                      <span className="text-neutral2">({group.traces.length})</span>
                    </TracesDataList.SubHeading>
                  </TracesDataList.Subheader>
                  {renderRows(group.traces)}
                </React.Fragment>
              ))}
              {ungrouped.length > 0 && (
                <>
                  <TracesDataList.Subheader>
                    <TracesDataList.SubHeading className="flex gap-2 uppercase">
                      <span>No thread</span>
                      <span className="text-neutral2">({ungrouped.length})</span>
                    </TracesDataList.SubHeading>
                  </TracesDataList.Subheader>
                  {renderRows(ungrouped)}
                </>
              )}
            </>
          );
        })()
      ) : (
        renderRows(traces)
      )}
      {traces.length > 0 && (
        <TracesDataList.NextPageLoading
          isLoading={isFetchingNextPage}
          hasMore={hasNextPage}
          setEndOfListElement={setEndOfListElement}
        />
      )}
    </TracesDataList>
  );
}
