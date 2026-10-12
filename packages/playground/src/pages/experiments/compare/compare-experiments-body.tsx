import { Txt } from '@mastra/playground-ui/components/Txt';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { CompareExperimentsContent } from './compare-experiments-content';
import { MAX_COMPARED_EXPERIMENTS } from '@/domains/experiments/components/comparison/constants';

export function CompareExperimentsBody() {
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get('dataset') ?? undefined;
  const baselineId = searchParams.get('baseline') ?? undefined;
  const contenderIds = useMemo(
    () =>
      [...new Set(searchParams.getAll('contender'))]
        .filter(id => id && id !== baselineId)
        .slice(0, MAX_COMPARED_EXPERIMENTS - 1),
    [searchParams, baselineId],
  );

  if (!datasetId || !baselineId || contenderIds.length === 0) {
    return (
      <>
        <Txt as="h1" variant="heading" className="sr-only">
          Compare
        </Txt>
        <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
          <div className="py-5 text-center text-muted-foreground">
            <Txt as="p">Select two to ten experiments to compare.</Txt>
            <Txt className="mt-2">
              Use the URL format: /experiments/compare?dataset={'{datasetId}'}&baseline={'{experimentId}'}&contender=
              {'{experimentId}'}&contender={'{experimentId}'}
            </Txt>
          </div>
        </div>
      </>
    );
  }

  return <CompareExperimentsContent datasetId={datasetId} baselineId={baselineId} contenderIds={contenderIds} />;
}
