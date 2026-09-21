import { CreateButton } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { DatasetsList, DatasetsToolbar, getDatasetTagOptions } from '@/domains/datasets';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { useInfiniteDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { navCrumb } from '@/domains/navigation/crumbs';
import { useTargetFilterParams } from '@/domains/shared/hooks/use-target-filter-params';

const crumbs = [navCrumb('/datasets')];

export default function Datasets() {
  const navigate = useNavigate();
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
  } = useInfiniteDatasets({ targetType, targetId });
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
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <PermissionDenied resource="datasets" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <ErrorState title="Failed to load datasets" message={error.message} />
      </NoDataPageLayout>
    );
  }

  // With a target filter active, keep the toolbar so the user can reset it.
  if (datasets.length === 0 && !isLoading && !targetType) {
    return (
      <NoDataPageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} actions={headerCreateAction}>
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
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      actions={headerCreateAction}
      className="grid grid-rows-[auto_minmax(0,1fr)] p-4"
    >
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
      />
    </PageLayout>
  );
}
