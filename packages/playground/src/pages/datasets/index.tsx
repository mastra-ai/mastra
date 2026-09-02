import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DatasetsList, DatasetsToolbar, getDatasetTagOptions } from '@/domains/datasets';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';

const DATASETS_PER_PAGE = 10;

export default function Datasets() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('all');
  const [experimentFilter, setExperimentFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [page, setPage] = useState(0);

  const {
    data: datasetsData,
    isLoading: isLoadingDatasets,
    error: errorDatasets,
  } = useDatasets({ page, perPage: DATASETS_PER_PAGE });
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();

  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);
  const hasMore = datasetsData?.pagination?.hasMore ?? false;
  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const datasetTagOptions = useMemo(() => getDatasetTagOptions(datasets), [datasets]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorDatasets || errorExperiments;

  const openCreatePage = () => void navigate('/datasets/new');

  const handleNextPage = useCallback(() => setPage(p => p + 1), []);
  const handlePrevPage = useCallback(() => setPage(p => Math.max(0, p - 1)), []);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(0);
  }, []);
  const handleTargetFilterChange = useCallback((value: string) => {
    setTargetFilter(value);
    setPage(0);
  }, []);
  const handleExperimentFilterChange = useCallback((value: string) => {
    setExperimentFilter(value);
    setPage(0);
  }, []);
  const handleTagFilterChange = useCallback((value: string) => {
    setTagFilter(value);
    setPage(0);
  }, []);

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

  if (datasets.length === 0 && !isLoading && page === 0) {
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
    setPage(0);
  };

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <DatasetsToolbar
          search={search}
          onSearchChange={handleSearchChange}
          targetFilter={targetFilter}
          onTargetFilterChange={handleTargetFilterChange}
          experimentFilter={experimentFilter}
          onExperimentFilterChange={handleExperimentFilterChange}
          tagFilter={tagFilter}
          onTagFilterChange={handleTagFilterChange}
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
        currentPage={page}
        hasMore={hasMore}
        onNextPage={handleNextPage}
        onPrevPage={handlePrevPage}
      />
    </PageLayout>
  );
}
