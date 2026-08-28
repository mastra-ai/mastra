import { Button } from '@mastra/playground-ui/components/Button';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeftRightIcon, ExternalLinkIcon } from 'lucide-react';
import { useParams, useSearchParams, Link } from 'react-router';
import { DatasetExperimentsComparison } from '@/domains/datasets';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';

/** Opens an experiment in a new tab so the comparison stays put. */
function ExperimentIdLink({ experimentId }: { experimentId: string }) {
  return (
    <Button
      as={Link}
      to={`/experiments/${experimentId}`}
      target="_blank"
      rel="noopener noreferrer"
      size="sm"
      aria-label={`Open experiment ${experimentId}`}
    >
      {experimentId.slice(0, 8)}
      <ExternalLinkIcon />
    </Button>
  );
}

function CompareDatasetExperimentsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { error } = useDataset(datasetId ?? '');
  const experimentIdA = searchParams.get('baseline') ?? '';
  const experimentIdB = searchParams.get('contender') ?? '';

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
          <PermissionDenied resource="datasets" />
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
              Use the URL format: /datasets/{'{datasetId}'}/experiments?baseline={'{experimentIdA}'}&contender=
              {'{experimentIdB}'}
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

          <DatasetExperimentsComparison
            datasetId={datasetId}
            experimentIdA={experimentIdA}
            experimentIdB={experimentIdB}
          />
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}

export { CompareDatasetExperimentsPage };
export default CompareDatasetExperimentsPage;
