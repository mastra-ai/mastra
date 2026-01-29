import { DatasetItem } from '@mastra/client-js';
import { SideDialog, type SideDialogRootProps } from '@/ds/components/SideDialog';
import { TextAndIcon, getShortId } from '@/ds/components/Text';
import { KeyValueList } from '@/ds/components/KeyValueList';
import { Sections } from '@/ds/components/Sections';
import { useLinkComponent } from '@/lib/framework';
import { HashIcon, FileInputIcon, FileOutputIcon, TagIcon } from 'lucide-react';
import { format } from 'date-fns/format';

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
 * Includes navigation to next/previous items and sections for Input, Expected Output, and Metadata.
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

  // Format metadata for display
  const metadataDisplay = item.metadata ? JSON.stringify(item.metadata, null, 2) : null;

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
        {/* Edit and Delete buttons - placeholders for Plans 09-03 and 09-04 */}
        <div className="ml-auto flex items-center gap-2">{/* Edit button will be added in Plan 09-03 */}</div>
      </SideDialog.Top>

      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <FileInputIcon /> Dataset Item
          </SideDialog.Heading>
          <TextAndIcon>
            <HashIcon /> {item.id}
          </TextAndIcon>
        </SideDialog.Header>

        <Sections>
          {/* Metadata section */}
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

          {/* Input section */}
          <SideDialog.CodeSection title="Input" icon={<FileInputIcon />} codeStr={JSON.stringify(item.input, null, 2)} />

          {/* Expected Output section */}
          {item.expectedOutput !== null && item.expectedOutput !== undefined && (
            <SideDialog.CodeSection
              title="Expected Output"
              icon={<FileOutputIcon />}
              codeStr={JSON.stringify(item.expectedOutput, null, 2)}
            />
          )}

          {/* Metadata section */}
          {metadataDisplay && <SideDialog.CodeSection title="Metadata" icon={<TagIcon />} codeStr={metadataDisplay} />}
        </Sections>
      </SideDialog.Content>
    </SideDialog>
  );
}
