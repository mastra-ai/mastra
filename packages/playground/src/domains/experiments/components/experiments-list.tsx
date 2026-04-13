import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Badge, EntityList, EntityListSkeleton, StatusBadge } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface ExperimentsListProps {
  experiments: DatasetExperiment[];
  datasets?: DatasetRecord[];
  reviewByExperiment?: Map<string, { needsReview: number; complete: number; total: number }>;
  isLoading: boolean;
  search?: string;
  statusFilter?: string;
  datasetFilter?: string;
}

export const EXPERIMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'running', label: 'Running' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
] as const;

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

export function ExperimentsList({
  experiments,
  datasets,
  reviewByExperiment,
  isLoading,
  search = '',
  statusFilter = 'all',
  datasetFilter = 'all',
}: ExperimentsListProps) {
  const { paths, Link } = useLinkComponent();

  const datasetMap = useMemo(() => {
    const map = new Map<string, string>();
    datasets?.forEach(ds => map.set(ds.id, ds.name));
    return map;
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

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
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
          <EntityList.RowLink key={exp.id} to={paths.experimentLink(exp.id)} LinkComponent={Link}>
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
  );
}

export function getExperimentDatasetOptions(datasets?: DatasetRecord[]) {
  return [{ value: 'all', label: 'All datasets' }, ...(datasets ?? []).map(ds => ({ value: ds.id, label: ds.name }))];
}
