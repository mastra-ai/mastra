import { ChevronDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { TopicTraceSummary } from '../types';
import { getVisibleTraceSummaries } from '../utils';
import { Button } from '@/ds/components/Button';
import { DataList } from '@/ds/components/DataList/data-list';
import { useDataListKeyboard } from '@/ds/components/DataList/use-data-list-keyboard';
import { SearchInput } from '@/ds/components/SearchInput';

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

  const { containerRef, getRowProps } = useDataListKeyboard({ count: visible.traces.length });

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-4" aria-label="Topic trace summaries">
      <SearchInput
        label="Search traces"
        placeholder="Search traces"
        value={search}
        onValueChange={value => {
          setSearch(value);
          setPage(1);
        }}
      />

      <DataList columns="minmax(12rem,1fr)" className="min-h-0 flex-1" scrollRef={containerRef}>
        <DataList.Top>
          <DataList.TopCells>
            <DataList.TopCell>Trace summary</DataList.TopCell>
          </DataList.TopCells>
        </DataList.Top>

        {visible.traces.length === 0 ? (
          <DataList.NoMatch message="No traces match this subtopic." />
        ) : (
          visible.traces.map((trace, index) => (
            <DataList.RowButton
              key={trace.id}
              {...getRowProps(index)}
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
        <Button icon={<ChevronDown />} size="sm" onClick={() => setPage(currentPage => currentPage + 1)}>
          Load more traces ({visible.traces.length} of {visible.total})
        </Button>
      ) : null}
    </section>
  );
}
