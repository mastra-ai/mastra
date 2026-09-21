import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { NoDataPageLayout, PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowUpRight } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { isDatasetTargetType } from '@/domains/datasets/components/target-type-options';
import { useExperimentsForDatasetFilter } from '@/domains/experiments/hooks/use-experiments-for-dataset-filter';
import { DatasetReview, type ReviewListFilters } from '@/domains/review/components/dataset-review';
import { ReviewQueueFilterBar, type ReviewQueueFilters } from '@/domains/review/components/review-queue-filter-bar';
import { TARGET_ID_PARAM, TARGET_TYPE_PARAM } from '@/domains/shared/hooks/use-target-filter-params';
import { useLinkComponent } from '@/lib/framework';

const EXPERIMENT_PARAM = 'experiment';
const REVIEW_PARAM = 'review';

/**
 * Single review queue across the project. Lists every item awaiting review by default;
 * `?targetType=<type>&targetId=<id>` narrows it to one target, `?experiment=<id>` to one
 * experiment and `?review=<resultId>` features one of its results.
 */
function ReviewQueuePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawType = searchParams.get(TARGET_TYPE_PARAM);
  const targetType = isDatasetTargetType(rawType) ? rawType : '';
  const targetId = targetType ? (searchParams.get(TARGET_ID_PARAM) ?? '') : '';
  const selectedId = searchParams.get(EXPERIMENT_PARAM);
  const featuredResultId = searchParams.get(REVIEW_PARAM);

  const { Link, paths } = useLinkComponent();
  const { data, error } = useExperimentsForDatasetFilter(undefined, { targetType, targetId });
  const selected = data?.experiments.find(experiment => experiment.id === selectedId);

  const handleFiltersChange = (next: ReviewQueueFilters, list: ReviewListFilters) => {
    if (next.status !== list.status) list.onStatusChange(next.status);
    if (next.tag !== list.tag) list.onTagChange(next.tag);
    setSearchParams(
      prev => {
        const params = new URLSearchParams(prev);
        // Narrower scopes only make sense within the wider one: a new type drops the id and experiment,
        // a new id drops the experiment. Any change drops `review`, which belonged to the previous scope.
        const typeChanged = next.targetType !== targetType;
        const idChanged = typeChanged || next.targetId !== targetId;
        const experimentId = idChanged ? '' : next.experimentId;
        const targetIdValue = typeChanged ? '' : next.targetId;

        if (next.targetType) params.set(TARGET_TYPE_PARAM, next.targetType);
        else params.delete(TARGET_TYPE_PARAM);
        if (targetIdValue) params.set(TARGET_ID_PARAM, targetIdValue);
        else params.delete(TARGET_ID_PARAM);
        if (experimentId) params.set(EXPERIMENT_PARAM, experimentId);
        else params.delete(EXPERIMENT_PARAM);
        params.delete(REVIEW_PARAM);
        return params;
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
        key={`${targetType}:${targetId}:${selectedId ?? 'all'}`}
        datasetId={selected?.datasetId ?? undefined}
        experimentId={selectedId ?? undefined}
        targetType={targetType}
        targetId={targetId}
        featuredItemId={featuredResultId}
        renderFilters={list => (
          <ReviewQueueFilterBar
            targetType={targetType}
            targetId={targetId}
            experimentId={selectedId ?? ''}
            status={list.status}
            tag={list.tag}
            experiments={data?.experiments ?? []}
            tagOptions={list.tagOptions}
            onChange={next => handleFiltersChange(next, list)}
          />
        )}
        toolbarEnd={
          selectedId ? (
            <Button render={<Link href={paths.experimentLink(selectedId)} />} icon={<ArrowUpRight />}>
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
