import type { DatasetExperiment, DatasetRecord } from '@mastra/client-js';
import { Plus, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyDatasetsTable } from '@/domains/datasets/components/empty-datasets-table';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';
import { EntityList, EntityListSkeleton } from '@/ds/components/EntityList';
import { ErrorState } from '@/ds/components/ErrorState';
import { SearchFieldBlock } from '@/ds/components/FormFieldBlocks/fields/search-field-block';
import { SelectFieldBlock } from '@/ds/components/FormFieldBlocks/fields/select-field-block';
import { PermissionDenied } from '@/ds/components/PermissionDenied';
import { useLinkComponent } from '@/lib/framework';
import { is403ForbiddenError } from '@/lib/query-utils';

export interface EvaluationDatasetsListProps {
  datasets: DatasetRecord[];
  experiments: DatasetExperiment[];
  reviewByDataset?: Map<string, { needsReview: number; complete: number }>;
  isLoading: boolean;
  error?: Error | null;
  onCreateClick?: () => void;
}

const COLUMNS = 'auto 1fr auto auto auto auto auto auto';

function formatDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return '—';
  const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const TARGET_TYPE_OPTIONS = [
  { value: 'all', label: 'All targets' },
  { value: 'agent', label: 'Agent' },
  { value: 'workflow', label: 'Workflow' },
];

const EXPERIMENT_OPTIONS = [
  { value: 'all', label: 'All datasets' },
  { value: 'with', label: 'With experiments' },
  { value: 'without', label: 'Without experiments' },
];

export function EvaluationDatasetsList({
  datasets,
  experiments,
  reviewByDataset,
  isLoading,
  error,
  onCreateClick,
}: EvaluationDatasetsListProps) {
  const { paths } = useLinkComponent();
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('all');
  const [experimentFilter, setExperimentFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  const enrichedDatasets = useMemo(() => {
    return datasets.map(ds => {
      const dsExperiments = experiments.filter(e => e.datasetId === ds.id);
      const completed = dsExperiments.filter(e => e.status === 'completed').length;
      const total = dsExperiments.length;
      const successPct = total > 0 ? Math.round((completed / total) * 100) : null;
      return { ...ds, experimentCount: total, successPct };
    });
  }, [datasets, experiments]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const ds of datasets) {
      if (Array.isArray(ds.tags)) {
        for (const tag of ds.tags as string[]) tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [datasets]);

  const tagFilterOptions = useMemo(
    () => [{ value: 'all', label: 'All tags' }, ...allTags.map(tag => ({ value: tag, label: tag }))],
    [allTags],
  );

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

  const hasActiveFilters = targetFilter !== 'all' || experimentFilter !== 'all' || tagFilter !== 'all';
  const resetFilters = () => {
    setSearch('');
    setTargetFilter('all');
    setExperimentFilter('all');
    setTagFilter('all');
  };

  if (error && is403ForbiddenError(error)) {
    return <PermissionDenied resource="datasets" />;
  }

  if (error) {
    return <ErrorState title="Failed to load datasets" message={error.message} />;
  }

  if (datasets.length === 0 && !isLoading) {
    return <EmptyDatasetsTable onCreateClick={onCreateClick} />;
  }

  if (isLoading) {
    return <EntityListSkeleton columns={COLUMNS} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <SearchFieldBlock
            name="search-datasets"
            label="Search datasets"
            labelIsHidden
            placeholder="Filter by dataset name"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onReset={() => setSearch('')}
            className="w-full max-w-80"
          />
          <ButtonsGroup>
            <SelectFieldBlock
              label="Target"
              labelIsHidden
              name="filter-target"
              options={TARGET_TYPE_OPTIONS}
              value={targetFilter}
              onValueChange={setTargetFilter}
              className="whitespace-nowrap"
            />
            <SelectFieldBlock
              label="Experiments"
              labelIsHidden
              name="filter-experiments"
              options={EXPERIMENT_OPTIONS}
              value={experimentFilter}
              onValueChange={setExperimentFilter}
              className="whitespace-nowrap"
            />
            {allTags.length > 0 && (
              <SelectFieldBlock
                label="Tags"
                labelIsHidden
                name="filter-tags"
                options={tagFilterOptions}
                value={tagFilter}
                onValueChange={setTagFilter}
                className="whitespace-nowrap"
              />
            )}
            {hasActiveFilters && (
              <Button onClick={resetFilters} size="sm" variant="light">
                <XIcon className="size-3" /> Reset
              </Button>
            )}
          </ButtonsGroup>
        </div>
        {onCreateClick && (
          <Button variant="primary" size="sm" onClick={onCreateClick}>
            <Plus className="size-4" />
            Create Dataset
          </Button>
        )}
      </div>
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
            <EntityList.RowLink key={ds.id} to={paths.datasetLink(ds.id)}>
              <EntityList.NameCell>{ds.name}</EntityList.NameCell>
              <EntityList.DescriptionCell>{ds.description || ''}</EntityList.DescriptionCell>
              <EntityList.Cell>
                {Array.isArray(ds.tags) && ds.tags.length > 0 ? (
                  <div
                    className="flex items-center gap-1 max-w-48 overflow-hidden"
                    title={(ds.tags as string[]).join(', ')}
                  >
                    {(ds.tags as string[]).slice(0, 2).map(tag => (
                      <Badge key={tag} variant="default" className="text-[10px] px-1.5 py-0 shrink-0">
                        {tag}
                      </Badge>
                    ))}
                    {ds.tags.length > 2 && (
                      <span className="text-[10px] text-neutral2 shrink-0">+{ds.tags.length - 2}</span>
                    )}
                  </div>
                ) : (
                  <span className="text-neutral2">—</span>
                )}
              </EntityList.Cell>
              <EntityList.TextCell className="text-center">v{ds.version ?? 1}</EntityList.TextCell>
              <EntityList.Cell>
                {ds.targetType ? (
                  <Badge variant="info">{ds.targetType}</Badge>
                ) : (
                  <span className="text-neutral2">—</span>
                )}
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
                          window.location.href = `${paths.datasetLink(ds.id)}?tab=review`;
                        }}
                        className="inline-flex"
                      >
                        <Badge variant="warning" className="hover:opacity-80 transition-opacity cursor-pointer">
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
    </div>
  );
}
