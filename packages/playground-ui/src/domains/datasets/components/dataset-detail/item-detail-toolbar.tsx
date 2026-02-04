'use client';

import { Button } from '@/ds/components/Button';
import { Pencil, Trash2, Copy, ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, XIcon, History } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { useState } from 'react';
import { useLinkComponent } from '@/lib/framework';

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
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
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

              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button variant="secondary" hasLeftSibling={true} size="default" aria-label="Actions menu">
                    <ChevronDownIcon />
                  </Button>
                </PopoverTrigger>

                <PopoverContent align="end" className="w-48 p-1 bg-surface4 ">
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start gap-2 text-red-500 hover:text-red-400"
                      onClick={onDelete}
                    >
                      <Trash2 />
                      Delete Item
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start gap-2" disabled>
                      <Copy />
                      Duplicate Item (Coming Soon)
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </>
        )}

        <Button variant="secondary" size="default" onClick={onClose} aria-label="Close detail panel">
          <XIcon />
        </Button>
      </div>
    </div>
  );
}
