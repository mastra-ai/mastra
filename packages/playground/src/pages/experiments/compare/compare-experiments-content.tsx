import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useDatasetExperimentsQueries } from '@mastra/react/hooks/datasets';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { ExperimentIdLink } from './experiment-id-link';
import { ExperimentsComparison } from '@/domains/experiments/components/comparison/experiments-comparison';

function ExperimentIdLinks({ experimentIds }: { experimentIds: string[] }) {
  return experimentIds.map((id, index) => (
    <span key={id} className="flex items-center gap-2">
      {index > 0 && index === experimentIds.length - 1 && 'and'}
      <span className="flex items-center">
        <ExperimentIdLink experimentId={id} />
        {index < experimentIds.length - 2 && ','}
      </span>
    </span>
  ));
}

export function CompareExperimentsContent({
  datasetId,
  baselineId,
  contenderIds,
}: {
  datasetId: string;
  baselineId: string;
  contenderIds: string[];
}) {
  const [, setSearchParams] = useSearchParams();
  const experimentIds = useMemo(() => [baselineId, ...contenderIds], [baselineId, contenderIds]);
  // Fetch each experiment by id: the global list is paginated and may not contain them.
  // The server 404s when an experiment does not belong to `datasetId`, which enforces same-dataset comparison.
  const { data: experimentsById, isLoading, error } = useDatasetExperimentsQueries({ datasetId, experimentIds });

  const setBaseline = (experimentId: string) => {
    const params = new URLSearchParams({ dataset: datasetId, baseline: experimentId });
    for (const id of experimentIds) {
      if (id !== experimentId) params.append('contender', id);
    }
    setSearchParams(params);
  };

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

  // 404 (or no data): an experiment does not exist or belongs to another dataset.
  if (!isLoading && (error || experimentIds.some(id => !experimentsById[id]))) {
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
              <ExperimentIdLinks experimentIds={experimentIds} />
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
        <div className="flex min-w-0 flex-wrap items-center gap-3 px-4 py-3">
          <Txt as="h1" variant="heading" tone="ink">
            Experiments comparison
          </Txt>

          <Txt variant="caption" tone="muted" className="flex flex-wrap items-center gap-2">
            <ExperimentIdLinks experimentIds={experimentIds} />
          </Txt>
        </div>

        <ExperimentsComparison
          datasetId={datasetId}
          baselineId={baselineId}
          contenderIds={contenderIds}
          onSetBaseline={setBaseline}
        />
      </div>
    </div>
  );
}
