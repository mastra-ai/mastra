import {
  Breadcrumb,
  Crumb,
  Header,
  Icon,
  MainContentLayout,
  PermissionDenied,
  SessionExpired,
  Spinner,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { Database } from 'lucide-react';
import { useParams, Link } from 'react-router';
import { useDatasetExperiment, useDatasetExperimentResults } from '@/domains/datasets/hooks/use-dataset-experiments';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { ExperimentPageContent } from '@/domains/experiments/components/experiment-page-content';
import { ExperimentPageHeader } from '@/domains/experiments/components/experiment-page-header';

function DatasetExperimentPage() {
  const { datasetId, experimentId } = useParams<{ datasetId: string; experimentId: string }>();

  const { data: dataset } = useDataset(datasetId ?? '');

  const {
    data: experiment,
    isLoading: experimentLoading,
    error: experimentError,
  } = useDatasetExperiment(datasetId!, experimentId!);

  const {
    data: results,
    isLoading: resultsLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetExperimentResults({
    datasetId: datasetId!,
    experimentId: experimentId!,
    experimentStatus: experiment?.status,
  });

  if (!datasetId || !experimentId) {
    return null;
  }

  if (experimentLoading) {
    return (
      <MainContentLayout>
        <div className="flex items-center justify-center h-full">
          <Spinner />
        </div>
      </MainContentLayout>
    );
  }

  if (experimentError && is401UnauthorizedError(experimentError)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  if (experimentError && is403ForbiddenError(experimentError)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="datasets" />
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
        <div className="grid gap-1 max-w-[140rem] mx-auto grid-rows-[auto_1fr] h-full">
          <ExperimentPageHeader experimentId={experimentId!} experiment={experiment} />
          <ExperimentPageContent
            experimentId={experimentId!}
            experimentStatus={experiment?.status}
            results={results ?? []}
            isLoading={resultsLoading}
            setEndOfListElement={setEndOfListElement}
            isFetchingNextPage={isFetchingNextPage}
            hasNextPage={hasNextPage}
          />
        </div>
      </div>
    </MainContentLayout>
  );
}

export { DatasetExperimentPage };
export default DatasetExperimentPage;
