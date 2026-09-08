'use client';

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { SearchFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { useState } from 'react';
import { useDebounce } from 'use-debounce';
import { useDatasetItems } from '../../hooks/use-dataset-items';
import { DatasetItemsList } from './dataset-items-list';
import { useLinkComponent } from '@/lib/framework';

const NOOP = () => {};
const EMPTY_SELECTION = new Set<string>();

const columns = [
  { name: 'id', label: 'ID', size: '7rem' },
  { name: 'input', label: 'Input', size: 'minmax(10rem,1fr)' },
  { name: 'groundTruth', label: 'Ground Truth', size: 'minmax(10rem,1fr)' },
  { name: 'trajectory', label: 'Trajectory', size: '8rem' },
  { name: 'createdAt', label: 'Created', size: '10rem' },
];

export interface CompareWithDialogProps {
  datasetId: string;
  currentItemId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wide dialog listing the dataset's items (searchable, infinite scroll).
 * Clicking an item opens the compare page with the current item on the left.
 */
export function CompareWithDialog({ datasetId, currentItemId, open, onOpenChange }: CompareWithDialogProps) {
  const { navigate, paths } = useLinkComponent();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);

  const {
    data: items,
    isLoading,
    setEndOfListElement,
    isFetchingNextPage,
    hasNextPage,
  } = useDatasetItems(datasetId, debouncedSearch || undefined);
  const otherItems = items.filter(i => i.id !== currentItemId);

  const handleItemClick = (itemId: string) => {
    onOpenChange(false);
    navigate(paths.datasetItemCompareLink(datasetId, currentItemId, itemId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(72rem,calc(100%-4rem))]">
        <DialogHeader>
          <DialogTitle>Compare with…</DialogTitle>
          <DialogDescription>Pick an item to compare with the current one.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid max-h-[70vh] min-h-[24rem] grid-rows-[auto_1fr] gap-3">
          <SearchFieldBlock
            name="compare-with-dialog-search"
            label="Search items to compare"
            labelIsHidden={true}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search items..."
          />
          <div className="min-h-0 overflow-y-auto">
            <DatasetItemsList
              items={otherItems}
              isLoading={isLoading}
              onItemClick={handleItemClick}
              selectOnNavigate={false}
              columns={columns}
              // Always truthy so an empty result shows the "no match" row instead
              // of the add/import empty state, which makes no sense in this dialog.
              searchQuery={debouncedSearch || ' '}
              setEndOfListElement={setEndOfListElement}
              isFetchingNextPage={isFetchingNextPage}
              hasNextPage={hasNextPage}
              isSelectionActive={false}
              selectedIds={EMPTY_SELECTION}
              onToggleSelection={NOOP}
              onSelectAll={NOOP}
              onClearSelection={NOOP}
              onAddClick={NOOP}
            />
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
