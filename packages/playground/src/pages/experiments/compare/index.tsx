import { Button } from '@mastra/playground-ui/components/Button';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useSearchParams, Link } from 'react-router';
import { useExperiments } from '@/domains/datasets/hooks/use-experiments';
import { ExperimentsComparison } from '@/domains/experiments';

function ExperimentIdLink({ experimentId }: { experimentId: string }) {
  return (
    <Button as={Link} to={`/experiments/${experimentId}`} size="sm" aria-label={`Open experiment ${experimentId}`}>
      {experimentId.slice(0, 8)}
    </Button>
  );
}

function CompareExperimentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const experimentIdA = searchParams.get('baseline') ?? '';
  const experimentIdB = searchParams.get('contender') ?? '';

  // The URL only carries experiment ids; the comparison needs their (shared) dataset.
  const { data: experimentsData, isLoading, error } = useExperiments();
  const experimentA = experimentsData?.experiments?.find(e => e.id === experimentIdA);
  const experimentB = experimentsData?.experiments?.find(e => e.id === experimentIdB);
  const datasetId = experimentA?.datasetId ?? '';
  const isSameDataset = Boolean(experimentA && experimentB && experimentA.datasetId === experimentB.datasetId);

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

  if (isLoading) return null;

  if (!datasetId || !experimentA || !experimentB) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral4 py-8 text-center">
            <p>Select two experiments to compare.</p>
            <p className="mt-2 text-sm">
              Use the URL format: /experiments/compare?baseline={'{experimentIdA}'}&contender={'{experimentIdB}'}
            </p>
          </div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  if (!isSameDataset) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral4 py-8 text-center">
            <p>Experiments must belong to the same dataset to be compared.</p>
            <p className="mt-2 flex items-center justify-center gap-2 text-sm">
              <ExperimentIdLink experimentId={experimentIdA} />
              and
              <ExperimentIdLink experimentId={experimentIdB} />
              use different datasets.
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
                <Button onClick={() => setSearchParams({ baseline: experimentIdB, contender: experimentIdA })}>
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
