import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useUrlSort } from '@mastra/playground-ui/sort/use-url-sort';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useDatasets } from '@mastra/react/hooks/datasets';
import { useInfiniteExperiments } from '@mastra/react/hooks/experiments';
import { useReviewSummary } from '@mastra/react/hooks/review';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { DatasetViewTabs } from '@/domains/datasets/components/dataset-view-tabs';
import { ExperimentTriggerDialog } from '@/domains/datasets/components/experiment-trigger/experiment-trigger-dialog';
import {
  ExperimentsList,
  ExperimentsToolbar,
  getExperimentDatasetOptions,
  NoExperimentsInfo,
} from '@/domains/experiments';
import { datasetCrumb, navCrumb, type CrumbDef } from '@/domains/navigation/crumbs';
import { buildReviewByExperimentMap } from '@/domains/review/review-maps';
import {
  TARGET_ID_PARAM,
  TARGET_TYPE_PARAM,
  useTargetFilterParams,
} from '@/domains/shared/hooks/use-target-filter-params';

const allExperimentsCrumbs = [navCrumb('/experiments')];

function datasetExperimentsCrumbs(datasetId: string): CrumbDef[] {
  return [
    navCrumb('/datasets'),
    { ...datasetCrumb, to: `/datasets/${encodeURIComponent(datasetId)}` },
    { id: 'dataset-experiments', label: 'Experiments' },
  ];
}
const EXPERIMENTS_SORT_KEYS = ['createdAt', 'status'] as const;

export interface ExperimentsTarget {
  targetType: 'agent' | 'workflow';
  targetId: string;
}

/** Every experiment; a dataset's route or an agent or workflow view shows only the experiments run on it. */
export default function Experiments({ scopedTarget }: { scopedTarget?: ExperimentsTarget } = {}) {
  const { datasetId: openDatasetId } = useParams();
  const crumbs = openDatasetId ? datasetExperimentsCrumbs(openDatasetId) : allExperimentsCrumbs;
  const breadcrumbs = scopedTarget ? undefined : <PageBreadcrumbs crumbs={crumbs} />;
  const datasetViewTabs = openDatasetId && <DatasetViewTabs datasetId={openDatasetId} />;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
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

  const datasetFilterParam = searchParams.get('dataset');
  const datasetFilter = openDatasetId ?? datasetFilterParam ?? 'all';
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

  const targetFilterParams = useTargetFilterParams();
  const { targetType, targetId } = scopedTarget ?? targetFilterParams;

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

  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);
  const experiments = useMemo(() => experimentsData ?? [], [experimentsData]);
  const experimentDatasetOptions = useMemo(() => getExperimentDatasetOptions(datasets), [datasets]);
  const reviewByExperiment = useMemo(() => buildReviewByExperimentMap(reviewSummary), [reviewSummary]);

  const isLoading = isLoadingDatasets || isLoadingExperiments;
  const error = errorExperiments || errorDatasets;

  // Max 2 selected: keep the oldest pick, replace the most recent one.
  const toggleExperimentSelection = (experimentId: string) => {
    const knownIds = new Set(experiments.map(exp => exp.id));
    setSelectedExperimentIds(current => {
      // Drop ids whose experiment disappeared so they don't occupy a compare slot.
      const prev = current.filter(id => knownIds.has(id));
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
    selectedIds.length === 2 && selectedDatasetIds.size !== 1 ? 'not the same dataset' : undefined;

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
      <PageLayout breadcrumbs={breadcrumbs}>
        <h1 className="sr-only">Experiments</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (errorExperiments && is403ForbiddenError(errorExperiments)) {
    return (
      <PageLayout breadcrumbs={breadcrumbs}>
        <h1 className="sr-only">Experiments</h1>
        <PermissionDenied variant="fill" resource="experiments" />
      </PageLayout>
    );
  }

  if (errorDatasets && is403ForbiddenError(errorDatasets)) {
    return (
      <PageLayout breadcrumbs={breadcrumbs}>
        <h1 className="sr-only">Experiments</h1>
        <PermissionDenied variant="fill" resource="datasets" />
      </PageLayout>
    );
  }

  if (error) {
    return (
      <PageLayout breadcrumbs={breadcrumbs}>
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
      initialDatasetId={openDatasetId}
      initialTargetType={scopedTarget?.targetType}
      initialTargetId={scopedTarget?.targetId}
      open={runDialogOpen}
      onOpenChange={setRunDialogOpen}
      onSuccess={experimentId => void navigate(`/experiments/${experimentId}`)}
    />
  );

  // With a dataset or target filter active, keep the toolbar so the user can reset it.
  if (experiments.length === 0 && !isLoading && !datasetFilterParam && !targetFilterParams.targetType) {
    return (
      <PageLayout breadcrumbs={breadcrumbs} actionRow={datasetViewTabs}>
        <h1 className="sr-only">Experiments</h1>
        <NoExperimentsInfo onRunExperiment={() => setRunDialogOpen(true)} />
        {runDialog}
      </PageLayout>
    );
  }

  const hasFilters =
    statusFilter !== 'all' || Boolean(datasetFilterParam) || search !== '' || targetFilterParams.targetType !== '';

  const resetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    // Single URL update: consecutive functional setSearchParams calls would overwrite each other.
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.delete('dataset');
        next.delete(TARGET_TYPE_PARAM);
        next.delete(TARGET_ID_PARAM);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <PageLayout
      variant="catalog"
      breadcrumbs={breadcrumbs}
      actionRow={
        <>
          {datasetViewTabs}
          <ExperimentsToolbar
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            datasetFilter={
              openDatasetId
                ? undefined
                : { value: datasetFilter, onChange: setDatasetFilter, options: experimentDatasetOptions }
            }
            targetFilter={
              scopedTarget
                ? undefined
                : {
                    targetType: targetFilterParams.targetType,
                    onTargetTypeChange: targetFilterParams.setTargetType,
                    targetId: targetFilterParams.targetId,
                    onTargetIdChange: targetFilterParams.setTargetId,
                  }
            }
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
        </>
      }
    >
      <h1 className="sr-only">Experiments</h1>
      <ExperimentsList
        scroll="page"
        experiments={experiments}
        datasets={datasets}
        reviewByExperiment={reviewByExperiment}
        isLoading={isLoading}
        search={search}
        statusFilter={statusFilter}
        datasetFilter={datasetFilter}
        isFetchingNextPage={isFetchingNextPage}
        hasNextPage={hasNextPage}
        setEndOfListElement={setEndOfListElement}
        sort={sort}
        onSortChange={onSortChange}
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
