import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  useLinkComponent,
  DocsIcon,
} from '@mastra/playground-ui';
import { useDatasets, DatasetsTable, CreateDatasetDialog } from '@mastra/playground-ui/datasets';
import { Plus, Database } from 'lucide-react';
import { useState } from 'react';

function Datasets() {
  const { Link } = useLinkComponent();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { data, isLoading, error } = useDatasets();
  const datasets = data?.datasets ?? [];

  const handleDatasetCreated = (datasetId: string) => {
    setIsCreateDialogOpen(false);
    navigate(paths.datasetLink(datasetId));
  };

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <Database />
          </Icon>
          Datasets
        </HeaderTitle>
        <HeaderAction>
          <Button variant="light" onClick={() => setIsCreateDialogOpen(true)}>
            <Icon>
              <Plus />
            </Icon>
            Create Dataset
          </Button>
          <Button as={Link} to="https://mastra.ai/reference/datasets/dataset" target="_blank" variant="ghost" size="md">
            <DocsIcon />
            Datasets documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && datasets.length === 0}>
        <DatasetsTable
          datasets={datasets}
          isLoading={isLoading}
          error={error}
          onCreateClick={() => setIsCreateDialogOpen(true)}
        />
      </MainContentContent>

      <CreateDatasetDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleDatasetCreated}
      />
    </MainContentLayout>
  );
}

export { Datasets };
export default Datasets;
