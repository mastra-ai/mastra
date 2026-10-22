import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ExternalLink, Lock, Pin, PinOff, RefreshCw, Trash2, Users } from 'lucide-react';
import { Link } from 'react-router';

export function SessionMenuItems({
  menu,
  url,
  pinned,
  onPinChange,
  onDelete,
  onRegenerateTitle,
  regeneratingTitle,
  visibility,
  onVisibilityChange,
  changingVisibility,
}: {
  menu: 'context' | 'dropdown';
  url: string;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  onDelete?: () => void;
  onRegenerateTitle?: () => void;
  regeneratingTitle?: boolean;
  visibility?: 'org' | 'private';
  onVisibilityChange?: (visibility: 'org' | 'private') => void;
  changingVisibility?: boolean;
}) {
  const Menu = menu === 'context' ? ContextMenu : DropdownMenu;

  return (
    <>
      <Menu.Item render={<Link to={url} target="_blank" rel="noopener noreferrer" />}>
        <ExternalLink />
        Open in new tab
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item onClick={() => onPinChange(!pinned)}>
        {pinned ? <PinOff /> : <Pin />}
        {pinned ? 'Unpin' : 'Pin session'}
      </Menu.Item>
      {onRegenerateTitle ? (
        <Menu.Item disabled={regeneratingTitle} onClick={onRegenerateTitle}>
          <RefreshCw className={cn(regeneratingTitle && 'animate-spin')} />
          Regenerate title
        </Menu.Item>
      ) : null}
      {onVisibilityChange && visibility ? (
        <Menu.Item
          disabled={changingVisibility}
          onClick={() => onVisibilityChange(visibility === 'private' ? 'org' : 'private')}
        >
          {visibility === 'private' ? <Users /> : <Lock />}
          {visibility === 'private' ? 'Share with organization' : 'Make private'}
        </Menu.Item>
      ) : null}
      {onDelete ? (
        <Menu.Item variant="destructive" onClick={onDelete}>
          <Trash2 />
          Delete
        </Menu.Item>
      ) : null}
    </>
  );
}
