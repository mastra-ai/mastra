import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useTraceQueryAvailable } from '@mastra/playground-ui/domains/capabilities';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useDatasetExperiment, useDatasetExperimentResults, useExperiment } from '@mastra/react/hooks/datasets';
import { useExperimentMetrics } from '@mastra/react/hooks/experiments';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { useObservabilityStorageCapabilities } from '@/domains/configuration/hooks/use-observability-storage-capabilities';
import { DeleteExperimentDialog } from '@/domains/experiments/components/delete-experiment-dialog';
import { ExperimentHeaderActions } from '@/domains/experiments/components/experiment-header-actions';
import { ExperimentItemSidePanel } from '@/domains/experiments/components/experiment-item-side-panel';
import { ExperimentKpis } from '@/domains/experiments/components/experiment-kpis';
import { ExperimentResultsBulkActions } from '@/domains/experiments/components/experiment-results-bulk-actions';
import { ExperimentResultsSection } from '@/domains/experiments/components/experiment-results-section';
import { ExperimentRunProgress } from '@/domains/experiments/components/experiment-run-progress';
import { ExperimentItemPanelProvider } from '@/domains/experiments/context/experiment-item-panel-context';
import {
  ExperimentCrumb,
  ExperimentCrumbItemCount,
  ExperimentCrumbStatusIcon,
} from '@/domains/experiments/experiment-crumb';
import { useExperimentResultsSelection } from '@/domains/experiments/hooks/use-experiment-results-selection';
import { navCrumb } from '@/domains/navigation/crumbs';
import type { CrumbDef } from '@/domains/navigation/crumbs';

// Stable fallback so the selection hook's memoised filters don't churn while results load.
const EMPTY_RESULTS: never[] = [];

function ExperimentPageShell({ crumbs, children }: { crumbs: CrumbDef[]; children?: ReactNode }) {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
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
          <Button render={<Link to="/experiments" />} icon={<ArrowLeft />}>
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
    <ExperimentItemPanelProvider
      experimentId={experimentId}
      datasetId={datasetId}
      experimentStatus={experiment.status}
      results={results ?? []}
      isLoadingResults={resultsLoading}
      hasNextPage={hasNextPage}
    >
      <div className="h-full">
        <PageLayout
          breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}
          headerActions={
            <ExperimentHeaderActions experiment={experiment} onDeleteClick={() => setDeleteDialogOpen(true)} />
          }
        >
          <h1 className="sr-only">{experimentId}</h1>
          {isSettled ? (
            <div className="grid content-start gap-4">
              <ExperimentKpis experiment={experiment} metrics={experimentMetrics} />
              <div className="grid content-start gap-1">
                <ExperimentResultsBulkActions selection={selection} />
                <ExperimentResultsSection
                  experimentId={experimentId}
                  experimentStatus={experiment.status}
                  results={results ?? []}
                  isLoading={resultsLoading}
                  setEndOfListElement={setEndOfListElement}
                  isFetchingNextPage={isFetchingNextPage}
                  hasNextPage={hasNextPage}
                  selectedIds={selection.selectedIds}
                  onToggleSelect={selection.toggleSelect}
                  onToggleSelectAll={selection.toggleSelectAll}
                  supportsMetrics={supportsMetrics}
                />
              </div>
            </div>
          ) : (
            <ExperimentRunProgress experiment={experiment} />
          )}
        </PageLayout>

        {/* Item detail in the route side panel (drawer on mobile); the `items/:itemId` child route only carries the selected item. */}
        <ExperimentItemSidePanel withQueryTrace={traceQuery.enabled} withFeedback={traceQuery.enabled} />

        <DeleteExperimentDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          experimentId={experimentId}
          experimentName={experiment.name ?? undefined}
          onSuccess={() => navigate('/experiments')}
        />
      </div>
    </ExperimentItemPanelProvider>
  );
}

export { ExperimentPage };
export default ExperimentPage;
