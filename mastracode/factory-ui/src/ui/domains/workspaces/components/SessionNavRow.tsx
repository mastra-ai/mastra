import { Button } from '@mastra/playground-ui/components/Button';
import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { HoverCard, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Sidebar, useMaybeSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Pin, User } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import type { Location } from 'react-router';

import { SourceIcon } from '../../factory/components/BoardIcons';
import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { SessionSource } from '../services/sessionPresentation';
import type { SessionExternalLink } from '../services/sessionRows';
import type { SessionRowStatus } from '../services/sessionStatus';
import { ActivityBelt } from '@mastra/playground-ui/components/Activity';
import { SessionActionsMenu } from './SessionActionsMenu';
import { SessionMenuItems } from './SessionMenuItems';
import { SessionPreviewCard } from './SessionPreviewCard';
import type { SessionPreviewDetails } from './SessionPreviewCard';
import { SessionSharingPopover } from './SessionSharingPopover';

/**
 * Shared sidebar row for workspace/user sessions. Built on `Sidebar.NavLink`
 * so every session list (work, review, user) renders with identical density,
 * hover, and active states. Lifecycle lives on the left as an activity belt;
 * the trailing slot beside the label is left to the spinner, the merge badge
 * and the actions menu, which swap in place and collapse the slot when there is
 * nothing to show so the label gets the full row. Because that slot comes and
 * goes, the belt, the menu and the preview card anchor to the row box instead —
 * a resized or hidden anchor would drag them across the screen.
 */
