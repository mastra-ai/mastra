import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Chip } from '@mastra/playground-ui/components/Chip';
import {
  DataList as EntityList,
  DataListSkeleton as EntityListSkeleton,
} from '@mastra/playground-ui/components/DataList';
import { StatusBadge } from '@mastra/playground-ui/components/StatusBadge';
import { getShortId } from '@mastra/playground-ui/components/Text';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

/**
 * Name cell for the experiments overview: the experiment name as the primary
 * label with the short id beneath it (falling back to the short id when
 * unnamed), and the description surfaced in a tooltip when present.
 */
function ExperimentNameCell({ experiment }: { experiment: DatasetExperiment }) {
  const shortId = getShortId(experiment.id) ?? experiment.id;

  if (!experiment.name) {
    return <span className="block truncate font-mono text-neutral4">{shortId}</span>;
  }

  const label = (
    <span className="flex min-w-0 flex-col gap-0.5 py-0.5 text-left">
      <span className="block truncate text-neutral4">{experiment.name}</span>
      <span className="block truncate font-mono text-ui-sm text-neutral2">{shortId}</span>
    </span>
  );

  if (!experiment.description) {
    return label;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{label}</TooltipTrigger>
      <TooltipContent>{experiment.description}</TooltipContent>
    </Tooltip>
  );
}

export interface ExperimentsListProps {
  experiments: DatasetExperiment[];
  datasets?: DatasetRecord[];
  reviewByExperiment?: Map<string, { needsReview: number; complete: number; total: number }>;
  isLoading: boolean;
  search?: string;
  statusFilter?: string;
  datasetFilter?: string;
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
        (exp.name ?? '').toLowerCase().includes(term) ||
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
    <EntityList columns={COLUMNS} variant="striped">
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
        const dsName = exp.datasetId
          ? (datasetMap.get(exp.datasetId) ?? getShortId(exp.datasetId) ?? exp.datasetId)
          : '—';
        const status = exp.status ?? 'pending';
        const succeeded = exp.succeededCount ?? 0;
        const failed = exp.failedCount ?? 0;
        const total = exp.totalItems ?? 0;
        const successPct = total > 0 ? Math.round((succeeded / total) * 100) : 0;

        return (
          <EntityList.RowLink key={exp.id} to={paths.experimentLink(exp.id)} LinkComponent={Link}>
            <EntityList.Cell>
              <ExperimentNameCell experiment={exp} />
            </EntityList.Cell>
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
                  return (
                    <Chip size="small" color="yellow">
                      {review.needsReview} pending
                    </Chip>
                  );
                }
                return (
                  <Chip size="small" color="green">
                    {review.complete}/{inPipeline} reviewed
                  </Chip>
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
