import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { IconDotGrid1x3Vertical } from '@mastra/playground-ui/icons/central/IconDotGrid1x3Vertical';
import { IconPencil } from '@mastra/playground-ui/icons/central/IconPencil';
import { IconPin } from '@mastra/playground-ui/icons/central/IconPin';
import { IconTrashCan } from '@mastra/playground-ui/icons/central/IconTrashCan';
import { IconUnpin } from '@mastra/playground-ui/icons/central/IconUnpin';

export interface ThreadActionsMenuProps {
  onPin?: () => void;
  onUnpin?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}

export const ThreadActionsMenu = ({ onPin, onUnpin, onRename, onDelete }: ThreadActionsMenuProps) => {
  if (!onPin && !onUnpin && !onRename && !onDelete) return null;

  return (
    <DropdownMenu>
      <DropdownMenu.Trigger variant="ghost" size="icon-sm" aria-label="Thread actions">
        <IconDotGrid1x3Vertical />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" finalFocus={false}>
        {onPin && (
          <DropdownMenu.Item onClick={onPin}>
            <IconPin />
            Pin
          </DropdownMenu.Item>
        )}
        {onUnpin && (
          <DropdownMenu.Item onClick={onUnpin}>
            <IconUnpin />
            Unpin
          </DropdownMenu.Item>
        )}
        {onRename && (
          <DropdownMenu.Item onClick={onRename}>
            <IconPencil />
            Rename
          </DropdownMenu.Item>
        )}
        {onDelete && (
          <DropdownMenu.Item variant="destructive" onClick={onDelete}>
            <IconTrashCan />
            Delete
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
};
