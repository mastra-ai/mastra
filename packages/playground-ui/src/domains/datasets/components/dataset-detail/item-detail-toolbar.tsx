'use client';

import { SplitButton } from '@/ds/components/SplitButton';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { ChevronLeft, ChevronRight, Pencil, Trash2, Copy, X } from 'lucide-react';

export interface ItemDetailToolbarProps {
  onPrevious?: () => void;
  onNext?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  isEditing?: boolean;
}

export function ItemDetailToolbar({
  onPrevious,
  onNext,
  onEdit,
  onDelete,
  onClose,
  isEditing = false,
}: ItemDetailToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border1">
      {/* Left side: Navigation */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!onPrevious} aria-label="Previous item">
          <Icon>
            <ChevronLeft />
          </Icon>
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!onNext} aria-label="Next item">
          <Icon>
            <ChevronRight />
          </Icon>
        </Button>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-2">
        {!isEditing && (
          <SplitButton
            mainLabel={
              <>
                <Icon>
                  <Pencil />
                </Icon>
                Edit
              </>
            }
            onMainClick={onEdit}
            variant="outline"
            size="sm"
          >
            <div className="flex flex-col">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-red-500 hover:text-red-400"
                onClick={onDelete}
              >
                <Icon>
                  <Trash2 />
                </Icon>
                Delete Item
              </Button>
              <Button variant="ghost" size="sm" className="w-full justify-start gap-2" disabled>
                <Icon>
                  <Copy />
                </Icon>
                Duplicate Item (Coming Soon)
              </Button>
            </div>
          </SplitButton>
        )}
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close detail panel">
          <Icon>
            <X />
          </Icon>
        </Button>
      </div>
    </div>
  );
}
