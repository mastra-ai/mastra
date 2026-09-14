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
import { TargetFilter } from '@/domains/shared/components/target-filter';
import { useTargetFilterParams } from '@/domains/shared/hooks/use-target-filter-params';
import { useLinkComponent } from '@/lib/framework';

/**
 * Single review queue across the project. Lists every item awaiting review by default;
 * `?targetType=<type>&targetId=<id>` narrows it to one target, `?experiment=<id>` to one
 * experiment and `?review=<resultId>` features one of its results.
 */
function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('experiment');
  const featuredResultId = searchParams.get('review');
  // The selected experiment may fall out of scope when the target changes, so drop it (and `review`).
  const { targetType, targetId, setTargetType, setTargetId } = useTargetFilterParams({
    resetParams: ['experiment', 'review'],
  });

  const { Link, paths } = useLinkComponent();
  const { data, error } = useExperimentsForDatasetFilter(undefined, { targetType, targetId });
  const selected = data?.experiments.find(experiment => experiment.id === selectedId);

  const selectExperiment = (experimentId: string) => {
    // Changing the filter drops `review`: the featured result belongs to the previous scope.
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        if (experimentId === ALL_EXPERIMENTS) next.delete('experiment');
        else next.set('experiment', experimentId);
        next.delete('review');
        return next;
      },
      { replace: true },
    );
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
        key={`${targetType}:${targetId}:${selectedId ?? ALL_EXPERIMENTS}`}
        datasetId={selected?.datasetId ?? undefined}
        experimentId={selectedId ?? undefined}
        targetType={targetType}
        targetId={targetId}
        featuredItemId={featuredResultId}
        detailPanelVariant="overlay"
        toolbarStart={
          <>
            <TargetFilter
              targetType={targetType}
              targetId={targetId}
              onTargetTypeChange={setTargetType}
              onTargetIdChange={setTargetId}
            />
            <ExperimentCombobox
              allOption
              value={selectedId ?? undefined}
              onValueChange={selectExperiment}
              targetType={targetType}
              targetId={targetId}
              className="w-72"
            />
          </>
        }
        toolbarEnd={
          selectedId ? (
            <Button as={Link} href={paths.experimentLink(selectedId)} icon={<ArrowUpRight />}>
              See experiment
            </Button>
          ) : undefined
        }
      />
    </PageLayout>
  );
}

export { ReviewQueuePage };
export default ReviewQueuePage;
