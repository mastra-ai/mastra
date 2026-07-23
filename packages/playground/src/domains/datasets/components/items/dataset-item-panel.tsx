'use client';

import type { DatasetItem, DatasetItemToolMock } from '@mastra/client-js';
import { AlertDialog } from '@mastra/playground-ui/components/AlertDialog';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { toast } from '@mastra/playground-ui/utils/toast';
import { format } from 'date-fns/format';
import {
  BracesIcon,
  EllipsisVerticalIcon,
  FileInputIcon,
  FileOutputIcon,
  History,
  ListChecksIcon,
  Pencil,
  RouteIcon,
  TagIcon,
  Trash2,
  WrenchIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { EditModeContent } from '../dataset-detail/dataset-item-form';
import { useLinkComponent } from '@/lib/framework';

/** Schema validation error from API */
interface SchemaValidationError {
  field: 'input' | 'groundTruth' | 'toolMocks';
  errors: Array<{ path: string; message: string }>;
}

/** Parses API error message to extract schema validation details */
function parseValidationError(error: unknown): SchemaValidationError | null {
  if (!(error instanceof Error)) return null;

  // API error format: "HTTP error! status: 400 - {\"error\":\"...\",\"field\":\"...\",\"errors\":[...]}"
  const match = error.message.match(/- ({.*})$/);
  if (!match) return null;

  try {
    const parsed = JSON.parse(match[1]);
    if (parsed.field && Array.isArray(parsed.errors)) {
      return { field: parsed.field, errors: parsed.errors };
    }
  } catch {
    // Not valid JSON
  }
  return null;
}

export interface DatasetItemPanelProps {
  datasetId: string;
  item: DatasetItem;
  items: DatasetItem[];
  onItemChange: (itemId: string) => void;
  onClose: () => void;
}

/**
 * Inline panel showing full details of a single dataset item.
 * Includes navigation to next/previous items and sections for Input, Ground Truth, and Metadata.
 */
export function DatasetItemPanel({ datasetId, item, items, onItemChange, onClose }: DatasetItemPanelProps) {
  const { Link } = useLinkComponent();
  const { updateItem, deleteItem } = useDatasetMutations();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [groundTruthValue, setGroundTruthValue] = useState('');
  const [metadataValue, setMetadataValue] = useState('');
  const [trajectoryValue, setTrajectoryValue] = useState('');
  const [toolMocksValue, setToolMocksValue] = useState('');
  const [scorerOverrideEnabled, setScorerOverrideEnabled] = useState(item.scorerIds !== undefined);
  const [selectedScorerIds, setSelectedScorerIds] = useState(item.scorerIds ?? []);
  const [requestContextValue, setRequestContextValue] = useState('');

  // Validation error state
  const [validationErrors, setValidationErrors] = useState<SchemaValidationError | null>(null);

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form state when item changes (navigation or prop update)
  useEffect(() => {
    if (item) {
      setInputValue(JSON.stringify(item.input, null, 2));
      setGroundTruthValue(item.groundTruth ? JSON.stringify(item.groundTruth, null, 2) : '');
      setMetadataValue(item.metadata ? JSON.stringify(item.metadata, null, 2) : '');
      setTrajectoryValue(item.expectedTrajectory ? JSON.stringify(item.expectedTrajectory, null, 2) : '');
      setToolMocksValue(item.toolMocks?.length ? JSON.stringify(item.toolMocks, null, 2) : '');
      setScorerOverrideEnabled(item.scorerIds !== undefined);
      setSelectedScorerIds(item.scorerIds ?? []);
      setRequestContextValue(item.requestContext ? JSON.stringify(item.requestContext, null, 2) : '');
      setIsEditing(false); // Exit edit mode on item change
      setShowDeleteConfirm(false); // Reset delete state on item change
      setValidationErrors(null); // Reset validation errors on item change
    }
    // Intentionally depends on item.id only — re-running on every new `item` object
    // reference would clobber in-progress edits whenever the parent refetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id]);

  const currentIndex = items.findIndex(i => i.id === item.id);
  const onPrevious = currentIndex > 0 ? () => onItemChange(items[currentIndex - 1].id) : undefined;
  const onNext =
    currentIndex >= 0 && currentIndex < items.length - 1 ? () => onItemChange(items[currentIndex + 1].id) : undefined;

  // Form handlers
  const handleSave = async () => {
    // Validate input JSON
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

    // Parse expectedTrajectory: empty string means explicitly clear (null), omitted means keep existing
    let parsedTrajectory: unknown | null = null;
    if (trajectoryValue.trim()) {
      try {
        parsedTrajectory = JSON.parse(trajectoryValue);
      } catch {
        toast.error('Expected Trajectory must be valid JSON');
        return;
      }
    }

    // Parse toolMocks: empty string means clear, otherwise must be a JSON array
    let parsedToolMocks: DatasetItemToolMock[] | undefined;
    if (toolMocksValue.trim()) {
      try {
        const parsed = JSON.parse(toolMocksValue);
        if (!Array.isArray(parsed)) {
          toast.error('Tool Mocks must be a JSON array');
          return;
        }
        parsedToolMocks = parsed as DatasetItemToolMock[];
      } catch {
        toast.error('Tool Mocks must be valid JSON');
        return;
      }
    } else {
      parsedToolMocks = [];
    }

    // Parse requestContext if provided
    let parsedRequestContext: Record<string, unknown> | undefined;
    if (requestContextValue.trim()) {
      try {
        parsedRequestContext = JSON.parse(requestContextValue);
      } catch {
        toast.error('Request Context must be valid JSON');
        return;
      }
    }

    let scorerIds: string[] | null | undefined;
    if (scorerOverrideEnabled) {
      scorerIds = selectedScorerIds;
    } else if (item.scorerIds !== undefined) {
      scorerIds = null;
    }

    try {
      const updatedItem = await updateItem.mutateAsync({
        datasetId,
        itemId: item.id,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        metadata: parsedMetadata,
        expectedTrajectory: parsedTrajectory,
        toolMocks: parsedToolMocks,
        scorerIds,
        requestContext: parsedRequestContext,
      });

      toast.success('Item updated successfully');
      setScorerOverrideEnabled(updatedItem.scorerIds !== undefined);
      setSelectedScorerIds(updatedItem.scorerIds ?? []);
      setIsEditing(false);
      setValidationErrors(null);
    } catch (error) {
      // Check for schema validation error from API
      const schemaError = parseValidationError(error);
      if (schemaError) {
        setValidationErrors(schemaError);
      } else {
        toast.error(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setInputValue(JSON.stringify(item.input, null, 2));
    setGroundTruthValue(item.groundTruth ? JSON.stringify(item.groundTruth, null, 2) : '');
    setMetadataValue(item.metadata ? JSON.stringify(item.metadata, null, 2) : '');
    setTrajectoryValue(item.expectedTrajectory ? JSON.stringify(item.expectedTrajectory, null, 2) : '');
    setToolMocksValue(item.toolMocks?.length ? JSON.stringify(item.toolMocks, null, 2) : '');
    setScorerOverrideEnabled(item.scorerIds !== undefined);
    setSelectedScorerIds(item.scorerIds ?? []);
    setRequestContextValue(item.requestContext ? JSON.stringify(item.requestContext, null, 2) : '');
    setIsEditing(false);
    setValidationErrors(null);
  };

  // Clear validation errors on field change
  const handleInputValueChange = (value: string) => {
    setInputValue(value);
    if (validationErrors?.field === 'input') {
      setValidationErrors(null);
    }
  };

  const handleGroundTruthValueChange = (value: string) => {
    setGroundTruthValue(value);
    if (validationErrors?.field === 'groundTruth') {
      setValidationErrors(null);
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await deleteItem.mutateAsync({ datasetId, itemId: item.id });
      toast.success('Item deleted successfully');
      setShowDeleteConfirm(false);
      onClose(); // Close the panel after successful deletion
    } catch (error) {
      toast.error(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <>
      <DataPanel>
        <DataPanel.Header>
          <DataPanel.Heading>
            Item <b># {item.id.length > 12 ? `${item.id.slice(0, 12)}…` : item.id}</b>
          </DataPanel.Heading>
          <ButtonsGroup className="ml-auto shrink-0">
            <DataPanel.NextPrevNav
              onPrevious={onPrevious}
              onNext={onNext}
              previousLabel="Previous item"
              nextLabel="Next item"
            />
            {!isEditing && (
              <>
                <Button
                  as={Link}
                  href={`/datasets/${datasetId}/items/${item.id}`}
                  size="md"
                  tooltip="Go to item versions history"
                  aria-label="Go to item versions history"
                >
                  <History />
                </Button>

                <DropdownMenu>
                  <DropdownMenu.Trigger asChild>
                    <Button size="md" aria-label="Actions menu">
                      <EllipsisVerticalIcon />
                    </Button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end" className="w-48">
                    <DropdownMenu.Item onSelect={() => setIsEditing(true)}>
                      <Pencil />
                      Edit
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() => setShowDeleteConfirm(true)}
                      className="text-red-500 focus:text-red-400"
                    >
                      <Trash2 />
                      Delete Item
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu>
              </>
            )}
            <DataPanel.CloseButton onClick={onClose} tooltip="Close detail panel" />
          </ButtonsGroup>
        </DataPanel.Header>

        <DataPanel.Content>
          {isEditing ? (
            <EditModeContent
              inputValue={inputValue}
              setInputValue={handleInputValueChange}
              groundTruthValue={groundTruthValue}
              setGroundTruthValue={handleGroundTruthValueChange}
              metadataValue={metadataValue}
              setMetadataValue={setMetadataValue}
              trajectoryValue={trajectoryValue}
              setTrajectoryValue={setTrajectoryValue}
              toolMocksValue={toolMocksValue}
              setToolMocksValue={setToolMocksValue}
              scorerOverrideEnabled={scorerOverrideEnabled}
              setScorerOverrideEnabled={setScorerOverrideEnabled}
              selectedScorerIds={selectedScorerIds}
              setSelectedScorerIds={setSelectedScorerIds}
              requestContextValue={requestContextValue}
              setRequestContextValue={setRequestContextValue}
              validationErrors={validationErrors}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={updateItem.isPending}
            />
          ) : (
            <>
              <DataKeysAndValues>
                <DataKeysAndValues.Key>Dataset Id</DataKeysAndValues.Key>
                <DataKeysAndValues.ValueWithCopyBtn
                  copyTooltip="Copy Dataset Id to clipboard"
                  copyValue={item.datasetId}
                >
                  {item.datasetId}
                </DataKeysAndValues.ValueWithCopyBtn>
                <DataKeysAndValues.Key>Version</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>v{item.datasetVersion}</DataKeysAndValues.Value>
                <DataKeysAndValues.Key>Created</DataKeysAndValues.Key>
                <DataKeysAndValues.Value>
                  {format(new Date(item.createdAt), 'MMM d, yyyy h:mm aaa')}
                </DataKeysAndValues.Value>
                {item.updatedAt && new Date(item.updatedAt).getTime() !== new Date(item.createdAt).getTime() && (
                  <>
                    <DataKeysAndValues.Key>Updated</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>
                      {format(new Date(item.updatedAt), 'MMM d, yyyy h:mm aaa')}
                    </DataKeysAndValues.Value>
                  </>
                )}
              </DataKeysAndValues>

              <div className="grid gap-3 mt-3">
                <DataPanel.CodeSection
                  title="Input"
                  icon={<FileInputIcon />}
                  codeStr={JSON.stringify(item.input ?? null, null, 2)}
                />
                <DataPanel.CodeSection
                  title="Ground Truth"
                  icon={<FileOutputIcon />}
                  codeStr={JSON.stringify(item.groundTruth ?? null, null, 2)}
                />
                {item.expectedTrajectory != null && (
                  <DataPanel.CodeSection
                    title="Expected Trajectory"
                    icon={<RouteIcon />}
                    codeStr={JSON.stringify(item.expectedTrajectory, null, 2)}
                  />
                )}
                <DataPanel.CodeSection
                  title="Tool Mocks"
                  icon={<WrenchIcon />}
                  codeStr={JSON.stringify(item.toolMocks ?? [], null, 2)}
                />
                <DataPanel.CodeSection
                  title="Scorers"
                  icon={<ListChecksIcon />}
                  codeStr={
                    item.scorerIds === undefined ? 'Inherited from dataset' : JSON.stringify(item.scorerIds, null, 2)
                  }
                />
                {item.requestContext != null && (
                  <DataPanel.CodeSection
                    title="Request Context"
                    icon={<BracesIcon />}
                    codeStr={JSON.stringify(item.requestContext, null, 2)}
                  />
                )}
                <DataPanel.CodeSection
                  title="Metadata"
                  icon={<TagIcon />}
                  codeStr={JSON.stringify(item.metadata ?? null, null, 2)}
                />
              </div>
            </>
          )}
        </DataPanel.Content>
      </DataPanel>

      {/* Delete confirmation - uses portal, renders above panel */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
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
              {deleteItem.isPending ? 'Deleting...' : 'Yes, Delete'}
            </AlertDialog.Action>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
}
