import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Check, ExternalLink, Lock, Pin, PinOff, RefreshCw, Trash2, Users, X } from 'lucide-react';
import { Link } from 'react-router';

import { SourceIcon } from '../../factory/components/BoardIcons';
import type { SessionExternalLink } from '../services/sessionRows';

export function SessionMenuItems({
  menu,
  url,
  externalLinks,
  pinned,
  onPinChange,
  onDelete,
  onRegenerateTitle,
  regeneratingTitle,
  onAnswerPlan,
  answeringPlan,
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
  onAnswerPlan?: (decision: 'approve' | 'decline') => void;
  answeringPlan?: boolean;
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
      {externalLinks.map(link => (
        <Menu.Item key={link.url} render={<a href={link.url} target="_blank" rel="noopener noreferrer" />}>
          <SourceIcon source={link.source} />
          {link.label}
        </Menu.Item>
      ))}
      <Menu.Separator />
      {onAnswerPlan ? (
        <>
          <Menu.Item disabled={answeringPlan} onClick={() => onAnswerPlan('approve')}>
            <Check />
            Approve plan
          </Menu.Item>
          <Menu.Item disabled={answeringPlan} onClick={() => onAnswerPlan('decline')}>
            <X />
            Decline plan
          </Menu.Item>
          <Menu.Separator />
        </>
      ) : null}
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
