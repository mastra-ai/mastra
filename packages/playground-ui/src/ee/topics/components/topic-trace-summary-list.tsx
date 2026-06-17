import { useMemo, useState } from 'react';
import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList/data-list';
import { Searchbar } from '@/ds/components/Searchbar';
import { getVisibleTraceSummaries } from '../utils';
import type { TopicTraceSummary } from '../types';

export interface TopicTraceSummaryListProps {
  traces: TopicTraceSummary[];
  selectedTraceId?: string | null;
  onTraceSelect: (trace: TopicTraceSummary) => void;
  pageSize?: number;
}

function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined) return '';
  if (durationMs < 1000) return `${durationMs}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatStartedAt(startedAt: TopicTraceSummary['startedAt']): string {
  if (!startedAt) return '';
  const date = startedAt instanceof Date ? startedAt : new Date(startedAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString();
}

export function TopicTraceSummaryList({
  traces,
  selectedTraceId,
  onTraceSelect,
  pageSize = 25,
}: TopicTraceSummaryListProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const visible = useMemo(
    () => getVisibleTraceSummaries(traces, { search, sort: 'newest', page, pageSize }),
    [page, pageSize, search, traces],
  );

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Topic trace summaries">
      <Searchbar
        label="Search traces"
        placeholder="Search traces"
        onSearch={value => {
          setSearch(value);
          setPage(1);
        }}
      />

      <DataList columns="minmax(10rem,1.2fr) minmax(7rem,.7fr) minmax(7rem,.7fr) minmax(7rem,.7fr)" className="min-h-0 flex-1">
        <DataList.Top>
          <DataList.TopCells>
            <DataList.TopCell>Name</DataList.TopCell>
            <DataList.TopCell>Status</DataList.TopCell>
            <DataList.TopCell>Duration</DataList.TopCell>
            <DataList.TopCell>Started</DataList.TopCell>
          </DataList.TopCells>
        </DataList.Top>

        {visible.traces.length === 0 ? (
          <DataList.NoMatch message="No traces match this subtopic." />
        ) : (
          visible.traces.map(trace => (
            <DataList.RowButton
              key={trace.id}
              featured={selectedTraceId === trace.id}
              onClick={() => onTraceSelect(trace)}
              aria-pressed={selectedTraceId === trace.id}
            >
              <DataList.NameCell>{trace.name ?? trace.id}</DataList.NameCell>
              <DataList.TextCell>{trace.status}</DataList.TextCell>
              <DataList.TextCell>{formatDuration(trace.durationMs)}</DataList.TextCell>
              <DataList.TextCell>{formatStartedAt(trace.startedAt)}</DataList.TextCell>
            </DataList.RowButton>
          ))
        )}
      </DataList>

      {visible.hasMore ? (
        <Button variant="outline" size="sm" onClick={() => setPage(currentPage => currentPage + 1)}>
          Load more traces ({visible.traces.length} of {visible.total})
        </Button>
      ) : null}
    </section>
  );
}
