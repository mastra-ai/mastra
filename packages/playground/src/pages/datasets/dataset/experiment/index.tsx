import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { ArrowLeft, PlayCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import { useDatasetExperiment, useDatasetExperimentResults } from '@/domains/datasets/hooks/use-dataset-experiments';
import { ExperimentPageTabs } from '@/domains/experiments/components/experiment-page-tabs';
import { ExperimentTopArea } from '@/domains/experiments/components/experiment-top-area';

function ExperimentPageShell({ children }: { children?: ReactNode }) {
  return (
    <PageLayout height="full">
      <div />
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}

function DatasetExperimentPage() {
  const { datasetId, experimentId } = useParams<{ datasetId: string; experimentId: string }>();

  const {
    data: experiment,
    isLoading: experimentLoading,
    error: experimentError,
  } = useDatasetExperiment(datasetId!, experimentId!);

  const {
    data: results,
    isLoading: resultsLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetExperimentResults({
    datasetId: datasetId!,
    experimentId: experimentId!,
    experimentStatus: experiment?.status,
  });

  if (!datasetId || !experimentId) return null;
  if (experimentLoading) return null; // Avoid layout shift on initial load

  if (experimentError && is401UnauthorizedError(experimentError)) {
    return (
      <ExperimentPageShell>
        <SessionExpired />
      </ExperimentPageShell>
    );
  }

  if (experimentError && is403ForbiddenError(experimentError)) {
    return (
      <ExperimentPageShell>
        <PermissionDenied resource="datasets" />
      </ExperimentPageShell>
    );
  }

  if (
    (experimentError && is404NotFoundError(experimentError)) ||
    (!experimentLoading && !experimentError && !experiment)
  ) {
    return (
      <ExperimentPageShell>
        <EmptyState
          iconSlot={<PlayCircle />}
          titleSlot="Experiment not found"
          descriptionSlot={`No experiment with id "${experimentId}".`}
          actionSlot={
            <Button as={Link} to={`/datasets/${datasetId}?tab=experiments`}>
              <ArrowLeft />
              Back to Dataset
            </Button>
          }
        />
      </ExperimentPageShell>
    );
  }

  if (experimentError) {
    return (
      <ExperimentPageShell>
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

  return (
    <PageLayout height="full">
      <ExperimentTopArea experiment={experiment!} />

      <PageLayout.MainArea>
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
  );
}

export { DatasetExperimentPage };
export default DatasetExperimentPage;
