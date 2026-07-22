'use client';

import type { DatasetItem } from '@mastra/client-js';
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
  Pencil,
  RouteIcon,
  TagIcon,
  Trash2,
  WrenchIcon,
} from 'lucide-react';
import { useState } from 'react';
import { useDatasetMutations } from '../../hooks/use-dataset-mutations';
import { DatasetItemEditForm } from '../dataset-detail/dataset-item-form';
import { useLinkComponent } from '@/lib/framework';

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
  const { deleteItem } = useDatasetMutations();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentIndex = items.findIndex(i => i.id === item.id);
  const onPrevious = currentIndex > 0 ? () => onItemChange(items[currentIndex - 1].id) : undefined;
  const onNext =
    currentIndex >= 0 && currentIndex < items.length - 1 ? () => onItemChange(items[currentIndex + 1].id) : undefined;

  const closeEditor = () => setIsEditing(false);

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
            <DatasetItemEditForm item={item} onSuccess={closeEditor} onCancel={closeEditor} />
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
                {item.timeout !== undefined && (
                  <>
                    <DataKeysAndValues.Key>Item timeout</DataKeysAndValues.Key>
                    <DataKeysAndValues.Value>{item.timeout.toLocaleString()} ms</DataKeysAndValues.Value>
                  </>
                )}
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
