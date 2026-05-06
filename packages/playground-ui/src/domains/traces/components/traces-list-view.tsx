import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
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

const ROW_HEIGHT = 36;
const OVERSCAN = 8;

type ListItem =
  | { kind: 'subheader'; key: string; node: ReactNode }
  | { kind: 'row'; key: string; trace: TracesListViewTrace };

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
 * Virtualized presentational list. Flattens optional thread groups into a single
 * indexed item array, renders only the visible window via TanStack Virtual, and
 * uses DataList primitives for layout (CSS Grid with subgrid rows).
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
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo<ListItem[]>(() => {
    if (traces.length === 0) return [];
    if (!groupByThread) {
      return traces.map(trace => ({ kind: 'row', key: trace.traceId, trace }));
    }
    const { groups, ungrouped } = groupTracesByThread(traces);
    const result: ListItem[] = [];
    for (const group of groups) {
      result.push({
        kind: 'subheader',
        key: `header-${group.threadId}`,
        node: (
          <TracesDataList.SubHeading className="flex gap-2">
            <span className="uppercase">Thread</span>
            {threadTitles?.[group.threadId] && <b>'{threadTitles[group.threadId]}'</b>}
            <b># {group.threadId}</b>
            <span className="text-neutral2">({group.traces.length})</span>
          </TracesDataList.SubHeading>
        ),
      });
      for (const trace of group.traces) {
        result.push({ kind: 'row', key: trace.traceId, trace });
      }
    }
    if (ungrouped.length > 0) {
      result.push({
        kind: 'subheader',
        key: 'header-ungrouped',
        node: (
          <TracesDataList.SubHeading className="flex gap-2 uppercase">
            <span>No thread</span>
            <span className="text-neutral2">({ungrouped.length})</span>
          </TracesDataList.SubHeading>
        ),
      });
      for (const trace of ungrouped) {
        result.push({ kind: 'row', key: trace.traceId, trace });
      }
    }
    return result;
  }, [traces, groupByThread, threadTitles]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  if (isLoading) {
    return <DataListSkeleton columns={COLUMNS} />;
  }

  const virtualItems = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const paddingTop = virtualItems[0]?.start ?? 0;
  const paddingBottom =
    virtualItems.length > 0 ? Math.max(0, totalSize - (virtualItems[virtualItems.length - 1]?.end ?? 0)) : 0;

  return (
    <TracesDataList columns={COLUMNS} scrollRef={scrollRef} className="min-w-0">
      <TracesDataList.Top>
        <TracesDataList.TopCell>ID</TracesDataList.TopCell>
        <TracesDataList.TopCell>Date</TracesDataList.TopCell>
        <TracesDataList.TopCell>Time</TracesDataList.TopCell>
        <TracesDataList.TopCell>Name</TracesDataList.TopCell>
        <TracesDataList.TopCell>Input</TracesDataList.TopCell>
        <TracesDataList.TopCell>Entity</TracesDataList.TopCell>
        <TracesDataList.TopCell>Status</TracesDataList.TopCell>
      </TracesDataList.Top>

      {items.length === 0 ? (
        <TracesDataList.NoMatch
          message={filtersApplied ? 'No traces found for applied filters' : 'No traces found yet'}
        />
      ) : (
        <>
          <TracesDataList.Spacer height={paddingTop} />
          {virtualItems.map(vi => {
            const item = items[vi.index];
            if (!item) return null;

            if (item.kind === 'subheader') {
              return (
                <TracesDataList.Subheader key={item.key} ref={virtualizer.measureElement} data-index={vi.index}>
                  {item.node}
                </TracesDataList.Subheader>
              );
            }

            const trace = item.trace;
            const isFeatured = trace.traceId === featuredTraceId;
            const displayDate = trace.startedAt ?? trace.createdAt;
            const entityName =
              trace.entityName || trace.entityId || trace.attributes?.agentId || trace.attributes?.workflowId;

            return (
              <TracesDataList.RowButton
                key={trace.traceId}
                ref={virtualizer.measureElement}
                data-index={vi.index}
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
          })}
          <TracesDataList.Spacer height={paddingBottom} />
          <TracesDataList.NextPageLoading
            isLoading={isFetchingNextPage}
            hasMore={hasNextPage}
            setEndOfListElement={setEndOfListElement}
          />
        </>
      )}
    </TracesDataList>
  );
}
