import {
  ButtonWithTooltip,
  ErrorState,
  NoDataPageLayout,
  PageHeader,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { BookIcon, DatabaseIcon, Plus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { CreateDatasetDialog, DatasetsList, DatasetsToolbar, getDatasetTagOptions } from '@/domains/datasets';
import { NoDatasetsInfo } from '@/domains/datasets/components/datasets-list/no-datasets-info';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { useReviewSummary } from '@/domains/review';
import { buildReviewByDatasetMap } from '@/domains/review/review-maps';

const DATASETS_PER_PAGE = 10;

export default function Datasets() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
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
  const { data: reviewSummary } = useReviewSummary();

  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);
  const hasMore = datasetsData?.pagination?.hasMore ?? false;
  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const datasetTagOptions = useMemo(() => getDatasetTagOptions(datasets), [datasets]);
  const reviewByDataset = useMemo(
    () => buildReviewByDatasetMap(reviewSummary, experiments),
    [reviewSummary, experiments],
  );

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorDatasets || errorExperiments;

  const openCreateDialog = () => setIsCreateDialogOpen(true);

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
      <NoDataPageLayout title="Datasets" icon={<DatabaseIcon />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout title="Datasets" icon={<DatabaseIcon />}>
        <PermissionDenied resource="datasets" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Datasets" icon={<DatabaseIcon />}>
        <ErrorState title="Failed to load datasets" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (datasets.length === 0 && !isLoading && page === 0) {
    return (
      <>
        <NoDataPageLayout title="Datasets" icon={<DatabaseIcon />}>
          <NoDatasetsInfo onCreateClick={openCreateDialog} />
        </NoDataPageLayout>
        <CreateDatasetDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
      </>
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
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <DatabaseIcon /> Datasets
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip onClick={openCreateDialog} tooltipContent="Create a dataset">
              <Plus />
            </ButtonWithTooltip>
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/evals/datasets/overview"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Datasets documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
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
        />
      </PageLayout.TopArea>

      <DatasetsList
        datasets={datasets}
        experiments={experiments}
        reviewByDataset={reviewByDataset}
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

      <CreateDatasetDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </PageLayout>
  );
}
