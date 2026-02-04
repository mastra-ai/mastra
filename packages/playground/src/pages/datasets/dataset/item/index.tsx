import { useParams, useNavigate } from 'react-router';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ArrowRightToLineIcon, Edit2Icon, FileCodeIcon, Trash2Icon } from 'lucide-react';
import {
  MainContentLayout,
  MainContentContent,
  useDatasetItemVersions,
  useDatasetMutations,
  useLinkComponent,
  DatasetItemContent,
  DatasetItemVersionsPanel,
  EditModeContent,
  Alert,
  AlertTitle,
  AlertDialog,
  Button,
  Icon,
  type DatasetItemVersion,
  Header,
  HeaderTitle,
  PageHeader,
  cn,
  ButtonsGroup,
  toast,
} from '@mastra/playground-ui';

function DatasetItemPage() {
  const { datasetId, itemId } = useParams<{ datasetId: string; itemId: string }>();
  const { Link } = useLinkComponent();
  const navigate = useNavigate();

  // Use versions as single source of truth - works for both active and deleted items
  const { data: versions, isLoading: isVersionsLoading } = useDatasetItemVersions(datasetId ?? '', itemId ?? '');
  const { updateItem, deleteItem } = useDatasetMutations();

  // Derive item state from versions
  const latestVersion = versions?.[0] ?? null;
  const isDeleted = latestVersion?.isDeleted ?? false;

  // Version viewing state - store full version object to use its snapshot
  const [selectedVersion, setSelectedVersion] = useState<DatasetItemVersion | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [expectedOutputValue, setExpectedOutputValue] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Sync form values when latest version changes (for non-deleted items)
  useEffect(() => {
    if (latestVersion && !isDeleted) {
      setInputValue(JSON.stringify(latestVersion.snapshot.input, null, 2));
      setExpectedOutputValue(
        latestVersion.snapshot.expectedOutput ? JSON.stringify(latestVersion.snapshot.expectedOutput, null, 2) : '',
      );
      setMetadataValue(latestVersion.snapshot.context ? JSON.stringify(latestVersion.snapshot.context, null, 2) : '');
    }
  }, [latestVersion?.versionNumber, isDeleted]);

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

  const handleSave = async () => {
    if (!datasetId || !itemId) return;

    // Parse and validate input JSON
    let parsedInput: unknown;
    try {
      parsedInput = JSON.parse(inputValue);
    } catch {
      toast.error('Input must be valid JSON');
      return;
    }

    // Parse expectedOutput if provided
    let parsedExpectedOutput: unknown | undefined;
    if (expectedOutputValue.trim()) {
      try {
        parsedExpectedOutput = JSON.parse(expectedOutputValue);
      } catch {
        toast.error('Expected Output must be valid JSON');
        return;
      }
    }

    // Parse metadata if provided
    let parsedMetadata: Record<string, unknown> | undefined;
    if (metadataValue.trim()) {
      try {
        parsedMetadata = JSON.parse(metadataValue);
      } catch {
        toast.error('Metadata must be valid JSON');
        return;
      }
    }

    try {
      await updateItem.mutateAsync({
        datasetId,
        itemId,
        input: parsedInput,
        expectedOutput: parsedExpectedOutput,
        metadata: parsedMetadata,
      });
      toast.success('Item updated successfully');
      setIsEditing(false);
    } catch (error) {
      toast.error(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    // Reset form values to latest version
    if (latestVersion) {
      setInputValue(JSON.stringify(latestVersion.snapshot.input, null, 2));
      setExpectedOutputValue(
        latestVersion.snapshot.expectedOutput ? JSON.stringify(latestVersion.snapshot.expectedOutput, null, 2) : '',
      );
      setMetadataValue(latestVersion.snapshot.context ? JSON.stringify(latestVersion.snapshot.context, null, 2) : '');
    }
    setIsEditing(false);
  };

  const handleDeleteConfirm = async () => {
    if (!datasetId || !itemId) return;
    try {
      await deleteItem.mutateAsync({ datasetId, itemId });
      toast.success('Item deleted successfully');
      setDeleteDialogOpen(false);
      navigate(`/datasets/${datasetId}`);
    } catch (error) {
      toast.error(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Determine which version to display
  const versionToDisplay = selectedVersion ?? latestVersion;

  // Build display item from version snapshot
  const displayItem = versionToDisplay
    ? {
        id: itemId ?? '',
        datasetId: datasetId ?? '',
        input: versionToDisplay.snapshot.input,
        expectedOutput: versionToDisplay.snapshot.expectedOutput,
        metadata: versionToDisplay.snapshot.context,
        createdAt: versionToDisplay.createdAt,
        version: versionToDisplay.datasetVersion,
      }
    : null;

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
      <MainContentLayout className="">
        <Header>
          <HeaderTitle>
            <Icon>
              <FileCodeIcon />
            </Icon>
            Dataset Item
          </HeaderTitle>
        </Header>
        <div className="h-full overflow-hidden px-6 pb-4">
          <div className="grid gap-6 max-w-[60rem] mx-auto grid-rows-[auto_1fr] h-full">
            <div className="grid grid-cols-[1fr_auto] gap-6 items-center">
              <PageHeader title="Dataset Item" icon={<FileCodeIcon />} />
              {!isEditing && !isDeleted && (
                <ButtonsGroup>
                  <Button
                    variant="standard"
                    size="default"
                    onClick={handleEditClick}
                    disabled={isViewingOldVersion}
                    title={isViewingOldVersion ? 'Return to latest version to edit' : undefined}
                  >
                    <Edit2Icon /> Edit
                  </Button>
                  <Button
                    variant="standard"
                    size="default"
                    onClick={handleDeleteClick}
                    disabled={isViewingOldVersion}
                    title={isViewingOldVersion ? 'Return to latest version to delete' : undefined}
                  >
                    <Trash2Icon /> Delete
                  </Button>
                </ButtonsGroup>
              )}
            </div>

            <div className="grid grid-cols-[1fr_1px_auto] gap-12 overflow-y-auto">
              <div
                className={cn('overflow-y-auto grid gap-6 content-start', {
                  'grid-rows-[auto_1fr]': isViewingOldVersion || isDeleted,
                })}
              >
                {isDeleted && latestVersion && (
                  <Alert variant="destructive">
                    <AlertTitle>
                      This item was deleted on{' '}
                      {format(new Date(latestVersion.datasetVersion), "MMM d, yyyy 'at' h:mm a")}
                    </AlertTitle>
                  </Alert>
                )}
                {!isDeleted && isViewingOldVersion && selectedVersion && (
                  <Alert variant="warning">
                    <AlertTitle>
                      Viewing version from {format(new Date(selectedVersion.datasetVersion), "MMM d, yyyy 'at' h:mm a")}
                    </AlertTitle>
                    <Button variant="standard" size="tiny" className="mt-2 mb-1" onClick={handleReturnToLatest}>
                      <ArrowRightToLineIcon className="inline-block mr-2" /> Return to the latest version
                    </Button>
                  </Alert>
                )}

                {isEditing ? (
                  <EditModeContent
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    expectedOutputValue={expectedOutputValue}
                    setExpectedOutputValue={setExpectedOutputValue}
                    metadataValue={metadataValue}
                    setMetadataValue={setMetadataValue}
                    validationErrors={null}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    isSaving={updateItem.isPending}
                  />
                ) : (
                  displayItem && (
                    <div className="grid content-start">
                      <DatasetItemContent item={displayItem} Link={Link} />
                    </div>
                  )
                )}
              </div>

              <div className="bg-surface5"></div>

              <div className="overflow-y-auto">
                <DatasetItemVersionsPanel
                  datasetId={datasetId}
                  itemId={itemId}
                  onClose={() => {}}
                  onVersionSelect={handleVersionSelect}
                  activeVersion={selectedVersion?.datasetVersion ?? null}
                />
              </div>
            </div>
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
