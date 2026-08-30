import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { isAuthError } from '@mastra/playground-ui/utils/errors';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
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
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const navigate = useNavigate();

  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useDatasets();
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useExperiments();
  const { data: reviewSummary } = useReviewSummary();

  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);
  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const experimentDatasetOptions = useMemo(() => getExperimentDatasetOptions(datasets), [datasets]);
  const reviewByExperiment = useMemo(() => buildReviewByExperimentMap(reviewSummary), [reviewSummary]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorExperiments || errorDatasets;

  if (errorExperiments && isAuthError(errorExperiments)) {
    return (
      <NoDataPageLayout>
        <QueryError error={errorExperiments} resource="experiments" title="Failed to load experiments" />
      </NoDataPageLayout>
    );
  }

  if (errorDatasets && isAuthError(errorDatasets)) {
    return (
      <NoDataPageLayout>
        <QueryError error={errorDatasets} resource="datasets" title="Failed to load datasets" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <QueryError error={error} title="Failed to load experiments" />
      </NoDataPageLayout>
    );
  }

  const runDialog = (
    <ExperimentTriggerDialog
      open={runDialogOpen}
      onOpenChange={setRunDialogOpen}
      onSuccess={experimentId => void navigate(`/experiments/${experimentId}`)}
    />
  );

  if (experiments.length === 0 && !isLoading) {
    return (
      <NoDataPageLayout>
        <NoExperimentsInfo onRunExperiment={() => setRunDialogOpen(true)} />
        {runDialog}
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
          onRunClick={() => setRunDialogOpen(true)}
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

      {runDialog}
    </PageLayout>
  );
}
