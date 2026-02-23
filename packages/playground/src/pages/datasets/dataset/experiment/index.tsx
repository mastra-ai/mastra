import { useParams, Link } from 'react-router';
import { Database } from 'lucide-react';
import {
  Header,
  MainContentLayout,
  Icon,
  Breadcrumb,
  Crumb,
  Spinner,
  useDataset,
  useDatasetExperiment,
  useDatasetExperimentResults,
  ExperimentResultsListAndDetails,
  ExperimentPageHeader,
} from '@mastra/playground-ui';

function DatasetExperimentPage() {
  const { datasetId, experimentId } = useParams<{ datasetId: string; experimentId: string }>();

  const { data: dataset } = useDataset(datasetId ?? '');
  const {
    data: experiment,
    isLoading: experimentLoading,
    error: experimentError,
  } = useDatasetExperiment(datasetId!, experimentId!);
  const { data: resultsData, isLoading: resultsLoading } = useDatasetExperimentResults({
    datasetId: datasetId!,
    experimentId: experimentId!,
    experimentStatus: experiment?.status,
  });
  if (experimentLoading) {
    return (
      <MainContentLayout>
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      </MainContentLayout>
    );
  }

  if (experimentError || !experiment) {
    return (
      <MainContentLayout>
        <div className="text-red-500 p-4">
          Error loading experiment: {experimentError instanceof Error ? experimentError.message : 'Unknown error'}
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
            {dataset?.name}
          </Crumb>
          <Crumb isCurrent as="span">
            Experiment
          </Crumb>
        </Breadcrumb>
      </Header>

      <div className="h-full overflow-hidden px-[3vw] pb-4">
        <div className="grid gap-6 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full">
          <ExperimentPageHeader experimentId={experimentId!} experiment={experiment} />
          <ExperimentResultsListAndDetails results={results} isLoading={resultsLoading} />
        </div>
      </div>
    </MainContentLayout>
  );
}

export { DatasetExperimentPage };
export default DatasetExperimentPage;
