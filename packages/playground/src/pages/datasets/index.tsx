import { useState } from 'react';
import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  DbIcon,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
  DatasetTable,
  useDatasets,
  CreateDatasetDialog,
} from '@mastra/playground-ui';
import { Plus } from 'lucide-react';

import { Link } from 'react-router';

export function Datasets() {
  const { data, isLoading } = useDatasets();
  const datasets = data?.datasets ?? [];
  const isEmpty = !isLoading && datasets.length === 0;
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <DbIcon />
          </Icon>
          Datasets
        </HeaderTitle>

        <HeaderAction>
          {!isEmpty && (
            <Button onClick={() => setDialogOpen(true)}>
              <Icon>
                <Plus />
              </Icon>
              Create Dataset
            </Button>
          )}
          <Button as={Link} to="https://mastra.ai/en/docs/evals/datasets" target="_blank" variant="ghost">
            <Icon>
              <DocsIcon />
            </Icon>
            Docs
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <DatasetTable datasets={datasets} isLoading={isLoading} />
      </MainContentContent>

      <CreateDatasetDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </MainContentLayout>
  );
}

export default Datasets;
