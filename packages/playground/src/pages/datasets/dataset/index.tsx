import {
  Breadcrumb,
  Button,
  Crumb,
  Header,
  Icon,
  MainContentContent,
  MainContentLayout,
  PermissionDenied,
  SessionExpired,
  is401UnauthorizedError,
  is403ForbiddenError,
} from '@mastra/playground-ui';
import { Database, Play } from 'lucide-react';
import { useState } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import {
  DatasetPageContent,
  ExperimentTriggerDialog,
  AddItemDialog,
  EditDatasetDialog,
  DeleteDatasetDialog,
  DatasetCombobox,
} from '@/domains/datasets';
import type { DatasetVersion } from '@/domains/datasets/hooks/use-dataset-versions';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';

type DatasetTab = 'items' | 'experiments' | 'review';
const VALID_TABS = new Set<string>(['items', 'experiments', 'review']);

function DatasetPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab: DatasetTab = tabParam && VALID_TABS.has(tabParam) ? (tabParam as DatasetTab) : 'items';

  const handleTabChange = (tab: DatasetTab) => {
    setSearchParams(tab === 'items' ? {} : { tab }, { replace: true });
  };

  // Dialog states
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Version selection state for run experiment button
  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  // Fetch dataset for edit dialog
  const { data: dataset, error } = useDataset(datasetId ?? '');

  if (!datasetId) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral3 p-4">Dataset not found</div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  if (error && is401UnauthorizedError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <SessionExpired />
        </div>
      </MainContentLayout>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <MainContentLayout>
        <div className="flex h-full items-center justify-center">
          <PermissionDenied resource="datasets" />
        </div>
      </MainContentLayout>
    );
  }

  const handleExperimentSuccess = (experimentId: string) => {
    void navigate(`/datasets/${datasetId}/experiments/${experimentId}`);
  };

  const handleDeleteSuccess = () => {
    // Navigate back to datasets list
    void navigate('/datasets');
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
          initialTab={initialTab}
          onTabChange={handleTabChange}
          experimentTriggerSlot={
            <Button variant="primary" onClick={() => setExperimentDialogOpen(true)}>
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
