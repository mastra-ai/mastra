import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react';

export interface ThreadActionsMenuProps {
  onRename?: () => void;
  onDelete?: () => void;
}

export const ThreadActionsMenu = ({ onRename, onDelete }: ThreadActionsMenuProps) => {
  if (!onRename && !onDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="icon-sm" aria-label="Thread actions">
        <EllipsisVertical />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" finalFocus={false}>
        {onRename && (
          <DropdownMenu.Item onClick={onRename}>
            <Pencil />
            Rename
          </DropdownMenu.Item>
        )}
        {onDelete && (
          <DropdownMenu.Item variant="destructive" onClick={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
