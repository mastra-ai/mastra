import type { DatasetRecord } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useDatasets, useDatasetsByIds } from '@mastra/react/hooks/datasets';
import { useExperimentsListMetrics, useInfiniteExperiments } from '@mastra/react/hooks/experiments';
import type { ExperimentListMetrics } from '@mastra/react/hooks/experiments';
import { useReviewSummary } from '@mastra/react/hooks/review';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
import {
  ExperimentsList,
  ExperimentsToolbar,
  getExperimentDatasetOptions,
  NoExperimentsInfo,
} from '@/domains/experiments';
import { MAX_COMPARED_EXPERIMENTS } from '@/domains/experiments/components/comparison/constants';
import type { ExperimentsFilters } from '@/domains/experiments/components/experiments-filter-bar';
import { navCrumb } from '@/domains/navigation/crumbs';
import { buildReviewByExperimentMap } from '@/domains/review/review-maps';
import {
  TARGET_ID_PARAM,
  TARGET_TYPE_PARAM,
  useTargetFilterParams,
} from '@/domains/shared/hooks/use-target-filter-params';

const crumbs = [navCrumb('/experiments')];
const EXPERIMENTS_SORT_KEYS = ['createdAt', 'status'] as const;
const NO_METRICS = new Map<string, ExperimentListMetrics>();

