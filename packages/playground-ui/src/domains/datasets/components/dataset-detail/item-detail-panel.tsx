'use client';

import { useState, useEffect } from 'react';
import type { DatasetItem } from '@mastra/client-js';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/lib/toast';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { ItemDetailToolbar } from './item-detail-toolbar';
import { DatasetItemHeader } from './dataset-item-header';
import { DatasetItemContent } from './dataset-item-content';
import { EditModeContent } from './dataset-item-form';

export interface ItemDetailPanelProps {
  datasetId: string;
  item: DatasetItem;
  items: DatasetItem[];
  onItemChange: (itemId: string) => void;
  onClose: () => void;
}

/**
 * Inline panel showing full details of a single dataset item.
 * Includes navigation to next/previous items and sections for Input, Expected Output, and Metadata.
 */
export function ItemDetailPanel({ datasetId, item, items, onItemChange, onClose }: ItemDetailPanelProps) {
  const { Link } = useLinkComponent();
  const { updateItem, deleteItem } = useDatasetMutations();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [expectedOutputValue, setExpectedOutputValue] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Reset form state when item changes (navigation or prop update)
  useEffect(() => {
    if (item) {
      setInputValue(JSON.stringify(item.input, null, 2));
      setExpectedOutputValue(item.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : '');
      setMetadataValue(item.metadata ? JSON.stringify(item.metadata, null, 2) : '');
      setIsEditing(false); // Exit edit mode on item change
      setShowDeleteConfirm(false); // Reset delete state on item change
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
        itemId: item.id,
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
    // Reset to original values
    setInputValue(JSON.stringify(item.input, null, 2));
    setExpectedOutputValue(item.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : '');
    setMetadataValue(item.metadata ? JSON.stringify(item.metadata, null, 2) : '');
    setIsEditing(false);
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
      <div className="grid grid-rows-[auto_1fr] h-full gap-8">
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

        <div className="flex-1 overflow-y-auto rounded-lg">
          {isEditing ? (
            <EditModeContent
              inputValue={inputValue}
              setInputValue={setInputValue}
              expectedOutputValue={expectedOutputValue}
              setExpectedOutputValue={setExpectedOutputValue}
              metadataValue={metadataValue}
              setMetadataValue={setMetadataValue}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={updateItem.isPending}
            />
          ) : (
            <>
              <DatasetItemHeader item={item} Link={Link} />
              <DatasetItemContent item={item} Link={Link} />
            </>
          )}
        </div>
      </div>
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
