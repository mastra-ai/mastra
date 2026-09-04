import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { QueryError } from '@mastra/playground-ui/components/QueryError';
import { useSearchParams } from 'react-router';
import { ALL_EXPERIMENTS, ExperimentCombobox } from '@/domains/experiments/components/experiment-combobox';
import { useExperimentsForDatasetFilter } from '@/domains/experiments/hooks/use-experiments-for-dataset-filter';
import { DatasetReview } from '@/domains/review/components/dataset-review';

/**
 * Single review queue across the project. Lists every item awaiting review by default;
 * `?experiment=<id>` narrows it to one experiment and `?review=<resultId>` features one of its results.
 */
function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('experiment');
  const featuredResultId = searchParams.get('review');

  const { data, error } = useExperimentsForDatasetFilter(undefined);
  const selected = data?.experiments.find(experiment => experiment.id === selectedId);

  const selectExperiment = (experimentId: string) => {
    // Changing the filter drops `review`: the featured result belongs to the previous scope.
    setSearchParams(experimentId === ALL_EXPERIMENTS ? {} : { experiment: experimentId }, { replace: true });
  };

  if (error) {
    return (
      <NoDataPageLayout>
        <QueryError error={error} resource="experiments" title="Failed to load experiments" />
      </NoDataPageLayout>
    );
  }

  return (
    <PageLayout height="full">
      <PageLayout.TopArea>
        <PageLayout.Row>
          <PageLayout.Column className="justify-items-start">
            <ExperimentCombobox
              allOption
              value={selectedId ?? undefined}
              onValueChange={selectExperiment}
              className="w-80"
            />
          </PageLayout.Column>
        </PageLayout.Row>
      </PageLayout.TopArea>

      <PageLayout.MainArea className="overflow-visible">
        <DatasetReview
          key={selectedId ?? ALL_EXPERIMENTS}
          datasetId={selected?.datasetId ?? undefined}
          experimentId={selectedId ?? undefined}
          featuredItemId={featuredResultId}
          detailPanelVariant="overlay"
        />
      </PageLayout.MainArea>
    </PageLayout>
  );
}

export { ReviewQueuePage };
export default ReviewQueuePage;
