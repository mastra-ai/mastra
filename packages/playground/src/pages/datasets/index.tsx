import {
  Button,
  useDatasets,
  DatasetsList,
  CreateDatasetDialog,
  useLinkComponent,
  PageContent,
  MainHeader,
} from '@mastra/playground-ui';
import { Plus, Database, ExternalLinkIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

function Datasets() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();
  const { data, isLoading, error } = useDatasets();
  const datasets = data?.datasets ?? [];

  const handleDatasetCreated = (datasetId: string) => {
    setIsCreateDialogOpen(false);
    navigate(paths.datasetLink(datasetId));
  };

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button
          as={Link}
          to="https://mastra.ai/docs/observability/datasets/overview"
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          size="md"
        >
          Datasets documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[80rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <Database /> Datasets
              </MainHeader.Title>
            </MainHeader.Column>
            <MainHeader.Column>
              <Button variant="primary" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus />
                Create Dataset
              </Button>
            </MainHeader.Column>
          </MainHeader>

          <DatasetsList
            datasets={datasets}
            isLoading={isLoading}
            onCreateClick={() => setIsCreateDialogOpen(true)}
            error={error}
          />
        </div>
      </PageContent.Main>

      <CreateDatasetDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={handleDatasetCreated}
      />
    </PageContent>
  );
}

export { Datasets };
export default Datasets;
