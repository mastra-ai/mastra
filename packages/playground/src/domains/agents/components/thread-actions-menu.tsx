import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { EllipsisVertical, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';

export interface ThreadActionsMenuProps {
  onPin?: () => void;
  onUnpin?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onReplay?: () => void;
}

export const ThreadActionsMenu = ({ onPin, onUnpin, onRename, onDelete, onReplay }: ThreadActionsMenuProps) => {
  if (!onPin && !onUnpin && !onRename && !onDelete && !onReplay) return null;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="icon-sm" aria-label="Thread actions">
        <EllipsisVertical />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" finalFocus={false}>
        {onReplay && <DropdownMenu.Item onClick={onReplay}>Create replay dataset</DropdownMenu.Item>}
        {onPin && (
          <DropdownMenu.Item onClick={onPin}>
            <Pin />
            Pin
          </DropdownMenu.Item>
        )}
        {onUnpin && (
          <DropdownMenu.Item onClick={onUnpin}>
            <PinOff />
            Unpin
          </DropdownMenu.Item>
        )}
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
