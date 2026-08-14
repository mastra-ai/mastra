import type { DatasetItem } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { Column, Columns } from '@mastra/playground-ui/components/Columns';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { MainContentContent, MainContentLayout } from '@mastra/playground-ui/components/MainContent';
import { MainHeader } from '@mastra/playground-ui/components/MainHeader';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { TextAndIcon } from '@mastra/playground-ui/components/Text';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { toast } from '@mastra/playground-ui/utils/toast';
import { format } from 'date-fns';
import {
  ArrowRightToLineIcon,
  Calendar1Icon,
  DatabaseIcon,
  Edit2Icon,
  FileCodeIcon,
  HistoryIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { DatasetItemContent, DatasetItemEditForm, DatasetItemVersionsPanel } from '@/domains/datasets';
import { useDatasetItemVersions } from '@/domains/datasets/hooks/use-dataset-item-versions';
import type { DatasetItemVersion } from '@/domains/datasets/hooks/use-dataset-item-versions';
import { useDatasetMutations } from '@/domains/datasets/hooks/use-dataset-mutations';
import { useDataset } from '@/domains/datasets/hooks/use-datasets';
import { useLinkComponent } from '@/lib/framework';

function toDatasetItem(version: DatasetItemVersion, datasetId: string, itemId: string): DatasetItem {
  return {
    id: itemId,
    datasetId,
    datasetVersion: version.datasetVersion,
    input: version.input,
    groundTruth: version.groundTruth,
    expectedTrajectory: version.expectedTrajectory,
    toolMocks: version.toolMocks,
    scorerIds: version.scorerIds,
    timeout: version.timeout,
    requestContext: version.requestContext,
    metadata: version.metadata,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}

function DatasetItemPage() {
  const { datasetId, itemId } = useParams<{ datasetId: string; itemId: string }>();
  const { Link: FrameworkLink } = useLinkComponent();
  const navigate = useNavigate();

  // Use versions as single source of truth - works for both active and deleted items
  const { data: versions, isLoading: isVersionsLoading, error } = useDatasetItemVersions(datasetId ?? '', itemId ?? '');
  const { deleteItem } = useDatasetMutations();
  const { data: dataset } = useDataset(datasetId ?? '');

  // Derive item state from versions
  const latestVersion = versions?.[0] ?? null;
  const isDeleted = latestVersion?.isDeleted ?? false;

  // Version viewing state
  const [selectedVersion, setSelectedVersion] = useState<DatasetItemVersion | null>(null);

  const [isEditing, setIsEditing] = useState(false);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleVersionSelect = (version: DatasetItemVersion) => {
    // For deleted items, always keep a version selected
    // For active items, selecting latest clears selection (shows current)
    if (isDeleted) {
      setSelectedVersion(version);
    } else {
      setSelectedVersion(version.isLatest ? null : version);
    }
  };

  const handleReturnToLatest = () => {
    setSelectedVersion(null);
  };

  // Check if viewing an old version
  const isViewingOldVersion = !isDeleted && selectedVersion != null;

  const handleEditClick = () => {
    if (!isViewingOldVersion) {
      setIsEditing(true);
    }
  };

  const handleDeleteClick = () => {
    if (!isViewingOldVersion) {
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!datasetId || !itemId) return;
    try {
      await deleteItem.mutateAsync({ datasetId, itemId });
      toast.success('Item deleted successfully');
      setDeleteDialogOpen(false);
      void navigate(`/datasets/${datasetId}`);
    } catch (error) {
      toast.error(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Determine which version to display
  const versionToDisplay = selectedVersion ?? latestVersion;

  const displayItem =
    versionToDisplay && datasetId && itemId ? toDatasetItem(versionToDisplay, datasetId, itemId) : null;
  const editableItem = latestVersion && datasetId && itemId ? toDatasetItem(latestVersion, datasetId, itemId) : null;

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

  // Wait for versions to load
  if (isVersionsLoading) {
    return null;
  }

  // No versions = item never existed
  if (!datasetId || !itemId || !versions || versions.length === 0) {
    return (
      <MainContentLayout>
        <MainContentContent>
          <div className="text-neutral3 p-4">Item not found</div>
        </MainContentContent>
      </MainContentLayout>
    );
  }

  return (
    <>
      <MainContentLayout>
        <div className="h-full overflow-hidden px-6 pb-4">
          <div className="mx-auto grid h-full max-w-[60rem] grid-rows-[auto_1fr] gap-6">
            <MainHeader>
              <MainHeader.Column>
                <MainHeader.Title>
                  <FileCodeIcon />
                  {itemId} <CopyButton content={itemId} />
                </MainHeader.Title>
                <MainHeader.Description>
                  <TextAndIcon>
                    Item of <DatabaseIcon /> {dataset?.name}
                  </TextAndIcon>
                </MainHeader.Description>
                <MainHeader.Description>
                  <TextAndIcon>
                    <Calendar1Icon /> Created at{' '}
                    {latestVersion?.createdAt ? format(new Date(latestVersion.createdAt), 'MMM d, yyyy') : ''}
                  </TextAndIcon>
                  <TextAndIcon>
                    <HistoryIcon /> Latest version v{latestVersion?.datasetVersion ?? ''}
                  </TextAndIcon>
                </MainHeader.Description>
              </MainHeader.Column>
              <MainHeader.Column>
                {!isEditing && !isDeleted && (
                  <ButtonsGroup>
                    <Button
                      onClick={handleEditClick}
                      disabled={isViewingOldVersion}
                      title={isViewingOldVersion ? 'Return to latest version to edit' : undefined}
                    >
                      <Edit2Icon /> Edit
                    </Button>
                    <Button
                      onClick={handleDeleteClick}
                      disabled={isViewingOldVersion}
                      title={isViewingOldVersion ? 'Return to latest version to delete' : undefined}
                    >
                      <Trash2Icon /> Delete
                    </Button>
                  </ButtonsGroup>
                )}
              </MainHeader.Column>
            </MainHeader>

            <Columns className={isEditing ? 'grid-cols-1' : 'grid-cols-[1fr_auto]'}>
              <Column withRightSeparator={!isEditing}>
                {isDeleted && latestVersion && (
                  <Notice variant="destructive" title="Item deleted">
                    <Notice.Message>This item was deleted at version v{latestVersion.datasetVersion}</Notice.Message>
                  </Notice>
                )}

                {!isDeleted && isViewingOldVersion && selectedVersion && (
                  <Notice
                    variant="warning"
                    title="Previous version"
                    action={
                      <Notice.Button onClick={handleReturnToLatest}>
                        <ArrowRightToLineIcon /> Return to the latest version
                      </Notice.Button>
                    }
                  >
                    <Notice.Message>Viewing version v{selectedVersion.datasetVersion}</Notice.Message>
                  </Notice>
                )}

                {isEditing && editableItem ? (
                  <DatasetItemEditForm
                    key={editableItem.id}
                    item={editableItem}
                    onSuccess={() => setIsEditing(false)}
                    onCancel={() => setIsEditing(false)}
                  />
                ) : displayItem ? (
                  <DatasetItemContent item={displayItem} Link={FrameworkLink} />
                ) : (
                  <div className="text-neutral4 text-sm">Item data not available</div>
                )}
              </Column>
              {!isEditing && (
                <Column>
                  <DatasetItemVersionsPanel
                    datasetId={datasetId}
                    itemId={itemId}
                    onClose={() => {}}
                    onVersionSelect={handleVersionSelect}
                    onCompareVersionsClick={(versionIds: string[]) => {
                      void navigate(`/datasets/${datasetId}/items/${itemId}/versions?ids=${versionIds.join(',')}`);
                    }}
                    activeVersion={selectedVersion?.datasetVersion ?? null}
                  />
                </Column>
              )}
            </Columns>
          </div>
        </div>
      </MainContentLayout>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialog.Content>
          <AlertDialog.Header>
            <AlertDialog.Title>Delete Item</AlertDialog.Title>
            <AlertDialog.Description>
              Are you sure you want to delete this item? This action cannot be undone.
            </AlertDialog.Description>
          </AlertDialog.Header>
          <AlertDialog.Footer>
            <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action onClick={handleDeleteConfirm}>
              {deleteItem.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}

export { DatasetItemPage };
export default DatasetItemPage;
