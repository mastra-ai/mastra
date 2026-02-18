import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import type { DatasetItem } from '@mastra/client-js';
import {
  MainContentLayout,
  MainContentContent,
  DatasetPageContent,
  ExperimentTriggerDialog,
  AddItemDialog,
  EditDatasetDialog,
  DeleteDatasetDialog,
  EditItemDialog,
  useDataset,
  useDatasetMutations,
  Button,
} from '@mastra/playground-ui';
import type { DatasetVersion } from '@mastra/playground-ui';
import { Play } from 'lucide-react';

function DatasetPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();

  // Dialog states
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DatasetItem | null>(null);

  // Version selection state for run experiment button
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  // Fetch dataset for edit dialog
  const { data: dataset } = useDataset(datasetId ?? '');
  const { deleteItem } = useDatasetMutations();

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

  const handleEditItem = (item: DatasetItem) => {
    setItemToEdit(item);
    setEditItemDialogOpen(true);
  };

  const handleDeleteItem = (itemId: string) => {
    deleteItem.mutate({ datasetId, itemId });
  };

  // Version selection handler for contextual run button
  const handleVersionSelect = (version: DatasetVersion | null) => {
    setActiveVersion(version?.version ?? null);
  };

  return (
    <MainContentLayout className="grid-rows-1">
      <MainContentContent className="content-stretch">
        <DatasetPageContent
          datasetId={datasetId}
          onAddItemClick={() => setAddItemDialogOpen(true)}
          onEditClick={() => setEditDialogOpen(true)}
          onDeleteClick={() => setDeleteDialogOpen(true)}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
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

        {/* Item edit dialog */}
        {itemToEdit && (
          <EditItemDialog
            datasetId={datasetId}
            open={editItemDialogOpen}
            onOpenChange={open => {
              setEditItemDialogOpen(open);
              if (!open) setItemToEdit(null);
            }}
            item={{
              id: itemToEdit.id,
              input: itemToEdit.input,
              groundTruth: itemToEdit.groundTruth,
            }}
          />
        )}
      </MainContentContent>
    </MainContentLayout>
  );
}

export { DatasetPage };
export default DatasetPage;
