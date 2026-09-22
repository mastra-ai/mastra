import { CreateButton } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { DatasetsList, DatasetsToolbar, getDatasetTagOptions } from '@/domains/datasets';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { useInfiniteDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { navCrumb } from '@/domains/navigation/crumbs';
import { useTargetFilterParams } from '@/domains/shared/hooks/use-target-filter-params';

const crumbs = [navCrumb('/datasets')];

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
    <CreateButton onClick={openCreatePage} tooltip="Create a dataset" variant="ghost" size="sm">
      New dataset
    </CreateButton>
  );

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="datasets" />
        </div>
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <div className="flex h-full items-center justify-center">
          <ErrorState title="Failed to load datasets" message={error.message} />
        </div>
      </PageLayout>
    );
  }

  // With a target filter active, keep the toolbar so the user can reset it.
  if (datasets.length === 0 && !isLoading && !targetType) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={headerCreateAction}>
        <div className="flex h-full items-center justify-center">
          <NoDatasetsInfo onCreateClick={openCreatePage} />
        </div>
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
