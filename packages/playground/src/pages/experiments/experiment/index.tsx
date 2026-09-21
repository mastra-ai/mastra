import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { pageHeaderProps } from '@/components/ui/page-header-props';
import { useDatasetExperiment, useDatasetExperimentResults } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { DeleteExperimentDialog } from '@/domains/experiments/components/delete-experiment-dialog';
import { ExperimentItemPanel } from '@/domains/experiments/components/experiment-item-panel';
import { ExperimentResultsBulkActions } from '@/domains/experiments/components/experiment-results-bulk-actions';
import { ExperimentResultsSection } from '@/domains/experiments/components/experiment-results-section';
import { ExperimentSideRail } from '@/domains/experiments/components/experiment-side-rail';
import { ExperimentTopArea } from '@/domains/experiments/components/experiment-top-area';
import { ExperimentItemPanelProvider } from '@/domains/experiments/context/experiment-item-panel-context';
import { ExperimentCrumb, ExperimentCrumbStatusIcon } from '@/domains/experiments/experiment-crumb';
import { useExperimentMetrics } from '@/domains/experiments/hooks/use-experiment-metrics';
import { useExperimentResultsSelection } from '@/domains/experiments/hooks/use-experiment-results-selection';
import { navCrumb, truncateItemIdCrumb, type CrumbDef } from '@/domains/navigation/crumbs';

// Stable fallback so the selection hook's memoised filters don't churn while results load.
const EMPTY_RESULTS: never[] = [];

function ExperimentPageShell({ crumbs, children }: { crumbs: CrumbDef[]; children?: ReactNode }) {
  return (
    <PageLayout {...pageHeaderProps(crumbs)} height="full">
      <div />
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}

function ExperimentPage() {
  const { experimentId, itemId } = useParams<{ experimentId: string; itemId: string }>();
  // The `to` link only renders on the nested items/:itemId route.
  const crumbs: CrumbDef[] = [
    navCrumb('/experiments'),
    {
      id: 'experiment',
      Component: ExperimentCrumb,
      icon: ExperimentCrumbStatusIcon,
      heading: 'Experiment',
      to: experimentId ? `/experiments/${encodeURIComponent(experimentId)}` : undefined,
    },
    ...(itemId
      ? [
          { id: 'experiment-items', label: 'Items' },
          { id: 'experiment-item', label: truncateItemIdCrumb(itemId) },
        ]
      : []),
  ];
  const navigate = useNavigate();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Resolve datasetId from experimentId (the URL has only the experiment id).
  const { data: experimentsData, isLoading: experimentsListLoading } = useExperiments();
  const matchedExperiment = experimentsData?.experiments?.find(e => e.id === experimentId);
  const datasetId = matchedExperiment?.datasetId ?? '';

  const {
    data: experiment,
    isLoading: experimentLoading,
    error: experimentError,
  } = useDatasetExperiment(datasetId, experimentId ?? '');

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
  });

  const experimentMetrics = useExperimentMetrics({ experimentId, experimentStatus: experiment?.status });

  const selection = useExperimentResultsSelection({
    datasetId,
    experimentId: experimentId ?? '',
    results: results ?? EMPTY_RESULTS,
  });

  if (!experimentId) return null;
  if (experimentsListLoading || experimentLoading) return null; // Avoid layout shift on initial load

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
        iconSlot={<PlayCircle />}
        titleSlot="Experiment not found"
        descriptionSlot={`No experiment with id "${experimentId}".`}
        actionSlot={
          <Button render={<Link to="/experiments" />} icon={<ArrowLeft />}>
            Back to Experiments
          </Button>
        }
      />
    </ExperimentPageShell>
  );

  if (experimentError && is404NotFoundError(experimentError)) return notFound;

  if (experimentError) {
    return (
      <ExperimentPageShell crumbs={crumbs}>
        <ErrorState
          title="Failed to load experiment"
          message={
            experimentError instanceof Error
              ? experimentError.message
              : 'An unexpected error occurred. Please try again.'
          }
        />
      </ExperimentPageShell>
    );
  }

  // Not found: the experimentId isn't present in the full experiments listing
  // (so we can't resolve a datasetId for it), or the fetch resolved empty.
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
        <PageLayout {...pageHeaderProps(crumbs)} height="full">
          <ExperimentTopArea experiment={experiment} onDeleteClick={() => setDeleteDialogOpen(true)}>
            <ExperimentResultsBulkActions selection={selection} />
          </ExperimentTopArea>

          {/* Results take the remaining width; the rail keeps the pipeline and run metadata beside them. */}
          <PageLayout.MainArea className="grid grid-cols-[1fr_auto] gap-4 overflow-visible">
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
            />
            <ExperimentSideRail experiment={experiment} metrics={experimentMetrics} className="w-80 overflow-y-auto" />
          </PageLayout.MainArea>
        </PageLayout>

        {/* Item detail drawer; the `items/:itemId` child route only carries the breadcrumb. */}
        <ExperimentItemPanel />

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