export default function Experiments() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [selectedExperimentIds, setSelectedExperimentIds] = useState<string[]>([]);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { sort, onSortChange } = useUrlSort({ searchParams, setSearchParams, allowedKeys: EXPERIMENTS_SORT_KEYS });
  const orderBy = useMemo(
    () =>
      sort
        ? { field: sort.key, direction: sort.direction === 'asc' ? ('ASC' as const) : ('DESC' as const) }
        : undefined,
    [sort],
  );

  const datasetFilter = searchParams.get('dataset') ?? 'all';
  const { targetType, targetId } = useTargetFilterParams();

  const handleFiltersChange = (next: ExperimentsFilters) => {
    setSearch(next.search);
    setStatusFilter(next.statusFilter);
    // Single URL update: consecutive functional setSearchParams calls would overwrite each other.
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev);
        const setOrDelete = (key: string, value: string) => {
          if (value) params.set(key, value);
          else params.delete(key);
        };
        setOrDelete('dataset', next.datasetFilter === 'all' ? '' : next.datasetFilter);
        setOrDelete(TARGET_TYPE_PARAM, next.targetType);
        // A target id only makes sense within its type.
        setOrDelete(TARGET_ID_PARAM, next.targetType === targetType ? next.targetId : '');
        return params;
      },
      { replace: true },
    );
  };

  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useDatasets();
  const {
    data: experimentsData,
    isLoading: isLoadingExperiments,
    error: errorExperiments,
    isFetchingNextPage,
    hasNextPage,
    setEndOfListElement,
  } = useInfiniteExperiments({
    datasetId: datasetFilter === 'all' ? undefined : datasetFilter,
    target: { targetType, targetId },
    orderBy: orderBy,
  });
  const { data: reviewSummary } = useReviewSummary();
  const { supportsMetrics } = useObservabilityStorageCapabilities();

  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);
  const experiments = useMemo(() => experimentsData ?? [], [experimentsData]);
  const experimentDatasetOptions = useMemo(() => getExperimentDatasetOptions(datasets), [datasets]);

  // The datasets page above only holds the first page; name the datasets of every loaded experiment too.
  const experimentDatasetIds = useMemo(
    () => experiments.flatMap(exp => (exp.datasetId ? [exp.datasetId] : [])),
    [experiments],
  );
  const { data: experimentDatasets } = useDatasetsByIds({ datasetIds: experimentDatasetIds });
  const namedDatasets = useMemo(() => {
    const byId = new Map<string, DatasetRecord>(datasets.map(dataset => [dataset.id, dataset]));
    experimentDatasets?.forEach(dataset => byId.set(dataset.id, dataset));
    return [...byId.values()];
  }, [datasets, experimentDatasets]);

  const { data: experimentMetrics } = useExperimentsListMetrics({ experiments, supportsMetrics });
  const metricsByExperiment = supportsMetrics ? (experimentMetrics ?? NO_METRICS) : undefined;
  const reviewByExperiment = useMemo(() => buildReviewByExperimentMap(reviewSummary), [reviewSummary]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorExperiments || errorDatasets;

  // At the cap: keep the earlier picks (the first is the baseline), replace the most recent one.
  const toggleExperimentSelection = (experimentId: string) => {
    const knownIds = new Set(experiments.map(exp => exp.id));
    setSelectedExperimentIds(current => {
      // Drop ids whose experiment disappeared so they don't occupy a compare slot.
      const prev = current.filter(id => knownIds.has(id));
      if (prev.includes(experimentId)) return prev.filter(id => id !== experimentId);
      if (prev.length >= MAX_COMPARED_EXPERIMENTS)
        return [...prev.slice(0, MAX_COMPARED_EXPERIMENTS - 1), experimentId];
      return [...prev, experimentId];
    });
  };

  // Any selection clears; otherwise pick the listed experiments sharing the first one's dataset, up to the cap.
  const toggleAllExperiments = (visibleExperimentIds: string[]) => {
    const datasetByExperimentId = new Map(experiments.map(exp => [exp.id, exp.datasetId]));
    const datasetId = datasetByExperimentId.get(visibleExperimentIds[0]);
    setSelectedExperimentIds(current =>
      current.length > 0
        ? []
        : visibleExperimentIds
            .filter(id => datasetByExperimentId.get(id) === datasetId)
            .slice(0, MAX_COMPARED_EXPERIMENTS),
    );
  };

  // Ignore ids whose experiment disappeared from the list (e.g. after a refetch).
  const { selectedIds, selectedDatasetIds } = useMemo(() => {
    const datasetByExperimentId = new Map(experiments.map(exp => [exp.id, exp.datasetId]));
    const ids = selectedExperimentIds.filter(id => datasetByExperimentId.has(id));
    return { selectedIds: ids, selectedDatasetIds: new Set(ids.map(id => datasetByExperimentId.get(id))) };
  }, [experiments, selectedExperimentIds]);
  // The first pick is the baseline, so its dataset decides which experiments can join the comparison.
  const comparableDatasetId = experiments.find(exp => exp.id === selectedIds[0])?.datasetId ?? undefined;
  const comparableDataset = comparableDatasetId
    ? {
        id: comparableDatasetId,
        name: namedDatasets.find(ds => ds.id === comparableDatasetId)?.name ?? comparableDatasetId,
      }
    : undefined;
  const compareDisabledReason =
    selectedIds.length < 2
      ? 'Select at least two experiments to compare'
      : selectedDatasetIds.size !== 1
        ? 'Only experiments from the same dataset can be compared'
        : undefined;

  const executeCompare = () => {
    if (selectedIds.length < 2 || compareDisabledReason) return;
    const [baseline, ...contenders] = selectedIds;
    const [dataset] = selectedDatasetIds;
    if (!dataset) return;
    const query = new URLSearchParams({ dataset, baseline });
    for (const contender of contenders) query.append('contender', contender);
    void navigate(`/experiments/compare?${query.toString()}`);
  };

  if (error && is401UnauthorizedError(error)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Experiments</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (errorExperiments && is403ForbiddenError(errorExperiments)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Experiments</h1>
        <PermissionDenied variant="fill" resource="experiments" />
      </PageLayout>
    );
  }

  if (errorDatasets && is403ForbiddenError(errorDatasets)) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Experiments</h1>
        <PermissionDenied variant="fill" resource="datasets" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Experiments</h1>
        <EmptyState
          tone="error"
          variant="fill"
          titleSlot="Failed to load experiments"
          descriptionSlot={error.message}
        />
      </PageLayout>
    );
  }

  const runDialog = (
    <ExperimentTriggerDialog
      open={runDialogOpen}
      onOpenChange={setRunDialogOpen}
      onSuccess={experimentId => void navigate(`/experiments/${experimentId}`)}
    />
  );

  // With a dataset or target filter active, keep the toolbar so the user can remove it.
  if (experiments.length === 0 && !isLoading && datasetFilter === 'all' && !targetType) {
    return (
      <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Experiments</h1>
        <NoExperimentsInfo onRunExperiment={() => setRunDialogOpen(true)} />
        {runDialog}
      </PageLayout>
    );
  }

  return (
    <PageLayout
      breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
      headerActions={
        <Button variant="primary" size="sm" icon={<Plus />} onClick={() => setRunDialogOpen(true)}>
          New experiment
        </Button>
      }
      actionRow={
        <ExperimentsToolbar
          search={search}
          statusFilter={statusFilter}
          datasetFilter={datasetFilter}
          datasetOptions={experimentDatasetOptions}
          targetType={targetType}
          targetId={targetId}
          onFiltersChange={handleFiltersChange}
          selection={{
            selectedCount: selectedIds.length,
            onClearSelection: () => setSelectedExperimentIds([]),
            onCompare: executeCompare,
            compareDisabledReason,
          }}
          comparableDataset={comparableDataset}
        />
      }
    >
      <h1 className="sr-only">Experiments</h1>
      <ExperimentsList
        experiments={experiments}
        datasets={namedDatasets}
        reviewByExperiment={reviewByExperiment}
        metricsByExperiment={metricsByExperiment}
        isLoading={isLoading}
        search={search}
        statusFilter={statusFilter}
        datasetFilter={datasetFilter}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        sort={sort}
        onSortChange={onSortChange}
        selection={{
          selectedExperimentIds: selectedIds,
          onToggleSelection: toggleExperimentSelection,
          onToggleAll: toggleAllExperiments,
          comparableDatasetId,
        }}
      />

      {runDialog}
    </PageLayout>
  );
}
