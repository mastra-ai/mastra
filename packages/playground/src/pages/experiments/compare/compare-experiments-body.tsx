import { Txt } from '@mastra/playground-ui/components/Txt';
import { useSearchParams } from 'react-router';
import { CompareExperimentsContent } from './compare-experiments-content';

export function CompareExperimentsBody() {
  const [searchParams] = useSearchParams();
  const datasetId = searchParams.get('dataset') ?? undefined;
  const experimentIdA = searchParams.get('baseline') ?? undefined;
  const experimentIdB = searchParams.get('contender') ?? undefined;

  if (!datasetId || !experimentIdA || !experimentIdB) {
    return (
      <>
        <Txt as="h1" variant="heading" className="sr-only">
          Compare
        </Txt>
        <div className="grid h-full min-w-min content-start items-start overflow-x-auto overflow-y-auto">
          <div className="py-5 text-center text-muted-foreground">
            <Txt as="p">Select two experiments to compare.</Txt>
            <Txt className="mt-2">
              Use the URL format: /experiments/compare?dataset={'{datasetId}'}&baseline={'{experimentIdA}'}&contender=
              {'{experimentIdB}'}
            </Txt>
          </div>
        </div>
      </>
    );
  }

  return (
    <CompareExperimentsContent datasetId={datasetId} experimentIdA={experimentIdA} experimentIdB={experimentIdB} />
  );
}
