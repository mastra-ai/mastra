import { Button } from '@mastra/playground-ui/components/Button';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useDatasetExperiment } from '@/domains/datasets/hooks/use-dataset-experiments';
import { ExperimentsComparison } from '@/domains/experiments';
import { useLinkComponent } from '@/lib/framework';

function ExperimentIdLink({ experimentId }: { experimentId: string }) {
  const { Link, paths } = useLinkComponent();
  return (
    <Button
      as={Link}
      href={paths.experimentLink(experimentId)}
      size="sm"
      aria-label={`Open experiment ${experimentId}`}
    >
      {experimentId.slice(0, 8)}
    </Button>
  );
}

function CompareExperimentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const datasetId = searchParams.get('dataset') ?? '';
  const experimentIdA = searchParams.get('baseline') ?? '';
  const experimentIdB = searchParams.get('contender') ?? '';

  // Fetch each experiment by id: the global list is paginated and may not contain them.
  // The server 404s when an experiment does not belong to `datasetId`, which enforces same-dataset comparison.
  const experimentA = useDatasetExperiment(datasetId, experimentIdA);
  const experimentB = useDatasetExperiment(datasetId, experimentIdB);
  const isLoading = experimentA.isLoading || experimentB.isLoading;
  const error = experimentA.error ?? experimentB.error;

  if (error && is401UnauthorizedError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="experiments" />
        </div>
      </MainContentLayout>
    );
  }

  if (!datasetId || !experimentIdA || !experimentIdB) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral4 py-8 text-center">
            <p>Select two experiments to compare.</p>
            <p className="mt-2 text-sm">
              Use the URL format: /experiments/compare?dataset={'{datasetId}'}&baseline={'{experimentIdA}'}&contender=
              {'{experimentIdB}'}
            </p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  if (isLoading) return null;

  if (error && !is404NotFoundError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <ErrorState title="Failed to load experiments" message={error.message} />
        </div>
      </MainContentLayout>
    );
  }

  // 404 (or no data): the experiment does not exist or belongs to another dataset.
  if (error || !experimentA.data || !experimentB.data) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral4 py-8 text-center">
            <p>Experiments must belong to the same dataset ({datasetId}) to be compared.</p>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm">
              One of
              <ExperimentIdLink experimentId={experimentIdA} />
              and
              <ExperimentIdLink experimentId={experimentIdB} />
              was not found in it.
            </p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  return (
    <MainContentLayout>
      <MainContentContent>
        {/* Padding lives on the toolbar only: the comparison table runs edge to edge. */}
        <div className="grid w-full content-start">
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Txt as="h1" variant="ui-lg" className="text-neutral6 font-medium">
                Experiments comparison
              </Txt>

              <p className="text-ui-sm text-neutral4 flex items-center gap-2">
                <ExperimentIdLink experimentId={experimentIdA} />
                and
                <ExperimentIdLink experimentId={experimentIdB} />
              </p>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() =>
                    setSearchParams({ dataset: datasetId, baseline: experimentIdB, contender: experimentIdA })
                  }
                >
                  <ArrowLeftRightIcon />
                  Swap sides
                </Button>
              </TooltipTrigger>
              <TooltipContent>Switch baseline and contender</TooltipContent>
            </Tooltip>
          </div>

          <ExperimentsComparison datasetId={datasetId} experimentIdA={experimentIdA} experimentIdB={experimentIdB} />
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}

export { CompareExperimentsPage };
export default CompareExperimentsPage;
