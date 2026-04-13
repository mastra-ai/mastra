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
import { BookIcon, FlaskConical } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import {
  ExperimentsList,
  ExperimentsToolbar,
  getExperimentDatasetOptions,
  NoExperimentsInfo,
} from '@/domains/experiments';
import { useReviewSummary } from '@/domains/review';
import { buildReviewByExperimentMap } from '@/domains/review/review-maps';

export default function Experiments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [datasetFilter, setDatasetFilter] = useState('all');

  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useDatasets();
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();
  const { data: reviewSummary } = useReviewSummary();

  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);
  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const experimentDatasetOptions = useMemo(() => getExperimentDatasetOptions(datasets), [datasets]);
  const reviewByExperiment = useMemo(() => buildReviewByExperimentMap(reviewSummary), [reviewSummary]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorExperiments || errorDatasets;

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout title="Experiments" icon={<FlaskConical />}>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (errorExperiments && is403ForbiddenError(errorExperiments)) {
    return (
      <NoDataPageLayout title="Experiments" icon={<FlaskConical />}>
        <PermissionDenied resource="experiments" />
      </NoDataPageLayout>
    );
  }

  if (errorDatasets && is403ForbiddenError(errorDatasets)) {
    return (
      <NoDataPageLayout title="Experiments" icon={<FlaskConical />}>
        <PermissionDenied resource="datasets" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout title="Experiments" icon={<FlaskConical />}>
        <ErrorState title="Failed to load experiments" message={error.message} />
      </NoDataPageLayout>
    );
  }

  if (experiments.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout title="Experiments" icon={<FlaskConical />}>
        <NoExperimentsInfo />
      </NoDataPageLayout>
    );
  }

  const hasFilters = statusFilter !== 'all' || datasetFilter !== 'all' || search !== '';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setDatasetFilter('all');
  };

  return (
    <PageLayout>
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column>
            <PageHeader>
              <PageHeader.Title isLoading={isLoading}>
                <FlaskConical /> Experiments
              </PageHeader.Title>
            </PageHeader>
          </PageLayout.Column>
          <PageLayout.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/evals/datasets/running-experiments"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Experiments documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </PageLayout.Column>
        </PageLayout.Row>
        <ExperimentsToolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          datasetFilter={datasetFilter}
          onDatasetFilterChange={setDatasetFilter}
          datasetOptions={experimentDatasetOptions}
          onReset={resetFilters}
          hasActiveFilters={hasFilters}
        />
      </PageLayout.TopArea>

      <ExperimentsList
        experiments={experiments}
        datasets={datasets}
        reviewByExperiment={reviewByExperiment}
        isLoading={isLoading}
        search={search}
        statusFilter={statusFilter}
        datasetFilter={datasetFilter}
      />
    </PageLayout>
  );
}
