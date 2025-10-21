import { Button, HeaderAction, Icon, MainContentContent, useDatasets, DatasetsTable } from '@mastra/playground-ui';
import { Header, HeaderTitle, MainContentLayout } from '@mastra/playground-ui';
import { DatabaseIcon, PlusIcon } from 'lucide-react';

import { Link } from 'react-router';

export default function DatasetsPage() {
  const { data, isLoading } = useDatasets();

  return (
    <>
      <MainContentLayout>
        <Header>
          <HeaderTitle>
            <Icon>
              <DatabaseIcon />
            </Icon>
            Datasets
          </HeaderTitle>

          <HeaderAction>
            <Button as={Link} to={`/datasets/new`}>
              <Icon>
                <PlusIcon />
              </Icon>{' '}
              Create New
            </Button>
            <Button as={Link} to="https://mastra.ai/en/docs/datasets/overview" target="_blank">
              Documentation
            </Button>
          </HeaderAction>
        </Header>

        <MainContentContent>
          <DatasetsTable isLoading={isLoading} datasets={data?.datasets || []} />
        </MainContentContent>
      </MainContentLayout>
    </>
  );
}
