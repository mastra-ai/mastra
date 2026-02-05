import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { format } from 'date-fns';
import type { DatasetItem } from '@mastra/client-js';
import {
  MainContentLayout,
  MainContentContent,
  DatasetDetail,
  RunTriggerDialog,
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
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editItemDialogOpen, setEditItemDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DatasetItem | null>(null);

  // Version selection state for run experiment button
  const [activeVersion, setActiveVersion] = useState<Date | string | null>(null);

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

  const handleRunSuccess = (runId: string) => {
    // Navigate to the run detail page
    navigate(`/datasets/${datasetId}/runs/${runId}`);
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
        <DatasetDetail
          datasetId={datasetId}
          onAddItemClick={() => setAddItemDialogOpen(true)}
          onEditClick={() => setEditDialogOpen(true)}
          onDeleteClick={() => setDeleteDialogOpen(true)}
          onEditItem={handleEditItem}
          onDeleteItem={handleDeleteItem}
          activeDatasetVersion={activeVersion}
          onVersionSelect={handleVersionSelect}
          runTriggerSlot={
            <Button variant="standard" size="default" onClick={() => setRunDialogOpen(true)}>
              <Play />
              {activeVersion ? `Run on ${format(new Date(activeVersion), 'MMM d, yyyy')}` : 'Run Experiment'}
            </Button>
          }
        />

        <RunTriggerDialog
          datasetId={datasetId}
          version={activeVersion ?? undefined}
          open={runDialogOpen}
          onOpenChange={setRunDialogOpen}
          onSuccess={handleRunSuccess}
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
              expectedOutput: itemToEdit.expectedOutput,
            }}
          />
        )}
      </MainContentContent>
    </MainContentLayout>
  );
}

export { DatasetPage };
export default DatasetPage;
