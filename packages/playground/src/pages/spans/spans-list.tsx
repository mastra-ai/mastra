import { DataList } from '@mastra/playground-ui/components/DataList';
import type { DataListSort } from '@mastra/playground-ui/components/DataList';
import { TracesErrorContent } from '@mastra/playground-ui/domains/traces/components/traces-error-content';
import { TracesListView } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import type { TracesListViewTrace } from '@mastra/playground-ui/domains/traces/components/traces-list-view';
import { useQuerySpans } from '@mastra/react/hooks/traces';
import type { SpanQueryArgs, SpanRow } from '@mastra/react/hooks/traces';
import { useState } from 'react';
import { useNavigate } from 'react-router';

const DAY_MS = 24 * 60 * 60 * 1000;

function lastDay(): SpanQueryArgs['timeRange'] {
  const now = Date.now();
  return { from: new Date(now - DAY_MS).toISOString(), to: new Date(now).toISOString() };
}

// `entityName` is left out: the list's Name column prefers it over `name`, which would label every
// span of an agent with the agent's name instead of the span's own name.
function toListRow(span: SpanRow): TracesListViewTrace {
  return {
    traceId: span.traceId,
    spanId: span.spanId,
    parentSpanId: span.parentSpanId,
    name: span.name,
    entityType: span.entityType,
    entityId: span.entityId,
    threadId: span.threadId,
    resourceId: span.resourceId,
    environment: span.environment,
    status: span.status,
    inputPreview: span.inputPreview,
    outputPreview: span.outputPreview ?? undefined,
    errorPreview: span.errorPreview ?? undefined,
    startedAt: span.startedAt,
    endedAt: span.endedAt,
    createdAt: span.startedAt,
  };
}

export function SpansList() {
  const navigate = useNavigate();
  // Fixed on mount so the query key, and the cursors issued for it, stay stable.
  const [timeRange] = useState(lastDay);
  const [sort, setSort] = useState<DataListSort>('desc');
  // `after` cursors used to reach the current page; empty on the first page.
  const [cursors, setCursors] = useState<string[]>([]);

  const query: SpanQueryArgs = { timeRange, orderBy: [{ field: 'startedAt', direction: sort }] };
  const { spans, nextCursor, isLoading, isPlaceholderData, isError, error } = useQuerySpans({
    query,
    after: cursors.at(-1),
  });

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <TracesErrorContent error={error} resource="spans" errorTitle="Failed to load spans" />
      </div>
    );
  }

  const handleSortChange = (direction: DataListSort) => {
    setSort(direction);
    // A cursor only applies to the ordering that produced it.
    setCursors([]);
  };

  // While the requested page loads, the rows and `nextCursor` still belong to the previous page,
  // so moving again would skip or repeat a page.
  const handleNextPage = () => {
    if (isPlaceholderData || !nextCursor) return;
    setCursors(current => [...current, nextCursor]);
  };
  const handlePrevPage = () => {
    if (isPlaceholderData) return;
    setCursors(current => current.slice(0, -1));
  };

  const handleSpanClick = (row: TracesListViewTrace) => {
    const params = new URLSearchParams({ traceId: row.traceId });
    if (row.spanId) params.set('spanId', row.spanId);
    void navigate(`/traces?${params.toString()}`);
  };

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
      <TracesListView
        // Remounting per page resets the scroll position to the top.
        key={cursors.length}
        listId="all-spans"
        traces={(spans ?? []).map(toListRow)}
        isLoading={isLoading}
        isBranchesMode
        createdSort={sort}
        onSortChange={handleSortChange}
        onTraceClick={handleSpanClick}
      />
      <DataList.Pagination
        currentPage={cursors.length}
        hasMore={!!nextCursor}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
      />
    </div>
  );
}
