import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useInfiniteDatasets, useExperiments } from '@mastra/react/hooks/datasets';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { HeaderCreateAction } from '@/components/ui/header-create-action';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { DatasetsList } from '@/domains/datasets/components/datasets-list/datasets-list';
import { DatasetsListSkeleton } from '@/domains/datasets/components/datasets-list/datasets-list-skeleton';
import { getDatasetTagOptions } from '@/domains/datasets/components/datasets-list/helpers';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { DatasetsToolbar } from '@/domains/datasets/components/datasets-toolbar';
import { navCrumb } from '@/domains/navigation/crumbs';
import { useTargetFilterParams } from '@/domains/shared/hooks/use-target-filter-params';

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
  const { targetType, targetId, setTargetType, setTargetId, clear: clearTarget } = useTargetFilterParams();

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

  const navigate = useNavigate();
  const openCreatePage = () => void navigate('/datasets/new');

  const headerCreateAction = (
    <HeaderCreateAction href="/datasets/new" tooltip="Create a dataset">
      New dataset
    </HeaderCreateAction>
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

  // With a target filter active, keep the toolbar so the user can reset it.
  if (datasets.length === 0 && !isLoading && !targetType) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={headerCreateAction}>
        <h1 className="sr-only">Datasets</h1>
        <NoDatasetsInfo onCreateClick={openCreatePage} />
      </PageLayout>
    );
  }

  const hasFilters = experimentFilter !== 'all' || tagFilter !== 'all' || search !== '' || targetType !== '';

  const resetFilters = () => {
    setSearch('');
    setExperimentFilter('all');
    setTagFilter('all');
    clearTarget();
  };

  return (
    <PageLayout
      variant="catalog"
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={headerCreateAction}
      actionRow={
        <DatasetsToolbar
          search={search}
          onSearchChange={setSearch}
          experimentFilter={experimentFilter}
          onExperimentFilterChange={setExperimentFilter}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          tagOptions={datasetTagOptions}
          targetType={targetType}
          onTargetTypeChange={setTargetType}
          targetId={targetId}
          onTargetIdChange={setTargetId}
          onReset={resetFilters}
          hasActiveFilters={hasFilters}
        />
      }
    >
      <h1 className="sr-only">Datasets</h1>
      {isLoading ? (
        <DatasetsListSkeleton scroll="page" />
      ) : (
        <DatasetsList
          scroll="page"
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
    </PageLayout>
  );
}
