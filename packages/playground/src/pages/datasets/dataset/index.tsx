import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  MainContentLayout,
  MainContentContent,
  DatasetPageContent,
  ExperimentTriggerDialog,
  AddItemDialog,
  EditDatasetDialog,
  DeleteDatasetDialog,
  useDataset,
  Button,
  Header,
  Breadcrumb,
  Crumb,
  Icon,
  DatasetCombobox,
} from '@mastra/playground-ui';
import type { DatasetVersion } from '@mastra/playground-ui';
import { Link } from 'react-router';
import { Database, Play } from 'lucide-react';

function DatasetPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();

  // Dialog states
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Version selection state for run experiment button
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  // Fetch dataset for edit dialog
  const { data: dataset } = useDataset(datasetId ?? '');

  if (!datasetId) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral3 p-4">Dataset not found</div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  const handleExperimentSuccess = (experimentId: string) => {
    navigate(`/datasets/${datasetId}/experiments/${experimentId}`);
  };

  const handleDeleteSuccess = () => {
    // Navigate back to datasets list
    navigate('/datasets');
  };

  // Version selection handler for contextual run button
  const handleVersionSelect = (version: DatasetVersion | null) => {
    setActiveVersion(version?.version ?? null);
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
          <Crumb as="span" to="" isCurrent>
            <DatasetCombobox value={datasetId} variant="ghost" />
          </Crumb>
        </Breadcrumb>
      </Header>
      <MainContentContent className="content-stretch">
        <DatasetPageContent
          datasetId={datasetId}
          onAddItemClick={() => setAddItemDialogOpen(true)}
          onEditClick={() => setEditDialogOpen(true)}
          onDeleteClick={() => setDeleteDialogOpen(true)}
          activeDatasetVersion={activeVersion}
          onVersionSelect={handleVersionSelect}
          experimentTriggerSlot={
            <Button variant="cta" size="default" onClick={() => setExperimentDialogOpen(true)}>
              <Play />
              {activeVersion != null ? `Run on v${activeVersion}` : 'Run Experiment'}
            </Button>
          }
        />

        <ExperimentTriggerDialog
          datasetId={datasetId}
          version={activeVersion ?? undefined}
          open={experimentDialogOpen}
          onOpenChange={setExperimentDialogOpen}
          onSuccess={handleExperimentSuccess}
        />

        <AddItemDialog datasetId={datasetId} open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen} />

        {/* Dataset edit dialog */}
        {dataset && (
          <EditDatasetDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            dataset={{
              id: dataset.id,
              name: dataset.name,
              description: dataset?.description || '',
              inputSchema: dataset.inputSchema,
              groundTruthSchema: dataset.groundTruthSchema,
            }}
          />
        )}

        {/* Dataset delete dialog */}
        {dataset && (
          <DeleteDatasetDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            datasetId={dataset.id}
            datasetName={dataset.name}
            onSuccess={handleDeleteSuccess}
          />
        )}
      </MainContentContent>
    </MainContentLayout>
  );
}

export { DatasetPage };
export default DatasetPage;
