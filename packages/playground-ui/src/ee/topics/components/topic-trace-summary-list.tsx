import { SearchIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TopicTraceSummary } from '../types';
import { getVisibleTraceSummaries } from '../utils';
import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList/data-list';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/ds/components/InputGroup';

export interface TopicTraceSummaryListProps {
  traces: TopicTraceSummary[];
  selectedTraceId?: string | null;
  onTraceSelect: (trace: TopicTraceSummary) => void;
  pageSize?: number;
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
      <InputGroup variant="outline">
        <InputGroupAddon align="inline-start">
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          aria-label="Search traces"
          placeholder="Search traces"
          onChange={event => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
      </InputGroup>

      <DataList columns="minmax(12rem,1fr)" className="min-h-0 flex-1">
        <DataList.Top>
          <DataList.TopCells>
            <DataList.TopCell>Trace summary</DataList.TopCell>
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
              <DataList.TextCell>{trace.name ?? trace.id}</DataList.TextCell>
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
