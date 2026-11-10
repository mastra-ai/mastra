import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Link } from 'react-router';

import { SourceIcon } from '../../factory/components/BoardIcons';
import type { SessionExternalLink } from '../services/sessionRows';
import { IconArrowRotateClockwise } from '@mastra/playground-ui/icons/central/IconArrowRotateClockwise';
import { IconLock } from '@mastra/playground-ui/icons/central/IconLock';
import { IconPin } from '@mastra/playground-ui/icons/central/IconPin';
import { IconSquareArrowTopRight } from '@mastra/playground-ui/icons/central/IconSquareArrowTopRight';
import { IconTrashCan } from '@mastra/playground-ui/icons/central/IconTrashCan';
import { IconUnpin } from '@mastra/playground-ui/icons/central/IconUnpin';
import { IconUserDuo } from '@mastra/playground-ui/icons/central/IconUserDuo';

export function SessionMenuItems({
  menu,
  url,
  externalLinks,
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
  externalLinks: readonly SessionExternalLink[];
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
        <IconSquareArrowTopRight />
        Open in new tab
      </Menu.Item>
      {externalLinks.map(link => (
        <Menu.Item key={link.url} render={<a href={link.url} target="_blank" rel="noopener noreferrer" />}>
          <SourceIcon source={link.source} />
          {link.label}
        </Menu.Item>
      ))}
      <Menu.Separator />
      <Menu.Item onClick={() => onPinChange(!pinned)}>
        {pinned ? <IconUnpin /> : <IconPin />}
        {pinned ? 'Unpin' : 'Pin session'}
      </Menu.Item>
      {onRegenerateTitle ? (
        <Menu.Item disabled={regeneratingTitle} onClick={onRegenerateTitle}>
          <IconArrowRotateClockwise className={cn(regeneratingTitle && 'animate-spin')} />
          Regenerate title
        </Menu.Item>
      ) : null}
      {onVisibilityChange && visibility ? (
        <Menu.Item
          disabled={changingVisibility}
          onClick={() => onVisibilityChange(visibility === 'private' ? 'org' : 'private')}
        >
          {visibility === 'private' ? <IconUserDuo /> : <IconLock />}
          {visibility === 'private' ? 'Share with organization' : 'Make private'}
        </Menu.Item>
      ) : null}
      {onDelete ? (
        <Menu.Item variant="destructive" onClick={onDelete}>
          <IconTrashCan />
          Delete
        </Menu.Item>
      ) : null}
    </>
  );
}
