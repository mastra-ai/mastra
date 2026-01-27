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
  DatasetInformation,
} from '@mastra/playground-ui';

export function Dataset() {
  const { datasetId } = useParams();

  return (
    <div className="h-full w-full overflow-y-hidden">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/datasets`} isCurrent>
            <Icon>
              <DbIcon />
            </Icon>
            Datasets
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

      <DatasetInformation datasetId={datasetId!} />
    </div>
  );
}

export default Dataset;
