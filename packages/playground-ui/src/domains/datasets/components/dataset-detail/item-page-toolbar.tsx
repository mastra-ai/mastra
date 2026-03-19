'use client';

import { Button } from '@/ds/components/Button';
import { Pencil, Trash2, Copy, ChevronDownIcon, ArrowLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/ds/components/Popover';
import { useState } from 'react';
import { useLinkComponent } from '@/lib/framework';

export interface ItemPageToolbarProps {
  datasetId: string;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isEditing?: boolean;
}

export function ItemPageToolbar({ datasetId, onBack, onEdit, onDelete, isEditing = false }: ItemPageToolbarProps) {
  const { Link } = useLinkComponent();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
      {/* Left side: Back button */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="md" onClick={onBack} aria-label="Back to dataset">
          <ArrowLeft /> Back
        </Button>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        {!isEditing && (
          <div className="flex items-center gap-[2px]">
            <Button variant="outline" size="md" onClick={onEdit}>
              <Pencil />
              Edit
            </Button>

            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="md" aria-label="Actions menu">
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
        )}
      </div>
    </div>
  );
}
