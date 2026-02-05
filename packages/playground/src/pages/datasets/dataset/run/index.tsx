import { useParams, Link } from 'react-router';
import { format } from 'date-fns';
import { Database, PlayCircle, Calendar1Icon, CrosshairIcon } from 'lucide-react';
import {
  Header,
  MainContentLayout,
  Icon,
  Breadcrumb,
  Crumb,
  MainHeader,
  Spinner,
  TextAndIcon,
  CopyButton,
  useDataset,
  useDatasetRun,
  useDatasetRunResults,
  RunResultsMasterDetail,
  RunStats,
  useAgents,
  useWorkflows,
  useScorers,
} from '@mastra/playground-ui';

function DatasetRun() {
  const { datasetId, runId } = useParams<{ datasetId: string; runId: string }>();

  const { data: dataset } = useDataset(datasetId ?? '');
  const { data: run, isLoading: runLoading, error: runError } = useDatasetRun(datasetId!, runId!);
  const { data: resultsData, isLoading: resultsLoading } = useDatasetRunResults({
    datasetId: datasetId!,
    runId: runId!,
    runStatus: run?.status,
  });
  const { data: agents } = useAgents();
  const { data: workflows } = useWorkflows();
  const { data: scorers } = useScorers();

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

  // Get target link path based on target type
  const getTargetPath = () => {
    switch (run?.targetType) {
      case 'agent':
        return `/agents/${run.targetId}`;
      case 'workflow':
        return `/workflows/${run.targetId}`;
      case 'scorer':
        return `/evals/scorers/${run.targetId}`;
      default:
        return '#';
    }
  };

  // Get target name based on target type
  const getTargetName = () => {
    const targetId = run?.targetId;
    if (!targetId) return targetId;

    switch (run?.targetType) {
      case 'agent':
        return agents?.[targetId]?.name ?? targetId;
      case 'workflow':
        return workflows?.[targetId]?.name ?? targetId;
      case 'scorer':
        return scorers?.[targetId]?.scorer?.config?.name ?? targetId;
      default:
        return targetId;
    }
  };

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

      <div className="h-full overflow-hidden px-6 pb-4">
        <div className="grid gap-6 max-w-[100rem] mx-auto grid-rows-[auto_1fr] h-full">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title>
                <PlayCircle />
                {runId} {runId && <CopyButton content={runId} />}
              </MainHeader.Title>
              <MainHeader.Description>
                <TextAndIcon>
                  <Calendar1Icon /> Created at {format(new Date(run.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </TextAndIcon>
                {run.completedAt && (
                  <TextAndIcon>
                    <Calendar1Icon /> Completed at {format(new Date(run.completedAt), "MMM d, yyyy 'at' h:mm a")}
                  </TextAndIcon>
                )}
              </MainHeader.Description>
              <MainHeader.Description>
                <TextAndIcon>
                  <CrosshairIcon /> Target
                  <Link to={getTargetPath()}>{getTargetName()}</Link>
                </TextAndIcon>
              </MainHeader.Description>
            </MainHeader.Column>
            <MainHeader.Column>
              <RunStats run={run} />
            </MainHeader.Column>
          </MainHeader>

          <RunResultsMasterDetail results={results} isLoading={resultsLoading} />
        </div>
      </div>
    </MainContentLayout>
  );
}

export { DatasetRun };
export default DatasetRun;
