import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Badge, EntityList, EntityListSkeleton } from '@mastra/playground-ui';
import { useMemo } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface DatasetsListProps {
  datasets: DatasetRecord[];
  experiments: DatasetExperiment[];
  reviewByDataset?: Map<string, { needsReview: number; complete: number }>;
  isLoading: boolean;
  search?: string;
  targetFilter?: string;
  experimentFilter?: string;
  tagFilter?: string;
}

export const DATASET_TARGET_OPTIONS = [
  { value: 'all', label: 'All targets' },
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
] as const;

export const DATASET_EXPERIMENT_OPTIONS = [
  { value: 'all', label: 'All datasets' },
  { value: 'with', label: 'With experiments' },
  { value: 'without', label: 'Without experiments' },
] as const;

const COLUMNS = 'auto 1fr auto auto auto auto auto auto';

function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DatasetsList({
  datasets,
  experiments,
  reviewByDataset,
  isLoading,
  search = '',
  targetFilter = 'all',
  experimentFilter = 'all',
  tagFilter = 'all',
}: DatasetsListProps) {
  const { paths, navigate, Link } = useLinkComponent();

  const enrichedDatasets = useMemo(() => {
    return datasets.map(ds => {
      const dsExperiments = experiments.filter(e => e.datasetId === ds.id);
      const completed = dsExperiments.filter(e => e.status === 'completed').length;
      const total = dsExperiments.length;
      const successPct = total > 0 ? Math.round((completed / total) * 100) : null;
      return { ...ds, experimentCount: total, successPct };
    });
  }, [datasets, experiments]);

  const filteredData = useMemo(() => {
    const term = search.toLowerCase();
    return enrichedDatasets.filter(ds => {
      const matchesSearch = !term || ds.name.toLowerCase().includes(term);
      const matchesTarget = targetFilter === 'all' || ds.targetType === targetFilter;
      const matchesExperiment =
        experimentFilter === 'all' ||
        (experimentFilter === 'with' && ds.experimentCount > 0) ||
        (experimentFilter === 'without' && ds.experimentCount === 0);
      const matchesTag = tagFilter === 'all' || (Array.isArray(ds.tags) && (ds.tags as string[]).includes(tagFilter));
      return matchesSearch && matchesTarget && matchesExperiment && matchesTag;
    });
  }, [enrichedDatasets, search, targetFilter, experimentFilter, tagFilter]);

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <EntityList columns={COLUMNS}>
      <EntityList.Top>
        <EntityList.TopCell>Name</EntityList.TopCell>
        <EntityList.TopCell>Description</EntityList.TopCell>
        <EntityList.TopCell>Tags</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Version</EntityList.TopCell>
        <EntityList.TopCell>Target</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Experiments</EntityList.TopCell>
        <EntityList.TopCell className="text-center">Review</EntityList.TopCell>
        <EntityList.TopCell>Last Updated</EntityList.TopCell>
      </EntityList.Top>

      {filteredData.map(ds => {
        const successBadge =
          ds.experimentCount > 0 ? (
            <Badge
              variant={
                ds.successPct !== null && ds.successPct >= 70
                  ? 'success'
                  : ds.successPct !== null && ds.successPct >= 40
                    ? 'warning'
                    : 'error'
              }
            >
              {ds.experimentCount} ({ds.successPct ?? 0}%)
            </Badge>
          ) : (
            <span className="text-neutral2">—</span>
          );

        return (
          <EntityList.RowLink key={ds.id} to={paths.datasetLink(ds.id)} LinkComponent={Link}>
            <EntityList.NameCell>{ds.name}</EntityList.NameCell>
            <EntityList.DescriptionCell>{ds.description || ''}</EntityList.DescriptionCell>
            <EntityList.Cell>
              {Array.isArray(ds.tags) && ds.tags.length > 0 ? (
                <div
                  className="flex max-w-48 items-center gap-1 overflow-hidden"
                  title={(ds.tags as string[]).join(', ')}
                >
                  {(ds.tags as string[]).slice(0, 2).map(tag => (
                    <Badge key={tag} variant="default" className="shrink-0 px-1.5 py-0 text-[10px]">
                      {tag}
                    </Badge>
                  ))}
                  {ds.tags.length > 2 && (
                    <span className="shrink-0 text-[10px] text-neutral2">+{ds.tags.length - 2}</span>
                  )}
                </div>
              ) : (
                <span className="text-neutral2">—</span>
              )}
            </EntityList.Cell>
            <EntityList.TextCell className="text-center">v{ds.version ?? 1}</EntityList.TextCell>
            <EntityList.Cell>
              {ds.targetType ? <Badge variant="info">{ds.targetType}</Badge> : <span className="text-neutral2">—</span>}
            </EntityList.Cell>
            <EntityList.Cell className="text-center">{successBadge}</EntityList.Cell>
            <EntityList.Cell className="text-center">
              {(() => {
                const review = reviewByDataset?.get(ds.id);
                if (!review) return <span className="text-neutral2">—</span>;
                if (review.needsReview > 0) {
                  return (
                    <button
                      type="button"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`${paths.datasetLink(ds.id)}?tab=review`);
                      }}
                      className="inline-flex"
                    >
                      <Badge variant="warning" className="cursor-pointer transition-opacity hover:opacity-80">
                        {review.needsReview} pending
                      </Badge>
                    </button>
                  );
                }
                return <Badge variant="success">{review.complete} reviewed</Badge>;
              })()}
            </EntityList.Cell>
            <EntityList.TextCell>{formatDate(ds.updatedAt)}</EntityList.TextCell>
          </EntityList.RowLink>
        );
      })}
    </EntityList>
  );
}

export function getDatasetTagOptions(datasets: DatasetRecord[]) {
  const tagSet = new Set<string>();

  for (const dataset of datasets) {
    if (!Array.isArray(dataset.tags)) continue;

    for (const tag of dataset.tags as string[]) {
      tagSet.add(tag);
    }
  }

  return [
    { value: 'all', label: 'All tags' },
    ...Array.from(tagSet)
      .sort()
      .map(tag => ({ value: tag, label: tag })),
  ];
}
