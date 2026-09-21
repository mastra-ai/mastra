import { CreateButton } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { DatasetsList, DatasetsToolbar, getDatasetTagOptions } from '@/domains/datasets';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { useInfiniteDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { useTargetFilterParams } from '@/domains/shared/hooks/use-target-filter-params';
import { RouteHeaderActions } from '@/lib/route-header';

const DATASETS_SORT_KEYS = ['name', 'updatedAt'] as const;

export default function Datasets() {
  const navigate = useNavigate();
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
  } = useInfiniteDatasets({ targetType, targetId }, orderBy);
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();

  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const datasetTagOptions = useMemo(() => getDatasetTagOptions(datasets), [datasets]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorDatasets || errorExperiments;

  const openCreatePage = () => void navigate('/datasets/new');

  const headerCreateAction = (
    <RouteHeaderActions owner="dataset-list">
      <CreateButton onClick={openCreatePage} tooltip="Create a dataset" variant="ghost" size="sm">
        New dataset
      </CreateButton>
    </RouteHeaderActions>
  );

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="datasets" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load datasets" message={error.message} />
      </NoDataPageLayout>
    );
  }

  // With a target filter active, keep the toolbar so the user can reset it.
  if (datasets.length === 0 && !isLoading && !targetType) {
    return (
      <NoDataPageLayout>
        {headerCreateAction}
        <NoDatasetsInfo onCreateClick={openCreatePage} />
      </NoDataPageLayout>
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
    <PageLayout height="full">
      {headerCreateAction}
      <PageLayout.TopArea>
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
      </PageLayout.TopArea>

      <DatasetsList
        datasets={datasets}
        experiments={experiments}
        isLoading={isLoading}
        search={search}
        experimentFilter={experimentFilter}
        tagFilter={tagFilter}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        sort={sort}
        onSortChange={onSortChange}
      />
    </PageLayout>
  );
}
