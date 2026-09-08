import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
import { useDatasets } from '@/domains/datasets/hooks/use-datasets';
import {
  ExperimentsList,
  ExperimentsToolbar,
  getExperimentDatasetOptions,
  NoExperimentsInfo,
} from '@/domains/experiments';
import { useExperimentsForDatasetFilter } from '@/domains/experiments/hooks/use-experiments-for-dataset-filter';
import { useReviewSummary } from '@/domains/review';
import { buildReviewByExperimentMap } from '@/domains/review/review-maps';

export default function Experiments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const datasetFilter = searchParams.get('dataset') ?? 'all';
  const setDatasetFilter = useCallback(
    (value: string) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev);
          if (value === 'all') {
            next.delete('dataset');
          } else {
            next.set('dataset', value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useDatasets();
  const {
    data: experimentsData,
    isLoading: isLoadingExperiments,
    error: errorExperiments,
  } = useExperimentsForDatasetFilter(datasetFilter === 'all' ? undefined : datasetFilter);
  const { data: reviewSummary } = useReviewSummary();

  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);
  const experiments = useMemo(() => experimentsData?.experiments ?? [], [experimentsData?.experiments]);
  const experimentDatasetOptions = useMemo(() => getExperimentDatasetOptions(datasets), [datasets]);
  const reviewByExperiment = useMemo(() => buildReviewByExperimentMap(reviewSummary), [reviewSummary]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorExperiments || errorDatasets;

  // Max 2 selected: keep the oldest pick, replace the most recent one.
  const toggleExperimentSelection = (experimentId: string) => {
    setSelectedExperimentIds(prev => {
      if (prev.includes(experimentId)) return prev.filter(id => id !== experimentId);
      if (prev.length >= 2) return [prev[0], experimentId];
      return [...prev, experimentId];
    });
  };

  const cancelSelection = () => {
    setSelectedExperimentIds([]);
    setIsSelectionActive(false);
  };

  // Ignore ids whose experiment disappeared from the list (e.g. after a refetch).
  const { selectedIds, selectedDatasetIds } = useMemo(() => {
    const datasetByExperimentId = new Map(experiments.map(exp => [exp.id, exp.datasetId]));
    const ids = selectedExperimentIds.filter(id => datasetByExperimentId.has(id));
    return { selectedIds: ids, selectedDatasetIds: new Set(ids.map(id => datasetByExperimentId.get(id))) };
  }, [experiments, selectedExperimentIds]);
  const compareDisabledReason =
    selectedIds.length === 2 && selectedDatasetIds.size !== 1
      ? 'experiments must belong to the same dataset'
      : undefined;

  const executeCompare = () => {
    if (selectedIds.length !== 2 || compareDisabledReason) return;
    const [baseline, contender] = selectedIds;
    const [dataset] = selectedDatasetIds;
    if (!dataset) return;
    const query = new URLSearchParams({ dataset, baseline, contender });
    void navigate(`/experiments/compare?${query.toString()}`);
  };

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (errorExperiments && is403ForbiddenError(errorExperiments)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="experiments" />
      </NoDataPageLayout>
    );
  }

  if (errorDatasets && is403ForbiddenError(errorDatasets)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="datasets" />
      </NoDataPageLayout>
    );
  }

  if (error) {
    return (
      <NoDataPageLayout>
        <ErrorState title="Failed to load experiments" message={error.message} />
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

  // With a dataset filter active, keep the toolbar so the user can reset it.
  if (experiments.length === 0 && !isLoading && datasetFilter === 'all') {
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
    <PageLayout height="full">
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
          onCompareClick={() => setIsSelectionActive(true)}
          selection={
            isSelectionActive
              ? {
                  selectedCount: selectedIds.length,
                  onExecuteCompare: executeCompare,
                  onCancelSelection: cancelSelection,
                  compareDisabledReason,
                }
              : undefined
          }
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
        selection={
          isSelectionActive
            ? { selectedExperimentIds: selectedIds, onToggleSelection: toggleExperimentSelection }
            : undefined
        }
      />

      {runDialog}
    </PageLayout>
  );
}
