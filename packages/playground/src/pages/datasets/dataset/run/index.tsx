import { Link, useParams } from 'react-router';

import {
  Header,
  Breadcrumb,
  Crumb,
  Icon,
  HeaderAction,
  Button,
  DocsIcon,
  DbIcon,
  DatasetRunInformation,
} from '@mastra/playground-ui';

export function DatasetRun() {
  const { datasetId, runId } = useParams();

  return (
    <div className="h-full w-full overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/datasets`}>
            <Icon>
              <DbIcon />
            </Icon>
            Datasets
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}`}>
            Dataset
          </Crumb>
          <Crumb as={Link} to={`/datasets/${datasetId}/runs/${runId}`} isCurrent>
            Run
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/evals/datasets" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Datasets documentation
          </Button>
        </HeaderAction>
      </Header>

      <DatasetRunInformation datasetId={datasetId!} runId={runId!} />
    </div>
  );
}

export default DatasetRun;
