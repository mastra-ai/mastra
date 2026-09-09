import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowUpRight } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ALL_EXPERIMENTS, ExperimentCombobox } from '@/domains/experiments/components/experiment-combobox';
import { useExperimentsForDatasetFilter } from '@/domains/experiments/hooks/use-experiments-for-dataset-filter';
import { DatasetReview } from '@/domains/review/components/dataset-review';
import { useLinkComponent } from '@/lib/framework';

/**
 * Single review queue across the project. Lists every item awaiting review by default;
 * `?experiment=<id>` narrows it to one experiment and `?review=<resultId>` features one of its results.
 */
function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('experiment');
  const featuredResultId = searchParams.get('review');

  const { Link, paths } = useLinkComponent();
  const { data, error } = useExperimentsForDatasetFilter(undefined);
  const selected = data?.experiments.find(experiment => experiment.id === selectedId);

  const selectExperiment = (experimentId: string) => {
    // Changing the filter drops `review`: the featured result belongs to the previous scope.
    setSearchParams(experimentId === ALL_EXPERIMENTS ? {} : { experiment: experimentId }, { replace: true });
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

  return (
    <PageLayout height="full">
      <DatasetReview
        key={selectedId ?? ALL_EXPERIMENTS}
        datasetId={selected?.datasetId ?? undefined}
        experimentId={selectedId ?? undefined}
        featuredItemId={featuredResultId}
        detailPanelVariant="overlay"
        toolbarStart={
          <ExperimentCombobox
            allOption
            value={selectedId ?? undefined}
            onValueChange={selectExperiment}
            className="w-72"
          />
        }
        toolbarEnd={
          selectedId ? (
            <Button as={Link} href={paths.experimentLink(selectedId)}>
              See experiment
              <ArrowUpRight />
            </Button>
          ) : undefined
        }
      />
    </PageLayout>
  );
}

export { ReviewQueuePage };
export default ReviewQueuePage;
