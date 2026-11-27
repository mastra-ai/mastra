import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useTraceQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import {
  DeleteExperimentDialog,
  ExperimentHeaderActions,
  ExperimentKpis,
  ExperimentResultsSection,
} from '@mastra/playground-ui/domains/experiments';
import { ExperimentResultsBulkActions } from '@mastra/playground-ui/domains/experiments/components/experiment-results-bulk-actions';
import { ExperimentRunProgress } from '@mastra/playground-ui/domains/experiments/components/experiment-run-progress';
import { IconArrowLeft } from '@mastra/playground-ui/icons/central/IconArrowLeft';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import {
  useDatasetExperiment,
  useDatasetExperimentResults,
  useDatasetMutations,
  useExperiment,
  useScoresByExperimentId,
} from '@mastra/react/hooks/datasets';
import { useExperimentMetrics, useExperimentsItemUsage } from '@mastra/react/hooks/experiments';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';
import { ExperimentItemSidePanel } from '@/domains/experiments/components/experiment-item-side-panel';
import { RerunExperimentButton } from '@/domains/experiments/components/rerun-experiment-button';
import { ExperimentRouteItemPanelProvider } from '@/domains/experiments/context/experiment-route-item-panel-provider';
import {
  ExperimentCrumb,
  ExperimentCrumbItemCount,
  ExperimentCrumbStatusIcon,
} from '@/domains/experiments/experiment-crumb';
import { useExperimentResultsSelection } from '@/domains/experiments/hooks/use-experiment-results-selection';
import { useRenameExperiment } from '@/domains/experiments/hooks/use-rename-experiment';
import { navCrumb } from '@/domains/navigation/crumbs';
import type { CrumbDef } from '@/domains/navigation/crumbs';

// Stable fallback so the selection hook's memoised filters don't churn while results load.
const EMPTY_RESULTS: never[] = [];

function ExperimentPageShell({ crumbs, children }: { crumbs: CrumbDef[]; children?: ReactNode }) {
  return (
    <PageLayout variant="page" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Experiment</h1>
      <div />
      <div className="flex h-full items-center justify-center">{children}</div>
    </PageLayout>
  );
}

