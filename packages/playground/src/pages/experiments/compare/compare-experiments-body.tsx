import { Txt } from '@mastra/playground-ui/components/Txt';
import { CompareExperimentsContent } from './compare-experiments-content';
import { useComparedExperimentIds } from './use-compared-experiment-ids';

export function CompareExperimentsBody() {
  const { datasetId, baselineId, contenderIds } = useComparedExperimentIds();

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
