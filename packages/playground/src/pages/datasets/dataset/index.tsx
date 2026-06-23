import {
  Button,
  ButtonsGroup,
  DropdownMenu,
  EmptyState,
  ErrorState,
  PageLayout,
  PermissionDenied,
  SessionExpired,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  is401UnauthorizedError,
  is403ForbiddenError,
  is404NotFoundError,
} from '@mastra/playground-ui';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { format } from 'date-fns/format';
import { ArrowLeft, Copy, DatabaseIcon, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router';
import {
  DatasetPageTabs,
  DuplicateDatasetDialog,
  ExperimentTriggerDialog,
  AddItemDialog,
  EditDatasetDialog,
  DeleteDatasetDialog,
} from '@/domains/datasets';
import { useDatasetItems } from '@/domains/datasets/hooks/use-dataset-items';
import { useDatasetItemsUrlState } from '@/domains/datasets/hooks/use-dataset-items-url-state';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';

function DatasetPageShell({ children }: { children?: ReactNode }) {
  return (
    <PageLayout height="full">
      <div />
      <PageLayout.MainArea isCentered>{children}</PageLayout.MainArea>
    </PageLayout>
  );
}

function DatasetPage() {
  const { datasetId } = useParams()! as { datasetId: string };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeVersion } = useDatasetItemsUrlState(searchParams, setSearchParams);

  // Dialog states
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // Fetch dataset for edit dialog
  const { data: dataset, error, isLoading: isDatasetLoading } = useDataset(datasetId);

  // Unfiltered items query — used to disable the experiment trigger when the
  // dataset has no items. React Query dedupes this with the same call inside
  // DatasetPageTabs.
  const { data: unfilteredItems = [], isLoading: isUnfilteredLoading } = useDatasetItems(
    datasetId,
    undefined,
    activeVersion,
  );
  const disableExperimentTrigger = !isUnfilteredLoading && unfilteredItems.length === 0;

  if (isDatasetLoading) return null; // Let the DatasetPageTabs handle the loading state to avoid layout shift when loading the dataset for the edit dialog

  if (error && is401UnauthorizedError(error)) {
    return (
      <DatasetPageShell>
        <SessionExpired />
      </DatasetPageShell>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <DatasetPageShell>
        <PermissionDenied resource="datasets" />
      </DatasetPageShell>
    );
  }

  if ((error && is404NotFoundError(error)) || (!isDatasetLoading && !error && !dataset)) {
    return (
      <DatasetPageShell>
        <EmptyState
          iconSlot={<DatabaseIcon />}
          titleSlot="Dataset not found"
          descriptionSlot={`No dataset with id "${datasetId}".`}
          actionSlot={
            <Button as={Link} to="/datasets">
              <ArrowLeft />
              Back to Datasets
            </Button>
          }
        />
      </DatasetPageShell>
    );
  }

  if (error) {
    return (
      <DatasetPageShell>
        <ErrorState
          title="Failed to load dataset"
          message={error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
        />
      </DatasetPageShell>
    );
  }

  const handleExperimentSuccess = (experimentId: string) => {
    void navigate(`/datasets/${datasetId}/experiments/${experimentId}`);
  };

  const handleDeleteSuccess = () => {
    // Navigate back to datasets list
    void navigate('/datasets');
  };

  return (
    <>
      <PageLayout height="full">
        <PageLayout.TopArea>
          <PageLayout.Row>
            <PageLayout.Column>
              {dataset?.description && <p className="text-ui-smd text-neutral3 mb-1">{dataset.description}</p>}
              <DataKeysAndValues numOfCol={2}>
                <DataKeysAndValues.Key>Created at</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  {dataset?.createdAt ? format(new Date(dataset.createdAt), 'MMM d, yyyy') : ''}
                </DataKeysAndValues.Value>
                <DataKeysAndValues.Key>Latest version</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>v{dataset?.version ?? ''}</DataKeysAndValues.Value>
              </DataKeysAndValues>
            </PageLayout.Column>
            <PageLayout.Column>
              <ButtonsGroup>
                {disableExperimentTrigger ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-not-allowed">
                        <div className="pointer-events-none opacity-50" inert aria-disabled="true">
                          <Button variant="primary">
                            <Play />
                            {activeVersion != null ? `Run on v${activeVersion}` : 'Run Experiment'}
                          </Button>
                        </div>
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Add items to the dataset before running an experiment</TooltipContent>
                  </Tooltip>
                ) : (
                  <Button variant="primary" onClick={() => setExperimentDialogOpen(true)}>
                    <Play />
                    {activeVersion != null ? `Run on v${activeVersion}` : 'Run Experiment'}
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button size="lg" aria-label="Dataset actions menu">
                      <MoreVertical />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" className="w-48">
                    <DropdownMenu.Item onSelect={() => setEditDialogOpen(true)}>
                      <Pencil /> Edit Dataset
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onSelect={() => setDuplicateDialogOpen(true)}>
                      <Copy /> Duplicate Dataset
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => setDeleteDialogOpen(true)}
                      className="text-red-500 focus:text-red-400"
                    >
                      <Trash2 /> Delete Dataset
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </ButtonsGroup>
            </PageLayout.Column>
          </PageLayout.Row>
        </PageLayout.TopArea>

        <PageLayout.MainArea>
          <DatasetPageTabs datasetId={datasetId} onAddItemClick={() => setAddItemDialogOpen(true)} />
        </PageLayout.MainArea>
      </PageLayout>

      <ExperimentTriggerDialog
        datasetId={datasetId}
        version={activeVersion ?? undefined}
        requestContextSchema={dataset?.requestContextSchema}
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
            targetType: dataset.targetType,
            inputSchema: dataset.inputSchema,
            groundTruthSchema: dataset.groundTruthSchema,
            requestContextSchema: dataset.requestContextSchema,
          }}
        />
      )}

      {/* Dataset duplicate dialog */}
      {dataset && (
        <DuplicateDatasetDialog
          open={duplicateDialogOpen}
          onOpenChange={setDuplicateDialogOpen}
          sourceDatasetId={dataset.id}
          sourceDatasetName={dataset.name}
          sourceDatasetDescription={(dataset as { description?: string }).description}
          sourceDatasetTargetType={dataset.targetType}
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
    </>
  );
}

export { DatasetPage };
export default DatasetPage;
