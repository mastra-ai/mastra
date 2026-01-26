import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  MainContentLayout,
  MainContentContent,
  DatasetDetail,
  RunTriggerDialog,
  AddItemDialog,
  Button,
  Icon,
} from '@mastra/playground-ui';
import { Play } from 'lucide-react';

function Dataset() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);

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

  return (
    <MainContentLayout>
      <MainContentContent>
        <DatasetDetail
          datasetId={datasetId}
          onAddItemClick={() => setAddItemDialogOpen(true)}
          runTriggerSlot={
            <Button variant="primary" size="sm" onClick={() => setRunDialogOpen(true)}>
              <Icon>
                <Play />
              </Icon>
              Run
            </Button>
          }
        />

        <RunTriggerDialog
          datasetId={datasetId}
          open={runDialogOpen}
          onOpenChange={setRunDialogOpen}
          onSuccess={handleRunSuccess}
        />

        <AddItemDialog
          datasetId={datasetId}
          open={addItemDialogOpen}
          onOpenChange={setAddItemDialogOpen}
        />
      </MainContentContent>
    </MainContentLayout>
  );
}

export { Dataset };
export default Dataset;