export function SessionNavRow({
  name,
  title,
  url,
  externalLinks,
  source,
  active,
  disabled,
  loading,
  status,
  merged,
  changeRequestProvider = 'github',
  preview: previewDetails,
  pinned = false,
  from,
  onPinChange,
  onDelete,
  onRegenerateTitle,
  regeneratingTitle,
  visibility,
  onVisibilityChange,
  changingVisibility,
  level,
  sideSessions,
}: {
  name: string;
  /** Hover tooltip, typically the branch name. */
  title?: string;
  url: string;
  externalLinks: readonly SessionExternalLink[];
  /** Leading icon: a user session, or the source of the session's work item. */
  source?: SessionSource;
  active: boolean;
  disabled: boolean;
  /** True while this row's async open is in flight — shows a spinner and blocks clicks. */
  loading?: boolean;
  /** Merged change request for this session's branch — shown only when the row is otherwise idle. */
  merged?: boolean;
  /** Names the merged badge: GitHub pull requests or GitLab merge requests. */
  changeRequestProvider?: 'github' | 'gitlab';
  status?: SessionRowStatus;
  preview?: SessionPreviewDetails;
  pinned?: boolean;
  /** Retain the board location when opening a factory workspace in this tab. */
  from?: Location;
  onPinChange: (pinned: boolean) => void;
  /** Omit on sessions the viewer does not own: the server only lets owners delete. */
  onDelete?: () => void;
  /** Omitted for sessions the viewer does not own: the server only lets owners rename. */
  onRegenerateTitle?: () => void;
  regeneratingTitle?: boolean;
  /** Private rows show a sharing popover; shared rows have no visibility badge. */
  visibility?: 'org' | 'private';
  /** Omitted for sessions the viewer does not own: the server only lets owners change visibility. */
  onVisibilityChange?: (visibility: 'org' | 'private') => void;
  /** Disables the visibility item while a change is in flight, so overlapping requests cannot land out of order. */
  changingVisibility?: boolean;
  /** Nesting depth, indenting side sessions under the session that started them. */
  level?: number;
  /** Side sessions this session started: shows a chevron that expands or collapses them. */
  sideSessions?: { count: number; expanded: boolean; onExpandedChange: (expanded: boolean) => void };
}) {
  const anchor = useRef<HTMLLIElement>(null);
  // Selecting a session navigates away, so the mobile nav drawer must close.
  const sidebar = useMaybeSidebar();
  // Touch has no hover: the card would only open behind the tap that already navigated away.
  const preview = sidebar?.isMobile ? undefined : previewDetails;
  const link = (
    <Link
      to={url}
      state={from ? { from } : undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={name}
      aria-disabled={disabled || loading || undefined}
      tabIndex={disabled || loading ? -1 : undefined}
      onClick={event => {
        if (disabled || loading) {
          event.preventDefault();
          return;
        }
        if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) {
          sidebar?.setOpenMobile(false);
        }
      }}
      onAuxClick={event => {
        if (disabled || loading) event.preventDefault();
      }}
      title={preview ? undefined : title}
    >
      {source ? <SessionSourceIcon source={source} /> : null}
      <Sidebar.NavLabel>{name}</Sidebar.NavLabel>
      {pinned && !loading ? (
        <Pin aria-label={`${name} pinned`} className="text-muted-foreground/70 size-2 shrink-0 rotate-45" />
      ) : null}
    </Link>
  );
  const menuProps = {
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
  };
  const belt = loading ? undefined : status;
  const trailing = trailingKind({ loading, status, merged });
  const mergedLabel = changeRequestProvider === 'gitlab' ? 'Merge request merged' : 'Pull request merged';
  const action = (
    <>
      {belt ? <ActivityBelt status={belt} label={beltLabel(belt, name)} /> : null}
      {sideSessions ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={sideSessions.expanded}
          aria-label={`${sideSessions.count} side ${sideSessions.count === 1 ? 'session' : 'sessions'} of ${name}`}
          onClick={() => sideSessions.onExpandedChange(!sideSessions.expanded)}
        >
          <DisclosureChevron direction="right" className="size-3.5" />
        </Button>
      ) : null}
      {visibility === 'private' ? (
        <SessionSharingPopover
          name={name}
          disabled={disabled || loading}
          onShare={onVisibilityChange ? () => onVisibilityChange('org') : undefined}
          sharing={changingVisibility}
        />
      ) : null}
      <span className={cn(trailingSlot, trailing ? 'grid' : revealedSlot)}>
        {trailing === 'loading' ? (
          <Spinner size="sm" aria-label={`Opening ${name}`} className="text-muted-foreground" />
        ) : null}
        {trailing === 'merged' ? (
          <span
            role="img"
            aria-label={`${mergedLabel} for ${name}`}
            title={mergedLabel}
            className={cn('flex', yieldsToActions)}
          >
            <PullRequestStatusIcon status="merged" className="size-3!" decorative />
          </span>
        ) : null}
        {trailing === 'loading' ? null : (
          <SessionActionsMenu name={name} anchor={anchor} disabled={disabled}>
            <SessionMenuItems menu="dropdown" {...menuProps} />
          </SessionActionsMenu>
        )}
      </span>
    </>
  );
  const row = (
    <ContextMenu
      onOpenChange={(open, details) => {
        if (open && (disabled || loading)) details.cancel();
      }}
    >
      <ContextMenu.Trigger
        render={
          <Sidebar.NavLink
            ref={anchor}
            link={{ name, url }}
            isActive={active}
            level={level}
            className="group/session"
            // 0ms both ways — each row owns its card, so a close delay leaves the previous one up while the next opens
            render={preview ? <HoverCardTrigger delay={0} closeDelay={0} render={link} /> : link}
            action={action}
          />
        }
      />
      {!disabled && !loading ? (
        <ContextMenu.Content>
          <SessionMenuItems menu="context" {...menuProps} />
        </ContextMenu.Content>
      ) : null}
    </ContextMenu>
  );

  if (!preview) return row;

  return (
    <HoverCard>
      {row}
      <SessionPreviewCard name={name} anchor={anchor} status={status} merged={merged} details={preview} />
    </HoverCard>
  );
}

function SessionSourceIcon({ source }: { source: SessionSource }) {
  if (source === 'user') {
    return <User data-source="user" aria-hidden className="text-muted-foreground size-3.5 shrink-0" />;
  }
  return <SourceIcon source={source} className="size-3.5" />;
}

const trailingSlot = 'size-control-sm shrink-0 grid-rows-1 place-items-center *:col-start-1 *:row-start-1';

// An empty slot claims no width, so the label runs the full row until there is something to show.
const revealedSlot =
  'grid pointer-fine:hidden group-focus-within/session:grid group-hover/session:grid group-has-[[data-popup-open]]/session:grid';

function beltLabel(status: SessionRowStatus, name: string) {
  if (status === 'initializing') return `Initializing ${name}`;
  if (status === 'working') return `Agent working in ${name}`;
  return `${name} waiting on you`;
}

/** A merge badge is worth the slot only on a session with no lifecycle left to report. */
function trailingKind({ loading, status, merged }: { loading?: boolean; status?: SessionRowStatus; merged?: boolean }) {
  if (loading) return 'loading';
  return merged && !status ? 'merged' : undefined;
}

// The actions menu owns the slot as soon as the row is hovered, focused, or its menu is open.
const yieldsToActions =
  'pointer-coarse:hidden group-hover/session:hidden group-focus-within/session:hidden group-has-[[data-popup-open]]/session:hidden';
