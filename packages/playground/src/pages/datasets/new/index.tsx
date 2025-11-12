import {
  Breadcrumb,
  Crumb,
  Header,
  MainContentLayout,
  Icon,
  HeaderAction,
  Button,
  DatasetCreation,
} from '@mastra/playground-ui';
import { DatabaseIcon } from 'lucide-react';
import { Link } from 'react-router';

export default function NewDatasetsPage() {
  return (
    <MainContentLayout>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/scorers`}>
            <Icon>
              <DatabaseIcon />
            </Icon>
            Datasets
          </Crumb>

          <Crumb as={Link} to={`/datasets/new`} isCurrent>
            Create
          </Crumb>
        </Breadcrumb>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/datasets/overview" target="_blank">
            Documentation
          </Button>
        </HeaderAction>
      </Header>

      <DatasetCreation />
    </MainContentLayout>
  );
}
