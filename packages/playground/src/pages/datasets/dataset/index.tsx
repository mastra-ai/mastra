import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { EmptyState } from '@mastra/playground-ui/components/EmptyState';
import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/domains/auth/components/permission-denied';
import { SessionExpired } from '@mastra/playground-ui/domains/auth/components/session-expired';
import { AddDatasetItemDialog } from '@mastra/playground-ui/domains/datasets';
import { ExperimentsIcon } from '@mastra/playground-ui/icons/ExperimentsIcon';
import { is401UnauthorizedError, is403ForbiddenError, is404NotFoundError } from '@mastra/playground-ui/utils/errors';
import { useDataset, useDatasetItems } from '@mastra/react/hooks/datasets';
import { ArrowLeft, Copy, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router';
import { PageBreadcrumbs } from '@/components/ui/page-breadcrumbs';
import {
  DatasetItemsView,
  DatasetTagsEditor,
  DuplicateDatasetDialog,
  ExperimentTriggerDialog,
  DeleteDatasetDialog,
} from '@/domains/datasets';
import { DatasetItemSidePanel } from '@/domains/datasets/components/items/dataset-item-side-panel';
import { DatasetItemPanelProvider } from '@/domains/datasets/context/dataset-item-panel-context';
import { useDatasetItemsUrlState } from '@/domains/datasets/hooks/use-dataset-items-url-state';
import { datasetCrumb, datasetVersionCrumb, navCrumb } from '@/domains/navigation/crumbs';
import type { CrumbDef } from '@/domains/navigation/crumbs';

function DatasetPageShell({ crumbs, children }: { crumbs: CrumbDef[]; children?: ReactNode }) {
  return (
    <PageLayout breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />}>
      <h1 className="sr-only">Dataset</h1>
      <div />
      <div className="flex h-full items-center justify-center">{children}</div>
    </PageLayout>
  );
}

function DatasetPage() {
  const { datasetId } = useParams() as { datasetId: string };
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { activeVersion } = useDatasetItemsUrlState(searchParams, setSearchParams);
  // The dataset crumb never links: its whole hit area is the dataset switcher.
  const shellCrumbs: CrumbDef[] = [navCrumb('/datasets'), datasetCrumb];
  // The selected item shows in the side panel, so it gets no crumb of its own.
  const crumbs: CrumbDef[] = [...shellCrumbs, datasetVersionCrumb];

  // Dialog states
  const [experimentDialogOpen, setExperimentDialogOpen] = useState(false);
  const [addItemDialogOpen, setAddItemDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);

  // Fetch dataset for edit dialog
  const {
    data: dataset,
    error,
    isLoading: isDatasetLoading,
  } = useDataset({ datasetId: datasetId, queryOptions: { enabled: Boolean(datasetId) } });

  // Unfiltered items query — gates the data-dependent header actions. React Query
  // dedupes this with the same call inside DatasetItemsView.
  const { data: unfilteredItems = [], isLoading: isUnfilteredLoading } = useDatasetItems({
    datasetId: datasetId,
    search: undefined,
    version: activeVersion,
    queryOptions: { enabled: Boolean(datasetId) },
  });

  if (isDatasetLoading) return null; // Let the DatasetItemsView handle the loading state to avoid layout shift when loading the dataset for the edit dialog

  if (error && is401UnauthorizedError(error)) {
    return (
      <DatasetPageShell crumbs={shellCrumbs}>
        <SessionExpired />
      </DatasetPageShell>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <DatasetPageShell crumbs={shellCrumbs}>
        <PermissionDenied resource="datasets" />
      </DatasetPageShell>
    );
  }

  if ((error && is404NotFoundError(error)) || (!isDatasetLoading && !error && !dataset)) {
    return (
      <DatasetPageShell crumbs={shellCrumbs}>
        <EmptyState
          titleSlot="Dataset not found"
          descriptionSlot={`No dataset with id "${datasetId}".`}
          actionSlot={
            <Button render={<Link to="/datasets" />} icon={<ArrowLeft />}>
              Back to Datasets
            </Button>
          }
        />
      </DatasetPageShell>
    );
  }

  if (error) {
    return (
      <DatasetPageShell crumbs={shellCrumbs}>
        <EmptyState
          tone="error"
          titleSlot="Failed to load dataset"
          descriptionSlot={error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'}
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

  const hasItems = unfilteredItems.length > 0;
  // A dataset that has been edited keeps versions (and possibly experiments) even once emptied.
  const hasHistory = (dataset?.version ?? 0) > 0;
  const showDataActions = hasItems || hasHistory;
  // Keep the editor for empty datasets that are already tagged so their tags stay visible.
  const showTagsEditor = hasItems || (dataset?.tags?.length ?? 0) > 0;

  const headerActions = (
    <>
      {hasItems && (
        <Button variant="ghost" size="sm" onClick={() => setExperimentDialogOpen(true)} icon={<Plus />}>
          New experiment
        </Button>
      )}
      {showDataActions && (
        <Button
          variant="ghost"
          size="sm"
          render={<Link to={`/experiments?dataset=${datasetId}`} />}
          icon={<ExperimentsIcon />}
        >
          Experiments
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenu.Trigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Dataset actions menu">
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
          <DropdownMenu.Item onSelect={() => setDeleteDialogOpen(true)} variant="destructive">
            <Trash2 /> Delete Dataset
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu>
    </>
  );

  return (
    <DatasetItemPanelProvider datasetId={datasetId} items={unfilteredItems} isLoadingItems={isUnfilteredLoading}>
      <div className="h-full">
        <PageLayout variant="fit" breadcrumbs={<PageBreadcrumbs crumbs={crumbs} />} headerActions={headerActions}>
          <h1 className="sr-only">{datasetId}</h1>
          <div>
            <DatasetItemsView
              datasetId={datasetId}
              onAddItemClick={() => setAddItemDialogOpen(true)}
              toolbarActionsSlot={showTagsEditor ? <DatasetTagsEditor datasetId={datasetId} /> : undefined}
            />
          </div>
        </PageLayout>

        {/* Selected item of the `items/:itemId` child route, in the route side panel. */}
        <DatasetItemSidePanel />
      </div>

      <ExperimentTriggerDialog
        key={`${datasetId}:${activeVersion ?? 'latest'}`}
        initialDatasetId={datasetId}
        initialDatasetVersion={activeVersion ?? undefined}
        open={experimentDialogOpen}
        onOpenChange={setExperimentDialogOpen}
        onSuccess={handleExperimentSuccess}
      />

      <AddDatasetItemDialog datasetId={datasetId} open={addItemDialogOpen} onOpenChange={setAddItemDialogOpen} />

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
