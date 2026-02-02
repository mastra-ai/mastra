'use client';

import { useState, useEffect } from 'react';
import type { DatasetItem } from '@mastra/client-js';
import { TextAndIcon } from '@/ds/components/Text';
import { KeyValueList } from '@/ds/components/KeyValueList';
import { Sections } from '@/ds/components/Sections';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Label } from '@/ds/components/Label';
import { SideDialog } from '@/ds/components/SideDialog';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/lib/toast';
import { HashIcon, FileInputIcon, FileOutputIcon, TagIcon, Pencil } from 'lucide-react';
import { format } from 'date-fns/format';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { ItemDetailToolbar } from './item-detail-toolbar';

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
      <div className="grid grid-rows-[auto_1fr] h-full gap-4">
        <ItemDetailToolbar
          onPrevious={toPreviousItem()}
          onNext={toNextItem()}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={onClose}
          isEditing={isEditing}
        />

        <div className="flex-1 overflow-y-auto p-4 border-2 border-border1 rounded-lg">
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
            <ReadOnlyContent item={item} Link={Link} />
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

/**
 * Read-only view of the dataset item details
 */
function ReadOnlyContent({ item, Link }: { item: DatasetItem; Link: ReturnType<typeof useLinkComponent>['Link'] }) {
  const metadataDisplay = item.metadata ? JSON.stringify(item.metadata, null, 2) : null;

  return (
    <>
      <div className="mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <FileInputIcon className="w-5 h-5" /> Dataset Item
        </h3>
        <TextAndIcon>
          <HashIcon className="w-4 h-4" /> {item.id}
        </TextAndIcon>
      </div>

      <Sections>
        <KeyValueList
          data={[
            {
              label: 'Created',
              value: format(new Date(item.createdAt), 'MMM d, yyyy h:mm aaa'),
              key: 'createdAt',
            },
            ...(item.version
              ? [
                  {
                    label: 'Version',
                    value: format(new Date(item.version), 'MMM d, yyyy h:mm aaa'),
                    key: 'version',
                  },
                ]
              : []),
          ]}
          LinkComponent={Link}
        />

        <SideDialog.CodeSection title="Input" icon={<FileInputIcon />} codeStr={JSON.stringify(item.input, null, 2)} />

        {item.expectedOutput !== null && item.expectedOutput !== undefined && (
          <SideDialog.CodeSection
            title="Expected Output"
            icon={<FileOutputIcon />}
            codeStr={JSON.stringify(item.expectedOutput, null, 2)}
          />
        )}

        {metadataDisplay && <SideDialog.CodeSection title="Metadata" icon={<TagIcon />} codeStr={metadataDisplay} />}
      </Sections>
    </>
  );
}

/**
 * Editable form view for updating dataset item
 */
interface EditModeContentProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  expectedOutputValue: string;
  setExpectedOutputValue: (value: string) => void;
  metadataValue: string;
  setMetadataValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function EditModeContent({
  inputValue,
  setInputValue,
  expectedOutputValue,
  setExpectedOutputValue,
  metadataValue,
  setMetadataValue,
  onSave,
  onCancel,
  isSaving,
}: EditModeContentProps) {
  return (
    <>
      <div className="mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <Pencil className="w-5 h-5" /> Edit Item
        </h3>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Input (JSON) *</Label>
          <CodeEditor value={inputValue} onChange={setInputValue} showCopyButton={false} className="min-h-[120px]" />
        </div>

        <div className="space-y-2">
          <Label>Expected Output (JSON, optional)</Label>
          <CodeEditor
            value={expectedOutputValue}
            onChange={setExpectedOutputValue}
            showCopyButton={false}
            className="min-h-[100px]"
          />
        </div>

        <div className="space-y-2">
          <Label>Metadata (JSON, optional)</Label>
          <CodeEditor
            value={metadataValue}
            onChange={setMetadataValue}
            showCopyButton={false}
            className="min-h-[80px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="secondary" size="default" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="standard" size="default" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
