import { useState } from 'react';
import { Plus, Database } from 'lucide-react';
import {
  Header,
  HeaderTitle,
  MainContentLayout,
  MainContentContent,
  Icon,
  Button,
  HeaderAction,
  useLinkComponent,
  useDatasets,
  DatasetsTable,
  CreateDatasetDialog,
} from '@mastra/playground-ui';

function Datasets() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { data, isLoading } = useDatasets();
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
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && datasets.length === 0}>
        <DatasetsTable datasets={datasets} isLoading={isLoading} onCreateClick={() => setIsCreateDialogOpen(true)} />
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
