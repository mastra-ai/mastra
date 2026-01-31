import { useParams, Link } from 'react-router';
import { Database, PlayCircle, ArrowLeft } from 'lucide-react';
import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  Breadcrumb,
  Crumb,
  PageHeader,
  KeyValueList,
  Badge,
  Spinner,
  useLinkComponent,
  useDatasetRun,
  useDatasetRunResults,
  ResultsTable,
} from '@mastra/playground-ui';

function DatasetRun() {
  const { datasetId, runId } = useParams<{ datasetId: string; runId: string }>();
  const { Link: FrameworkLink } = useLinkComponent();

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

  const statusVariant =
    run.status === 'completed'
      ? 'success'
      : run.status === 'failed'
        ? 'error'
        : run.status === 'running'
          ? 'info'
          : 'default';

  const runInfo = [
    {
      key: 'status',
      label: 'Status',
      value: <Badge variant={statusVariant}>{run.status}</Badge>,
    },
    {
      key: 'target',
      label: 'Target',
      value: `${run.targetType}: ${run.targetId}`,
    },
    {
      key: 'created',
      label: 'Created',
      value: new Date(run.createdAt).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }),
    },
    {
      key: 'progress',
      label: 'Progress',
      value: `${run.succeededCount + run.failedCount} / ${run.totalItems} (${run.failedCount} failed)`,
    },
  ];

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
            {datasetId}
          </Crumb>
          <Crumb isCurrent>
            <Icon>
              <PlayCircle />
            </Icon>
            Run {runId?.slice(0, 8)}
          </Crumb>
        </Breadcrumb>
        <HeaderAction>
          <Button as={Link} to={`/datasets/${datasetId}`} variant="outline">
            <Icon>
              <ArrowLeft />
            </Icon>
            Back to Dataset
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent>
        <div className="max-w-[100rem] w-full px-12 mx-auto grid content-start gap-8">
          <PageHeader
            title={`Run ${runId?.slice(0, 8)}`}
            description={`Dataset run for ${run.targetType} "${run.targetId}"`}
            icon={<PlayCircle />}
          />

          <KeyValueList data={runInfo} LinkComponent={FrameworkLink} />

          <section>
            <h3 className="text-sm font-medium text-neutral5 mb-4">Results</h3>
            <ResultsTable results={results} isLoading={resultsLoading} />
          </section>
        </div>
      </MainContentContent>
    </MainContentLayout>
  );
}

export { DatasetRun };
export default DatasetRun;
