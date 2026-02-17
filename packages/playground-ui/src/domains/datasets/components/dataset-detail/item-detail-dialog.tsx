import { useState, useEffect } from 'react';
import { DatasetItem } from '@mastra/client-js';
import { SideDialog, type SideDialogRootProps } from '@/ds/components/SideDialog';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { KeyValueList } from '@/ds/components/KeyValueList';
import { Sections } from '@/ds/components/Sections';
import { Button } from '@/ds/components/Button';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { Label } from '@/ds/components/Label';
import { Icon } from '@/ds/icons/Icon';
import { AlertDialog } from '@/ds/components/AlertDialog';
import { useLinkComponent } from '@/lib/framework';
import { toast } from '@/lib/toast';
import { HashIcon, FileInputIcon, FileOutputIcon, TagIcon, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns/format';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';

export interface ItemDetailDialogProps {
  datasetId: string;
  item: DatasetItem | null;
  items: DatasetItem[];
  isOpen: boolean;
  onClose: () => void;
  onItemChange: (itemId: string) => void;
  dialogLevel?: SideDialogRootProps['level'];
}

/**
 * Side dialog showing full details of a single dataset item.
 * Includes navigation to next/previous items and sections for Input, Ground Truth, and Metadata.
 */
export function ItemDetailDialog({
  datasetId,
  item,
  items,
  isOpen,
  onClose,
  onItemChange,
  dialogLevel = 1,
}: ItemDetailDialogProps) {
  const { Link } = useLinkComponent();
  const { updateItem, deleteItem } = useDatasetMutations();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [groundTruthValue, setGroundTruthValue] = useState('');
  const [metadataValue, setMetadataValue] = useState('');

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
    }
  }, [item?.id]);

  if (!item) return null;

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
    } catch (error) {
      toast.error(`Failed to update item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleCancel = () => {
    // Reset to original values
    setInputValue(JSON.stringify(item.input, null, 2));
    setGroundTruthValue(item.groundTruth ? JSON.stringify(item.groundTruth, null, 2) : '');
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
      onClose(); // Close the SideDialog after successful deletion
    } catch (error) {
      toast.error(`Failed to delete item: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <SideDialog
      dialogTitle="Dataset Item"
      dialogDescription={`Item: ${item.id}`}
      isOpen={isOpen}
      onClose={onClose}
      level={dialogLevel}
    >
      <SideDialog.Top>
        <TextAndIcon>
          <HashIcon /> {getShortId(item.id)}
        </TextAndIcon>
        |
        <SideDialog.Nav onNext={toNextItem()} onPrevious={toPreviousItem()} />
        {!isEditing && (
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Icon>
                <Pencil />
              </Icon>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDelete}>
              <Icon>
                <Trash2 />
              </Icon>
              Delete
            </Button>
          </div>
        )}
      </SideDialog.Top>

      <SideDialog.Content>
        {isEditing ? (
          <EditModeContent
            inputValue={inputValue}
            setInputValue={setInputValue}
            groundTruthValue={groundTruthValue}
            setGroundTruthValue={setGroundTruthValue}
            metadataValue={metadataValue}
            setMetadataValue={setMetadataValue}
            onSave={handleSave}
            onCancel={handleCancel}
            isSaving={updateItem.isPending}
          />
        ) : (
          <ReadOnlyContent item={item} Link={Link} />
        )}
      </SideDialog.Content>

      {/* Delete confirmation - uses portal, renders above SideDialog */}
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
    </SideDialog>
  );
}

/**
 * Read-only view of the dataset item details
 */
function ReadOnlyContent({ item, Link }: { item: DatasetItem; Link: ReturnType<typeof useLinkComponent>['Link'] }) {
  const metadataDisplay = item.metadata ? JSON.stringify(item.metadata, null, 2) : null;

  return (
    <>
      <SideDialog.Header>
        <SideDialog.Heading>
          <FileInputIcon /> Dataset Item
        </SideDialog.Heading>
        <TextAndIcon>
          <HashIcon /> {item.id}
        </TextAndIcon>
      </SideDialog.Header>

      <Sections>
        <KeyValueList
          data={[
            {
              label: 'Created',
              value: format(new Date(item.createdAt), 'MMM d, yyyy h:mm aaa'),
              key: 'createdAt',
            },
            ...(item.datasetVersion != null
              ? [
                  {
                    label: 'Version',
                    value: `v${item.datasetVersion}`,
                    key: 'version',
                  },
                ]
              : []),
          ]}
          LinkComponent={Link}
        />

        <SideDialog.CodeSection title="Input" icon={<FileInputIcon />} codeStr={JSON.stringify(item.input, null, 2)} />

        {item.groundTruth !== null && item.groundTruth !== undefined && (
          <SideDialog.CodeSection
            title="Ground Truth"
            icon={<FileOutputIcon />}
            codeStr={JSON.stringify(item.groundTruth, null, 2)}
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
  groundTruthValue: string;
  setGroundTruthValue: (value: string) => void;
  metadataValue: string;
  setMetadataValue: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

function EditModeContent({
  inputValue,
  setInputValue,
  groundTruthValue,
  setGroundTruthValue,
  metadataValue,
  setMetadataValue,
  onSave,
  onCancel,
  isSaving,
}: EditModeContentProps) {
  return (
    <>
      <SideDialog.Header>
        <SideDialog.Heading>
          <Pencil /> Edit Item
        </SideDialog.Heading>
      </SideDialog.Header>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label>Input (JSON) *</Label>
          <CodeEditor value={inputValue} onChange={setInputValue} showCopyButton={false} className="min-h-[120px]" />
        </div>

        <div className="space-y-2">
          <Label>Ground Truth (JSON, optional)</Label>
          <CodeEditor
            value={groundTruthValue}
            onChange={setGroundTruthValue}
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
          <Button variant="standard" size="default" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="cta" size="default" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </>
  );
}
