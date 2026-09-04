import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DatasetsList, DatasetsToolbar, getDatasetTagOptions } from '@/domains/datasets';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { useInfiniteDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';

export default function Datasets() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('all');
  const [experimentFilter, setExperimentFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  const {
    data: datasets = [],
    isLoading: isLoadingDatasets,
    error: errorDatasets,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useInfiniteDatasets();
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();

  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const datasetTagOptions = useMemo(() => getDatasetTagOptions(datasets), [datasets]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorDatasets || errorExperiments;

  const openCreatePage = () => void navigate('/datasets/new');

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

  if (datasets.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoDatasetsInfo onCreateClick={openCreatePage} />
      </NoDataPageLayout>
    );
  }

  const hasFilters = targetFilter !== 'all' || experimentFilter !== 'all' || tagFilter !== 'all' || search !== '';

  const resetFilters = () => {
    setSearch('');
    setTargetFilter('all');
    setExperimentFilter('all');
    setTagFilter('all');
  };

  return (
    <PageLayout height="full">
      <PageLayout.TopArea>
        <DatasetsToolbar
          search={search}
          onSearchChange={setSearch}
          targetFilter={targetFilter}
          onTargetFilterChange={setTargetFilter}
          experimentFilter={experimentFilter}
          onExperimentFilterChange={setExperimentFilter}
          tagFilter={tagFilter}
          onTagFilterChange={setTagFilter}
          tagOptions={datasetTagOptions}
          onReset={resetFilters}
          hasActiveFilters={hasFilters}
          onCreateClick={openCreatePage}
        />
      </PageLayout.TopArea>

      <DatasetsList
        datasets={datasets}
        experiments={experiments}
        isLoading={isLoading}
        search={search}
        targetFilter={targetFilter}
        experimentFilter={experimentFilter}
        tagFilter={tagFilter}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
      />
    </PageLayout>
  );
}
