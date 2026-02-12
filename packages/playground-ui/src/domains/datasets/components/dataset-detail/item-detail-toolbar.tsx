'use client';

import { Button } from '@/ds/components/Button';
import { Pencil, Trash2, Copy, ChevronDownIcon, XIcon, History } from 'lucide-react';
import { DropdownMenu } from '@/ds/components/DropdownMenu';
import { useLinkComponent } from '@/lib/framework';
import { Column } from '@/ds/components/Columns';
import { PrevNextNav } from '@/ds/components/PrevNextNav';
import { ButtonsGroup } from '@/ds/components/ButtonsGroup';

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
      <PrevNextNav
        onPrevious={onPrevious}
        onNext={onNext}
        previousAriaLabel="Previous item"
        nextAriaLabel="Next item"
      />
      <ButtonsGroup>
        {!isEditing && (
          <>
            <Button variant="standard" size="default" href={`/datasets/${datasetId}/items/${itemId}`} as={Link}>
              <History />
              History
            </Button>

            <ButtonsGroup spacing="close">
              <Button variant="standard" size="default" onClick={onEdit}>
                <Pencil />
                Edit
              </Button>

              <DropdownMenu>
                <DropdownMenu.Trigger asChild>
                  <Button variant="standard" size="default" aria-label="Actions menu">
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
            </ButtonsGroup>
          </>
        )}

        <Button variant="standard" size="default" onClick={onClose} aria-label="Close detail panel">
          <XIcon />
        </Button>
      </ButtonsGroup>
    </Column.Toolbar>
  );
}
