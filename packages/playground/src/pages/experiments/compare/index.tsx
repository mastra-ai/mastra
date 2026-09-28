import { Button } from '@mastra/playground-ui/components/Button';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { ArrowLeftRightIcon } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import { useDatasetExperiment } from '@/domains/datasets/hooks/use-dataset-experiments';
import { ExperimentsComparison } from '@/domains/experiments';
import { navCrumb } from '@/domains/navigation/crumbs';

const crumbs = [navCrumb('/experiments'), { id: 'experiments-compare', label: 'Compare' }];

function ExperimentIdLink({ experimentId }: { experimentId: string }) {
  const { Link, paths } = useLinkComponent();
  return (
    <Button
      render={<Link href={paths.experimentLink(experimentId)} />}

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
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Compare</h1>
        <SessionExpired variant="fill" />
      </PageLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Compare</h1>
        <PermissionDenied variant="fill" resource="experiments" />
      </PageLayout>
    );
  }

  if (!datasetId || !experimentIdA || !experimentIdB) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Compare</h1>
        <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
          <div className="py-5 text-center text-muted-foreground">
            <p>Select two experiments to compare.</p>
            <p className="mt-2 text-body">
              Use the URL format: /experiments/compare?dataset={'{datasetId}'}&baseline={'{experimentIdA}'}&contender=
              {'{experimentIdB}'}
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (isLoading) return null;

  if (error && !is404NotFoundError(error)) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Compare</h1>
        <EmptyState
          tone="error"
          variant="fill"
          titleSlot="Failed to load experiments"
          descriptionSlot={error.message}
        />
      </PageLayout>
    );
  }

  // 404 (or no data): the experiment does not exist or belongs to another dataset.
  if (error || !experimentA.data || !experimentB.data) {
    return (
      <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
        <h1 className="sr-only">Compare</h1>
        <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
          <div className="py-5 text-center text-muted-foreground">
            <p>Experiments must belong to the same dataset ({datasetId}) to be compared.</p>
            <p className="mt-2 flex items-center justify-center gap-2 text-body">
              One of
              <ExperimentIdLink experimentId={experimentIdA} />
              and
              <ExperimentIdLink experimentId={experimentIdB} />
              was not found in it.
            </p>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
        {/* Padding lives on the toolbar only: the comparison table runs edge to edge. */}
        <div className="grid w-full content-start">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Txt as="h1" variant="heading" tone="ink">
                Experiments comparison
              </Txt>

              <p className="flex items-center gap-2 text-caption text-muted-foreground">
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
                  icon={<ArrowLeftRightIcon />}
                >
                  Swap sides
                </Button>
              </TooltipTrigger>
              <TooltipContent>Switch baseline and contender</TooltipContent>
            </Tooltip>
          </div>

          <ExperimentsComparison datasetId={datasetId} experimentIdA={experimentIdA} experimentIdB={experimentIdB} />
        </div>
      </div>
    </PageLayout>
  );
}

export { CompareExperimentsPage };
export default CompareExperimentsPage;
