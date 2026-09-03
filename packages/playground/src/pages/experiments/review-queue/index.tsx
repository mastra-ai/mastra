import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ClipboardCheck } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ExperimentCombobox } from '@/domains/experiments/components/experiment-combobox';
import { useExperimentsForDatasetFilter } from '@/domains/experiments/hooks/use-experiments-for-dataset-filter';
import { DatasetReview } from '@/domains/review/components/dataset-review';

/**
 * Single review queue across the project, scoped by experiment. `?experiment=<id>`
 * selects the experiment; `?review=<resultId>` features one of its results.
 */
function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('experiment');
  const featuredResultId = searchParams.get('review');

  const { data, isLoading, error } = useExperimentsForDatasetFilter(undefined);
  const selected = data?.experiments.find(experiment => experiment.id === selectedId);
  // An experiment with no dataset has nothing to review; treat it as no selection.
  const datasetId = selected?.datasetId ?? null;

  const selectExperiment = (experimentId: string) => {
    // Changing experiment drops `review`: the featured result belongs to the previous one.
    setSearchParams(experimentId ? { experiment: experimentId } : {}, { replace: true });
  };

  if (error && is401UnauthorizedError(error)) {
    return (
      <NoDataPageLayout>
        <SessionExpired />
      </NoDataPageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <NoDataPageLayout>
        <PermissionDenied resource="experiments" />
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

  const combobox = <ExperimentCombobox value={selected?.id} onValueChange={selectExperiment} className="w-80" />;

  if (!selected || !datasetId) {
    return (
      <NoDataPageLayout>
        {isLoading ? null : (
          <EmptyState
            iconSlot={<ClipboardCheck />}
            titleSlot="No experiment selected"
            descriptionSlot="Select an experiment to review its queue"
            actionSlot={combobox}
          />
        )}
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column className="justify-items-start">{combobox}</PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <PageLayout.MainArea className="overflow-visible">
        <DatasetReview
          key={selected.id}
          datasetId={datasetId}
          experimentId={selected.id}
          featuredItemId={featuredResultId}
          detailPanelVariant="overlay"
        />
      </PageLayout.MainArea>
    </PageLayout>
  );
}

export { ReviewQueuePage };
export default ReviewQueuePage;
