import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useDatasetExperiment } from '@mastra/react/hooks/datasets';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { ExperimentIdLink } from './experiment-id-link';
import { ExperimentsComparison } from '@/domains/experiments/components/comparison/experiments-comparison';

export function CompareExperimentsContent({
  datasetId,
  experimentIdA,
  experimentIdB,
}: {
  datasetId: string;
  experimentIdA: string;
  experimentIdB: string;
}) {
  const [, setSearchParams] = useSearchParams();
  // Fetch each experiment by id: the global list is paginated and may not contain them.
  // The server 404s when an experiment does not belong to `datasetId`, which enforces same-dataset comparison.
  const experimentA = useDatasetExperiment({
    datasetId: datasetId,
    experimentId: experimentIdA,
  });
  const experimentB = useDatasetExperiment({
    datasetId: datasetId,
    experimentId: experimentIdB,
  });
  const isLoading = experimentA.isLoading || experimentB.isLoading;
  const error = experimentA.error ?? experimentB.error;

  if (error && is401UnauthorizedError(error)) {
    return (
      <>
        <Txt as="h1" variant="heading" className="sr-only">
          Compare
        </Txt>
        <SessionExpired variant="fill" />
      </>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <>
        <Txt as="h1" variant="heading" className="sr-only">
          Compare
        </Txt>
        <PermissionDenied variant="fill" resource="experiments" />
      </>
    );
  }

  if (error && !is404NotFoundError(error)) {
    return (
      <>
        <Txt as="h1" variant="heading" className="sr-only">
          Compare
        </Txt>
        <EmptyState
          tone="error"
          variant="fill"
          titleSlot="Failed to load experiments"
          descriptionSlot={error.message}
        />
      </>
    );
  }

  // 404 (or no data): the experiment does not exist or belongs to another dataset.
  if (!isLoading && (error || !experimentA.data || !experimentB.data)) {
    return (
      <>
        <Txt as="h1" variant="heading" className="sr-only">
          Compare
        </Txt>
        <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
          <div className="py-5 text-center text-muted-foreground">
            <Txt as="p">Experiments must belong to the same dataset ({datasetId}) to be compared.</Txt>
            <Txt className="mt-2 flex items-center justify-center gap-2">
              One of
              <ExperimentIdLink experimentId={experimentIdA} />
              and
              <ExperimentIdLink experimentId={experimentIdB} />
              was not found in it.
            </Txt>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
      {/* Padding lives on the toolbar only: the comparison table runs edge to edge. */}
      <div className="grid w-full content-start">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Txt as="h1" variant="heading" tone="ink">
              Experiments comparison
            </Txt>

            <Txt variant="caption" tone="muted" className="flex items-center gap-2">
              <ExperimentIdLink experimentId={experimentIdA} />
              and
              <ExperimentIdLink experimentId={experimentIdB} />
            </Txt>
          </div>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  onClick={() =>
                    setSearchParams({ dataset: datasetId, baseline: experimentIdB, contender: experimentIdA })
                  }
                  icon={<ArrowLeftRightIcon />}
                >
                  Swap sides
                </Button>
              }
            />
            <TooltipContent>Switch baseline and contender</TooltipContent>
          </Tooltip>
        </div>

        <ExperimentsComparison datasetId={datasetId} experimentIdA={experimentIdA} experimentIdB={experimentIdB} />
      </div>
    </div>
  );
}
