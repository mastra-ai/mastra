'use client';

import { Button, ButtonsGroup, Column, DropdownMenu, PrevNextNav } from '@mastra/playground-ui';
import { Pencil, Trash2, XIcon, History, EllipsisVerticalIcon } from 'lucide-react';
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
            <Button href={`/datasets/${datasetId}/items/${itemId}`} as={Link}>
              <History />
              Versions
            </Button>

            <DropdownMenu>
              <DropdownMenu.Trigger asChild>
                <Button aria-label="Actions menu">
                  <EllipsisVerticalIcon />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end" className="w-48">
                <DropdownMenu.Item onSelect={onEdit}>
                  <Pencil />
                  Edit
                </DropdownMenu.Item>
                <DropdownMenu.Item onSelect={onDelete} className="text-red-500 focus:text-red-400">
                  <Trash2 />
                  Delete Item
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu>
          </>
        )}

        <Button onClick={onClose} aria-label="Close detail panel">
          <XIcon />
        </Button>
      </ButtonsGroup>
    </Column.Toolbar>
  );
}
