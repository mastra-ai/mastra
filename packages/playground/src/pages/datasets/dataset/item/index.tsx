import { useParams, useNavigate, Link } from 'react-router';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangleIcon,
  ArrowRightToLineIcon,
  Calendar1Icon,
  DatabaseIcon,
  Edit2Icon,
  FileCodeIcon,
  HistoryIcon,
  Trash2Icon,
} from 'lucide-react';
import {
  MainContentLayout,
  MainContentContent,
  useDatasetItemVersions,
  useDatasetMutations,
  useLinkComponent,
  DatasetItemContent,
  DatasetItemVersionsPanel,
  EditModeContent,
  AlertDialog,
  Button,
  Icon,
  type DatasetItemVersion,
  Header,
  Breadcrumb,
  Crumb,
  MainHeader,
  ButtonsGroup,
  toast,
  TextAndIcon,
  useDataset,
  CopyButton,
  Columns,
  Column,
  Notice,
} from '@mastra/playground-ui';

function DatasetItemPage() {
  const { datasetId, itemId } = useParams<{ datasetId: string; itemId: string }>();
  const { Link: FrameworkLink } = useLinkComponent();
  const navigate = useNavigate();

  // Use versions as single source of truth - works for both active and deleted items
  const { data: versions, isLoading: isVersionsLoading } = useDatasetItemVersions(datasetId ?? '', itemId ?? '');
  const { updateItem, deleteItem } = useDatasetMutations();
  const { data: dataset } = useDataset(datasetId ?? '');

  // Derive item state from versions
  const latestVersion = versions?.[0] ?? null;
  const isDeleted = latestVersion?.isDeleted ?? false;

  // Version viewing state
  const [selectedVersion, setSelectedVersion] = useState<DatasetItemVersion | null>(null);

  // Derive form defaults from latest version (recomputes when version changes)
  const formDefaults = useMemo(() => {
    if (!latestVersion || isDeleted) return { input: '', groundTruth: '', metadata: '' };
    return {
      input: JSON.stringify(latestVersion.input, null, 2),
      groundTruth: latestVersion.groundTruth ? JSON.stringify(latestVersion.groundTruth, null, 2) : '',
      metadata: latestVersion.metadata ? JSON.stringify(latestVersion.metadata, null, 2) : '',
    };
  }, [latestVersion, isDeleted]);

  // Use datasetVersion as key to reset form state when version changes
  const versionKey = latestVersion?.datasetVersion ?? 0;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(formDefaults.input);
  const [groundTruthValue, setGroundTruthValue] = useState(formDefaults.groundTruth);
  const [metadataValue, setMetadataValue] = useState(formDefaults.metadata);

  // Reset form values when version changes (key-based reset pattern)
  const [prevVersionKey, setPrevVersionKey] = useState(versionKey);
  if (versionKey !== prevVersionKey) {
    setPrevVersionKey(versionKey);
    setInputValue(formDefaults.input);
    setGroundTruthValue(formDefaults.groundTruth);
    setMetadataValue(formDefaults.metadata);
  }

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

    // Parse groundTruth if provided
    let parsedGroundTruth: unknown | undefined;
    if (groundTruthValue.trim()) {
      try {
        parsedGroundTruth = JSON.parse(groundTruthValue);
      } catch {
        toast.error('Ground Truth must be valid JSON');
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
        groundTruth: parsedGroundTruth,
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
      setInputValue(JSON.stringify(latestVersion.input, null, 2));
      setGroundTruthValue(latestVersion.groundTruth ? JSON.stringify(latestVersion.groundTruth, null, 2) : '');
      setMetadataValue(latestVersion.metadata ? JSON.stringify(latestVersion.metadata, null, 2) : '');
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

  // Build display item from flat version data
  const displayItem = versionToDisplay
    ? {
        id: itemId ?? '',
        datasetId: datasetId ?? '',
        datasetVersion: versionToDisplay.datasetVersion,
        input: versionToDisplay.input,
        groundTruth: versionToDisplay.groundTruth,
        metadata: versionToDisplay.metadata,
        createdAt: versionToDisplay.createdAt,
        updatedAt: versionToDisplay.updatedAt,
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
      <MainContentLayout>
        <Header>
          <Breadcrumb>
            <Crumb as={Link} to="/datasets">
              <Icon>
                <DatabaseIcon />
              </Icon>
              Datasets
            </Crumb>
            <Crumb as={Link} to={`/datasets/${datasetId}`}>
              {dataset?.name}
            </Crumb>
            <Crumb isCurrent as="span">
              Item
            </Crumb>
          </Breadcrumb>
        </Header>
        <div className="h-full overflow-hidden px-6 pb-4">
          <div className="grid gap-6 max-w-[60rem] mx-auto grid-rows-[auto_1fr] h-full">
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
                      variant="cta"
                      size="default"
                      onClick={handleEditClick}
                      disabled={isViewingOldVersion}
                      title={isViewingOldVersion ? 'Return to latest version to edit' : undefined}
                    >
                      <Edit2Icon /> Edit
                    </Button>
                    <Button
                      variant="cta"
                      size="default"
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
                  <Notice variant="destructive">
                    <AlertTriangleIcon />
                    <Notice.Message>This item was deleted at version v{latestVersion.datasetVersion}</Notice.Message>
                  </Notice>
                )}

                {!isDeleted && isViewingOldVersion && selectedVersion && (
                  <>
                    <Notice variant="warning">
                      <AlertTriangleIcon />
                      <Notice.Message>Viewing version v{selectedVersion.datasetVersion}</Notice.Message>
                      <Notice.Button onClick={handleReturnToLatest}>
                        <ArrowRightToLineIcon /> Return to the latest version
                      </Notice.Button>
                    </Notice>
                  </>
                )}

                {isEditing ? (
                  <EditModeContent
                    inputValue={inputValue}
                    setInputValue={setInputValue}
                    groundTruthValue={groundTruthValue}
                    setGroundTruthValue={setGroundTruthValue}
                    metadataValue={metadataValue}
                    setMetadataValue={setMetadataValue}
                    validationErrors={null}
                    onSave={handleSave}
                    onCancel={handleCancel}
                    isSaving={updateItem.isPending}
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
                      navigate(`/datasets/${datasetId}/items/${itemId}/versions?ids=${versionIds.join(',')}`);
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
