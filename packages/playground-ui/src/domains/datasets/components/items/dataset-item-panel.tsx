'use client';

import { useState, useEffect } from 'react';
import type { DatasetItem } from '@mastra/client-js';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { ItemDetailToolbar } from '../dataset-detail/item-detail-toolbar';
import { DatasetItemHeader } from '../dataset-detail/dataset-item-header';
import { DatasetItemContent } from '../dataset-detail/dataset-item-content';
import { EditModeContent } from '../dataset-detail/dataset-item-form';
import { Column } from '@/ds/components/Columns';

/** Schema validation error from API */
interface SchemaValidationError {
  field: 'input' | 'groundTruth';
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

/** Displays field-level validation errors */
function ValidationErrors({ field, errors }: { field: string; errors: Array<{ path: string; message: string }> }) {
  if (!errors.length) return null;

  return (
    <div className="mt-2 space-y-1">
      {errors.map((err, idx) => (
        <p key={idx} className="text-xs text-destructive">
          <code className="bg-destructive/10 px-1 rounded">
            {field}
            {err.path !== '/' ? err.path : ''}
          </code>
          : {err.message}
        </p>
      ))}
    </div>
  );
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
      setIsEditing(false); // Exit edit mode on item change
      setShowDeleteConfirm(false); // Reset delete state on item change
      setValidationErrors(null); // Reset validation errors on item change
    }
  }, [item?.id]);

  // Navigation handlers - return function or undefined to enable/disable buttons
  const toNextItem = (): (() => void) | undefined => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex >= 0 && currentIndex < items.length - 1) {
      return () => onItemChange(items[currentIndex + 1].id);
    }
    return undefined;
  };

  const toPreviousItem = (): (() => void) | undefined => {
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex > 0) {
      return () => onItemChange(items[currentIndex - 1].id);
    }
    return undefined;
  };

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

    try {
      await updateItem.mutateAsync({
        datasetId,
        itemId: item.id,
        input: parsedInput,
        groundTruth: parsedGroundTruth,
        metadata: parsedMetadata,
      });

      toast.success('Item updated successfully');
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

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleDelete = () => {
    setShowDeleteConfirm(true);
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
      <Column withLeftSeparator={true}>
        <ItemDetailToolbar
          datasetId={datasetId}
          itemId={item.id}
          onPrevious={toPreviousItem()}
          onNext={toNextItem()}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={onClose}
          isEditing={isEditing}
        />

        <Column.Content>
          {isEditing ? (
            <EditModeContent
              inputValue={inputValue}
              setInputValue={handleInputValueChange}
              groundTruthValue={groundTruthValue}
              setGroundTruthValue={handleGroundTruthValueChange}
              metadataValue={metadataValue}
              setMetadataValue={setMetadataValue}
              validationErrors={validationErrors}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={updateItem.isPending}
            />
          ) : (
            <>
              <DatasetItemHeader item={item} />
              <DatasetItemContent item={item} Link={Link} />
            </>
          )}
        </Column.Content>
      </Column>

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