function ExperimentPage() {
  const { experimentId } = useParams<{ experimentId: string }>();
  // The selected item shows in the side panel, so it gets no crumb of its own.
  const crumbs: CrumbDef[] = [
    navCrumb('/experiments'),
    { id: 'experiment', Component: ExperimentCrumb, icon: ExperimentCrumbStatusIcon, Action: ExperimentCrumbItemCount },
  ];
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { deleteExperiment } = useDatasetMutations();
  // Servers without the trace-query API don't expose feedback either.
  const traceQuery = useTraceQueryAvailable();

  // Resolve datasetId from experimentId (the URL has only the experiment id).
  const {
    data: resolvedExperiment,
    isLoading: resolvedExperimentLoading,
    error: resolveError,
  } = useExperiment({ experimentId: experimentId ?? '', queryOptions: { enabled: Boolean(experimentId) } });
  const datasetId = resolvedExperiment?.datasetId ?? '';

  const {
    data: experiment,
    isLoading: experimentLoading,
    error: datasetExperimentError,
  } = useDatasetExperiment({
    datasetId: datasetId,
    experimentId: experimentId ?? '',
    queryOptions: { enabled: Boolean(datasetId) && Boolean(experimentId) },
  });

  // Results and metrics stay unfetched until the run settles; meanwhile the page shows its progress only.
  const isSettled = experiment?.status === 'completed' || experiment?.status === 'failed';

  const {
    data: results,
    isLoading: resultsLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetExperimentResults({
    datasetId,
    experimentId: experimentId ?? '',
    experimentStatus: experiment?.status,
    queryOptions: { enabled: Boolean(datasetId) && Boolean(experimentId) && isSettled },
  });

  const { supportsMetrics } = useObservabilityStorageCapabilities();
  const experimentMetrics = useExperimentMetrics({
    experimentId,
    experimentStatus: experiment?.status,
    supportsMetrics,
    queryOptions: { enabled: Boolean(experimentId) && supportsMetrics && isSettled },
  });

  // Shared by the KPIs, the results and the item panel.
  const { data: scoresByItemId } = useScoresByExperimentId({
    experimentId: experimentId ?? '',
    experimentStatus: experiment?.status,
    queryOptions: { enabled: Boolean(experimentId) && isSettled },
  });
  // Usage polling gives up after a few empty reads, so wait until the run is known to be over.
  const { data: usageByExperimentId, isLoading: isUsageLoading } = useExperimentsItemUsage({
    experiments: experimentId && isSettled ? [{ id: experimentId, status: experiment?.status }] : [],
    supportsMetrics,
  });
  const usage = experimentId ? usageByExperimentId[experimentId] : undefined;

  const renameHandlerFor = useRenameExperiment();

  const selection = useExperimentResultsSelection({
    datasetId,
    experimentId: experimentId ?? '',
    results: results ?? EMPTY_RESULTS,
  });

  const experimentError = resolveError ?? datasetExperimentError;

  if (!experimentId) return null;
  if (resolvedExperimentLoading || experimentLoading) return null; // Avoid layout shift on initial load

  if (experimentError && is401UnauthorizedError(experimentError)) {
    return (
      <ExperimentPageShell crumbs={crumbs}>
        <SessionExpired />
      </ExperimentPageShell>
    );
  }

  if (experimentError && is403ForbiddenError(experimentError)) {
    return (
      <ExperimentPageShell crumbs={crumbs}>
        <PermissionDenied resource="datasets" />
      </ExperimentPageShell>
    );
  }

  const notFound = (
    <ExperimentPageShell crumbs={crumbs}>
      <EmptyState
        titleSlot="Experiment not found"
        descriptionSlot={`No experiment with id "${experimentId}".`}
        actionSlot={
          <Button render={<Link to="/experiments" />} icon={<IconArrowLeft />}>
            Back to experiments
          </Button>
        }
      />
    </ExperimentPageShell>
  );

  if (experimentError && is404NotFoundError(experimentError)) return notFound;

  if (experimentError) {
    return (
      <ExperimentPageShell crumbs={crumbs}>
        <EmptyState
          tone="error"
          titleSlot="Failed to load experiment"
          descriptionSlot={
            experimentError instanceof Error
              ? experimentError.message
              : 'An unexpected error occurred. Please try again.'
          }
        />
      </ExperimentPageShell>
    );
  }

  // Not found: the experiment has no dataset (orphaned by dataset deletion), or the fetch resolved empty.
  if (!datasetId || !experiment) return notFound;

  return (
    <ExperimentRouteItemPanelProvider
      experimentId={experimentId}
      datasetId={datasetId}
      experimentStatus={experiment.status}
      results={results ?? []}
      isLoadingResults={resultsLoading}
      hasNextPage={hasNextPage}
    >
      <div className="h-full">
        <PageLayout
          variant="page"
          breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
          headerActions={
            <ExperimentHeaderActions
              experiment={experiment}
              rerunSlot={<RerunExperimentButton experiment={experiment} />}
              onRename={renameHandlerFor(experiment)}
              onDeleteClick={() => setDeleteDialogOpen(true)}
            />
          }
        >
          <h1 className="sr-only">{experimentId}</h1>
          {isSettled ? (
            <div className="grid content-start gap-6">
              <ExperimentKpis
                experiment={experiment}
                metrics={experimentMetrics}
                scoresByItemId={scoresByItemId}
                usage={usage?.summary}
                isUsageLoading={isUsageLoading}
              />
              <div className="grid content-start gap-1">
                <ExperimentResultsBulkActions
                  selectedResults={selection.selectedResults}
                  onClearSelection={selection.clearSelection}
                  onRequestReview={selection.flagSelectedForReview}
                  isRequestingReview={selection.isFlagging}
                  onAddTag={selection.addTagToSelected}
                  isTagging={selection.isTagging}
                  tagVocabulary={selection.tagVocabulary}
                />
                <ExperimentResultsSection
                  results={results ?? []}
                  isLoading={resultsLoading}
                  setEndOfListElement={setEndOfListElement}
                  isFetchingNextPage={isFetchingNextPage}
                  hasNextPage={hasNextPage}
                  selectedIds={selection.selectedIds}
                  onToggleSelect={selection.toggleSelect}
                  onToggleSelectAll={selection.toggleSelectAll}
                  supportsMetrics={supportsMetrics}
                  scoresByItemId={scoresByItemId}
                  usageByTraceId={usage?.traces}
                />
              </div>
            </div>
          ) : (
            <ExperimentRunProgress experiment={experiment} />
          )}
        </PageLayout>

        {/* Item detail in the route side panel (drawer on mobile); the `items/:itemId` child route only carries the selected item. */}
        <ExperimentItemSidePanel withFeedback={traceQuery.enabled} />

        <DeleteExperimentDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          experimentId={experimentId}
          experimentName={experiment.name ?? undefined}
          onDelete={async () => {
            await deleteExperiment.mutateAsync(experimentId);
          }}
          onSuccess={() => navigate('/experiments')}
        />
      </div>
    </ExperimentRouteItemPanelProvider>
  );
}

export { ExperimentPage };
export default ExperimentPage;
