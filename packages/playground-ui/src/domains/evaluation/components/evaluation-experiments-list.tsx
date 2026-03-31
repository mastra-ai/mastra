import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { FlaskConical, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { EmptyState } from '@/ds/components/EmptyState';
import { EntityList, EntityListSkeleton } from '@/ds/components/EntityList';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import { SelectFieldBlock } from '@/ds/components/FormFieldBlocks/fields/select-field-block';
import { StatusBadge } from '@/ds/components/StatusBadge';
import { useLinkComponent } from '@/lib/framework';

export interface EvaluationExperimentsListProps {
  experiments: DatasetExperiment[];
  datasets?: DatasetRecord[];
  reviewByExperiment?: Map<string, { needsReview: number; complete: number; total: number }>;
  isLoading: boolean;
}

const COLUMNS = 'auto 1fr auto auto auto auto auto auto auto';

function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  completed: 'success',
  running: 'warning',
  failed: 'error',
  pending: 'neutral',
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

export function EvaluationExperimentsList({
  experiments,
  datasets,
  reviewByExperiment,
  isLoading,
}: EvaluationExperimentsListProps) {
  const { paths } = useLinkComponent();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [datasetFilter, setDatasetFilter] = useState('all');

  const datasetMap = useMemo(() => {
    const map = new Map<string, string>();
    datasets?.forEach(ds => map.set(ds.id, ds.name));
    return map;
  }, [datasets]);

  const datasetOptions = useMemo(() => {
    const opts = [{ value: 'all', label: 'All datasets' }];
    datasets?.forEach(ds => opts.push({ value: ds.id, label: ds.name }));
    return opts;
  }, [datasets]);

  const sortedExperiments = useMemo(() => {
    return [...experiments].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [experiments]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return sortedExperiments.filter(exp => {
      const dsName = exp.datasetId ? (datasetMap.get(exp.datasetId) ?? '') : '';
      const matchesSearch =
        !term ||
        exp.id.toLowerCase().includes(term) ||
        dsName.toLowerCase().includes(term) ||
        (exp.targetId ?? '').toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || exp.status === statusFilter;
      const matchesDataset = datasetFilter === 'all' || exp.datasetId === datasetFilter;
      return matchesSearch && matchesStatus && matchesDataset;
    });
  }, [sortedExperiments, search, datasetMap, statusFilter, datasetFilter]);

  const hasActiveFilters = statusFilter !== 'all' || datasetFilter !== 'all';
  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDatasetFilter('all');
  };

  if (experiments.length === 0 && !isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <EmptyState
          iconSlot={<FlaskConical className="size-10 text-neutral3" />}
          titleSlot="No Experiments Yet"
          descriptionSlot="Run experiments against your datasets to see results here."
        />
      </div>
    );
  }

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <SearchFieldBlock
          name="search-experiments"
          label="Search experiments"
          labelIsHidden
          placeholder="Filter by experiment, dataset, or target"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onReset={() => setSearch('')}
          className="w-full max-w-80"
        />
        <ButtonsGroup>
          <SelectFieldBlock
            label="Status"
            labelIsHidden
            name="filter-status"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            className="whitespace-nowrap"
          />
          <SelectFieldBlock
            label="Dataset"
            labelIsHidden
            name="filter-dataset"
            options={datasetOptions}
            value={datasetFilter}
            onValueChange={setDatasetFilter}
            className="whitespace-nowrap"
          />
          {hasActiveFilters && (
            <Button onClick={resetFilters} size="sm" variant="light">
              <XIcon className="size-3" /> Reset
            </Button>
          )}
        </ButtonsGroup>
      </div>
      <EntityList columns={COLUMNS}>
        <EntityList.Top>
          <EntityList.TopCell>Experiment</EntityList.TopCell>
          <EntityList.TopCell>Dataset</EntityList.TopCell>
          <EntityList.TopCell>Target</EntityList.TopCell>
          <EntityList.TopCell>Status</EntityList.TopCell>
          <EntityList.TopCell className="text-center">Items</EntityList.TopCell>
          <EntityList.TopCell className="text-center">Succeeded</EntityList.TopCell>
          <EntityList.TopCell className="text-center">Failed</EntityList.TopCell>
          <EntityList.TopCell className="text-center">Review</EntityList.TopCell>
          <EntityList.TopCell>Date</EntityList.TopCell>
        </EntityList.Top>

        {filteredData.map(exp => {
          const dsName = exp.datasetId ? (datasetMap.get(exp.datasetId) ?? exp.datasetId.slice(0, 8)) : '—';
          const status = exp.status ?? 'pending';
          const succeeded = exp.succeededCount ?? 0;
          const failed = exp.failedCount ?? 0;
          const total = exp.totalItems ?? 0;
          const successPct = total > 0 ? Math.round((succeeded / total) * 100) : 0;

          return (
            <EntityList.RowLink
              key={exp.id}
              to={exp.datasetId ? paths.datasetExperimentLink(exp.datasetId, exp.id) : '#'}
            >
              <EntityList.NameCell className="font-mono">{exp.id.slice(0, 8)}</EntityList.NameCell>
              <EntityList.TextCell>{dsName}</EntityList.TextCell>
              <EntityList.Cell>
                <span className="truncate">
                  {exp.targetType} {exp.targetId}
                </span>
              </EntityList.Cell>
              <EntityList.Cell>
                <StatusBadge variant={STATUS_VARIANT[status] ?? 'neutral'} withDot>
                  {status}
                </StatusBadge>
              </EntityList.Cell>
              <EntityList.TextCell className="text-center">{total}</EntityList.TextCell>
              <EntityList.TextCell className="text-center">
                <span className={succeeded > 0 ? 'text-accent1' : ''}>
                  {succeeded} ({successPct}%)
                </span>
              </EntityList.TextCell>
              <EntityList.TextCell className="text-center">
                <span className={failed > 0 ? 'text-accent2' : ''}>{failed}</span>
              </EntityList.TextCell>
              <EntityList.Cell className="text-center">
                {(() => {
                  const review = reviewByExperiment?.get(exp.id);
                  if (!review) return <span className="text-neutral2">—</span>;
                  const inPipeline = review.needsReview + review.complete;
                  if (inPipeline === 0) return <span className="text-neutral2">—</span>;
                  if (review.needsReview > 0) {
                    return <Badge variant="warning">{review.needsReview} pending</Badge>;
                  }
                  return (
                    <Badge variant="success">
                      {review.complete}/{inPipeline} reviewed
                    </Badge>
                  );
                })()}
              </EntityList.Cell>
              <EntityList.TextCell>{formatDate(exp.createdAt)}</EntityList.TextCell>
            </EntityList.RowLink>
          );
        })}
      </EntityList>
    </div>
  );
}
