import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { ErrorState } from '@mastra/playground-ui/components/ErrorState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { format } from 'date-fns/format';
import { ArrowLeft, Copy, DatabaseIcon, FlaskConical, MoreVertical, Pencil, Play, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, Outlet, useParams, useNavigate, useSearchParams } from 'react-router';
import {
  DatasetItemsView,
  DatasetVersions,
  DuplicateDatasetDialog,
  ExperimentTriggerDialog,
  AddItemDialog,
  DeleteDatasetDialog,
} from '@/domains/datasets';
import { DatasetItemPanelProvider } from '@/domains/datasets/context/dataset-item-panel-context';
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
  const { activeVersion, handleVersionChange } = useDatasetItemsUrlState(searchParams, setSearchParams);

  // Dialog states
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // Fetch dataset for edit dialog
  const { data: dataset, error, isLoading: isDatasetLoading } = useDataset(datasetId);

  // Unfiltered items query — used to disable the experiment trigger when the
  // dataset has no items. React Query dedupes this with the same call inside
  // DatasetItemsView.
  const { data: unfilteredItems = [], isLoading: isUnfilteredLoading } = useDatasetItems(
    datasetId,
    undefined,
    activeVersion,
  );
  const disableExperimentTrigger = !isUnfilteredLoading && unfilteredItems.length === 0;

  if (isDatasetLoading) return null; // Let the DatasetItemsView handle the loading state to avoid layout shift when loading the dataset for the edit dialog

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
    void navigate(`/experiments/${experimentId}`);
  };

  const handleDeleteSuccess = () => {
    // Navigate back to datasets list
    void navigate('/datasets');
  };

  return (
    <DatasetItemPanelProvider datasetId={datasetId} items={unfilteredItems} isLoadingItems={isUnfilteredLoading}>
      <div className="relative h-full overflow-hidden">
        <PageLayout height="full" className="grid-rows-[1fr] p-0">
          <PageLayout.MainArea>
            <DatasetItemsView
              datasetId={datasetId}
              onAddItemClick={() => setAddItemDialogOpen(true)}
              leftSlot={
                <span className="text-ui-sm text-neutral3 mr-3 whitespace-nowrap">
                  {dataset?.createdAt ? `Created ${format(new Date(dataset.createdAt), 'MMM d')}` : ''}
                </span>
              }
              rightSlot={
                <ButtonsGroup>
                  <Button as={Link} to={`/experiments?dataset=${datasetId}`}>
                    <FlaskConical />
                    View experiments
                  </Button>
                  <DatasetVersions
                    datasetId={datasetId}
                    value={activeVersion}
                    onValueChange={handleVersionChange}
                    currentVersion={dataset?.version}
                    className="w-36"
                  />
                  {disableExperimentTrigger ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-not-allowed">
                          <div className="pointer-events-none opacity-50" inert aria-disabled="true">
                            <Button variant="primary">
                              <Play />
                              Run Experiment
                            </Button>
                          </div>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Add items to the dataset before running an experiment</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button variant="primary" onClick={() => setExperimentDialogOpen(true)}>
                      <Play />
                      Run Experiment
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenu.Trigger asChild>
                      <Button size="lg" aria-label="Dataset actions menu">
                        <MoreVertical />
                      </Button>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Content align="end" className="w-48">
                      <DropdownMenu.Item onSelect={() => void navigate(`/datasets/${datasetId}/edit`)}>
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
              }
            />
          </PageLayout.MainArea>
        </PageLayout>

        {/* Item detail sub-route renders here as an absolute overlay panel */}
        <Outlet />
      </div>

      <ExperimentTriggerDialog
        key={`${datasetId}:${activeVersion ?? 'latest'}`}
        initialDatasetId={datasetId}
        initialDatasetVersion={activeVersion ?? undefined}
        open={experimentDialogOpen}
        onOpenChange={setExperimentDialogOpen}
        onSuccess={handleExperimentSuccess}
      />

      <AddItemDialog datasetId={datasetId} open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen} />

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
    </DatasetItemPanelProvider>
  );
}

export { DatasetPage };
export default DatasetPage;
