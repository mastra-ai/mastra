import { useParams, Link } from 'react-router';
import { Database, PlayCircle } from 'lucide-react';
import {
  Header,
  MainContentLayout,
  Icon,
  Breadcrumb,
  Crumb,
  Spinner,
  useDataset,
  useDatasetRun,
  useDatasetRunResults,
  ExperimentResultsListAndDetails,
  ExperimentPageHeader,
} from '@mastra/playground-ui';

function DatasetRunPage() {
  const { datasetId, runId } = useParams<{ datasetId: string; runId: string }>();

  const { data: dataset } = useDataset(datasetId ?? '');
  const { data: run, isLoading: runLoading, error: runError } = useDatasetRun(datasetId!, runId!);
  const { data: resultsData, isLoading: resultsLoading } = useDatasetRunResults({
    datasetId: datasetId!,
    runId: runId!,
    runStatus: run?.status,
  });
  if (runLoading) {
    return (
      <MainContentLayout>
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      </MainContentLayout>
    );
  }

  if (runError || !run) {
    return (
      <MainContentLayout>
        <div className="text-red-500 p-4">
          Error loading run: {runError instanceof Error ? runError.message : 'Unknown error'}
        </div>
      </MainContentLayout>
    );
  }

  // Transform results for the table
  const results = resultsData?.results ?? [];

  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to="/datasets">
            <Icon>
              <Database />
            </Icon>
            Datasets
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}`}>
            {dataset?.name || datasetId}
          </Crumb>
          <Crumb isCurrent>
            <Icon>
              <PlayCircle />
            </Icon>
            Run
          </Crumb>
        </Breadcrumb>
      </Header>

      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="grid gap-6 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full">
          <ExperimentPageHeader runId={runId!} run={run} />
          <ExperimentResultsListAndDetails results={results} isLoading={resultsLoading} />
        </div>
      </div>
    </MainContentLayout>
  );
}

export { DatasetRunPage };
export default DatasetRunPage;
