import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { useDatasetExperiment, useDatasetExperimentResults } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { ExperimentPageTabs } from '@/domains/experiments/components/experiment-page-tabs';
import { ExperimentTopArea } from '@/domains/experiments/components/experiment-top-area';
import { ExperimentItemPanelProvider } from '@/domains/experiments/context/experiment-item-panel-context';

function ExperimentPageShell({ children }: { children?: ReactNode }) {
  return (
    <PageLayout height="full">
      <div />
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}

function ExperimentPage() {
  const { experimentId } = useParams<{ experimentId: string }>();

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

  if (!experimentId) return null;
  if (experimentsListLoading || experimentLoading) return null; // Avoid layout shift on initial load

  if (experimentError) {
    return (
      <ExperimentPageShell>
        <QueryError error={experimentError} resource="datasets" title="Failed to load experiment" />
      </ExperimentPageShell>
    );
  }

  return (
    <ExperimentItemPanelProvider
      experimentId={experimentId}
      datasetId={datasetId}
      experimentStatus={experiment!.status}
      results={results ?? []}
      isLoadingResults={resultsLoading}
      hasNextPage={hasNextPage}
    >
      <div className="relative h-full overflow-hidden">
        <PageLayout height="full">
          <ExperimentTopArea experiment={experiment!} />

          <PageLayout.MainArea className="overflow-visible">
            <ExperimentPageTabs
              experimentId={experimentId}
              datasetId={datasetId}
              experimentStatus={experiment!.status}
              results={results ?? []}
              isLoading={resultsLoading}
              setEndOfListElement={setEndOfListElement}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
            />
          </PageLayout.MainArea>
        </PageLayout>

        {/* Item detail sub-route renders here as an absolute overlay panel */}
        <Outlet />
      </div>
    </ExperimentItemPanelProvider>
  );
}

export { ExperimentPage };
export default ExperimentPage;
