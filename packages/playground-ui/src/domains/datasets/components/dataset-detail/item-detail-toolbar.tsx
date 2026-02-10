'use client';

import { Button } from '@/ds/components/Button';
import { Pencil, Trash2, Copy, ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, XIcon, History } from 'lucide-react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { useLinkComponent } from '@/lib/framework';
import { Column } from '@/ds/components/Columns';

export interface ItemDetailToolbarProps {
  datasetId: string;
  itemId: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  isEditing?: boolean;
}

export function ItemDetailToolbar({
  datasetId,
  itemId,
  onPrevious,
  onNext,
  onEdit,
  onDelete,
  onClose,
  isEditing = false,
}: ItemDetailToolbarProps) {
  const { Link } = useLinkComponent();
  return (
    <Column.Toolbar>
      {/* Left side: Navigation */}
      <div className="flex items-center gap-[2px]">
        <Button
          variant="secondary"
          size="default"
          onClick={onPrevious}
          disabled={!onPrevious}
          aria-label="Previous item"
          hasRightSibling={true}
        >
          <ArrowUpIcon /> Previous
        </Button>
        <Button
          variant="secondary"
          hasLeftSibling={true}
          size="default"
          onClick={onNext}
          disabled={!onNext}
          aria-label="Next item"
        >
          Next <ArrowDownIcon />
        </Button>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        {!isEditing && (
          <>
            <Button variant="secondary" size="default" href={`/datasets/${datasetId}/items/${itemId}`} as={Link}>
              <History />
              History
            </Button>

            <div className="flex items-center gap-[2px]">
              <Button variant="secondary" hasRightSibling={true} size="default" onClick={onEdit}>
                <Pencil />
                Edit
              </Button>

              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="secondary" hasLeftSibling={true} size="default" aria-label="Actions menu">
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content align="end" className="w-48">
                  <DropdownMenu.Item onSelect={onDelete} className="text-red-500 focus:text-red-400">
                    <Trash2 />
                    <span>Delete Item</span>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item disabled>
                    <Copy />
                    <span>Duplicate Item (Coming Soon)</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            </div>
          </>
        )}

        <Button variant="secondary" size="default" onClick={onClose} aria-label="Close detail panel">
          <XIcon />
        </Button>
      </div>
    </Column.Toolbar>
  );
}
