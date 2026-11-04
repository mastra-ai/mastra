import { CreateButton } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useInfiniteDatasets, useExperiments } from '@mastra/react/hooks/datasets';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import type { DatasetsFilters } from '@/domains/datasets/components/datasets-filter-bar';
import { DatasetsList } from '@/domains/datasets/components/datasets-list/datasets-list';
import { DatasetsListSkeleton } from '@/domains/datasets/components/datasets-list/datasets-list-skeleton';
import { getDatasetTagOptions } from '@/domains/datasets/components/datasets-list/helpers';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { DatasetsToolbar } from '@/domains/datasets/components/datasets-toolbar';
import { navCrumb } from '@/domains/navigation/crumbs';
import {
  TARGET_ID_PARAM,
  TARGET_TYPE_PARAM,
  useTargetFilterParams,
} from '@/domains/shared/hooks/use-target-filter-params';

const crumbs = [navCrumb('/datasets')];

const DATASETS_SORT_KEYS = ['name', 'updatedAt'] as const;

export default function Datasets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { sort, onSortChange } = useUrlSort({
    searchParams,
    setSearchParams,
    allowedKeys: DATASETS_SORT_KEYS,
  });
  const orderBy = useMemo(
    () =>
      sort
        ? { field: sort.key, direction: sort.direction === 'asc' ? ('ASC' as const) : ('DESC' as const) }
        : undefined,
    [sort],
  );
  const [search, setSearch] = useState('');
  const [experimentFilter, setExperimentFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const { targetType, targetId } = useTargetFilterParams();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const handleFiltersChange = (next: DatasetsFilters) => {
    setSearch(next.search);
    setExperimentFilter(next.experimentFilter);
    setTagFilter(next.tagFilter);
    // Type and id change together in one URL update; an id only makes sense within its type.
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev);
        const nextTargetId = next.targetType === targetType ? next.targetId : '';
        if (next.targetType) params.set(TARGET_TYPE_PARAM, next.targetType);
        else params.delete(TARGET_TYPE_PARAM);
        if (nextTargetId) params.set(TARGET_ID_PARAM, nextTargetId);
        else params.delete(TARGET_ID_PARAM);
        return params;
      },
      { replace: true },
    );
  };

  const {
    data: datasets = [],
    isLoading: isLoadingDatasets,
    error: errorDatasets,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useInfiniteDatasets({ filter: { targetType, targetId }, orderBy: orderBy });
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();

  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const datasetTagOptions = useMemo(() => getDatasetTagOptions(datasets), [datasets]);

  const needsExperimentsForFilter = experimentFilter !== 'all';
  const isLoading = isLoadingDatasets || (needsExperimentsForFilter && isLoadingExperiments);
  const error = errorDatasets || (needsExperimentsForFilter ? errorExperiments : undefined);

  const openCreateDialog = () => setIsCreateOpen(true);
  const createDialog = <CreateDatasetDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />;

  const headerCreateAction = (
    <CreateButton onClick={openCreateDialog} tooltip="Create a dataset" variant="ghost" size="sm">
      New dataset
    </CreateButton>
  );

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <PermissionDenied variant="fill" resource="datasets" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <EmptyState tone="error" variant="fill" titleSlot="Failed to load datasets" descriptionSlot={error.message} />
      </PageLayout>
    );
  }

  // With a target filter active, keep the toolbar so the user can remove it.
  if (datasets.length === 0 && !isLoading && !targetType) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Datasets</h1>
        <NoDatasetsInfo onCreateClick={openCreateDialog} />
        {createDialog}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={headerCreateAction}
      actionRow={
        <DatasetsToolbar
          search={search}
          experimentFilter={experimentFilter}
          tagFilter={tagFilter}
          tagOptions={datasetTagOptions}
          targetType={targetType}
          targetId={targetId}
          onFiltersChange={handleFiltersChange}
        />
      }
    >
      <h1 className="sr-only">Datasets</h1>
      {isLoading ? (
        <DatasetsListSkeleton />
      ) : (
        <DatasetsList
          datasets={datasets}
          experiments={experiments}
          renderTrailingCell={dataset => {
            if (isLoadingExperiments) {
              return (
                <Txt
                  as="span"
                  variant="caption"
                  tone="muted"
                  aria-label={`Loading experiment summary for ${dataset.name}`}
                >
                  …
                </Txt>
              );
            }
            if (errorExperiments) {
              return (
                <Txt
                  as="span"
                  variant="caption"
                  tone="muted"
                  aria-label={`Experiment summary unavailable for ${dataset.name}`}
                >
                  Unavailable
                </Txt>
              );
            }
            return null;
          }}
          search={search}
          experimentFilter={experimentFilter}
          tagFilter={tagFilter}
          isFetchingNextPage={isFetchingNextPage}
          hasNextPage={hasNextPage}
          setEndOfListElement={setEndOfListElement}
          sort={sort}
          onSortChange={onSortChange}
        />
      )}
      {createDialog}
    </PageLayout>
  );
}
