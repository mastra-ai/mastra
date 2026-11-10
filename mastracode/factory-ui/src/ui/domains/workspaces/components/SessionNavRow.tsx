import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { HoverCard, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Sidebar, useMaybeSidebar } from '@mastra/playground-ui/components/Sidebar';
import { PullRequestIcon } from '@mastra/playground-ui/components/PullRequestIcon';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Pin, User } from 'lucide-react';
import { useRef } from 'react';
import { Link } from 'react-router';
import type { Location } from 'react-router';

import { SourceIcon } from '../../factory/components/BoardIcons';
import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { SessionSource } from '../services/sessionPresentation';
import type { SessionExternalLink, SessionPullRequest } from '../services/sessionRows';
import type { SessionRowStatus } from '../services/sessionStatus';
import { ActivityBelt } from '@mastra/playground-ui/components/Activity';
import { SessionActionsMenu } from './SessionActionsMenu';
import { SessionMenuItems } from './SessionMenuItems';
import { SessionPreviewCard } from './SessionPreviewCard';
import type { SessionPreviewDetails } from './SessionPreviewCard';
import { SessionSharingPopover } from './SessionSharingPopover';
import { relativeTime } from '../../../../lib/date/relativeTime';
import { PULL_REQUEST_STATUS_LABELS } from '../../factory/boardItems';
import type { PullRequestStatus } from '../../factory/boardItems';
import { isPullRequestSource } from '../../factory/services/workItems';

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
  label,
  level,
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
  pullRequest,
  updatedAt,
}: {
  name: string;
  /** Shown instead of the name, which stays in the accessible name: a child session's phase. */
  label?: string;
  /** Indent level: 1 for a card's child sessions. */
  level?: number;
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
  /** The change request the session's card is, or links to. */
  pullRequest?: SessionPullRequest;
  /** Shows a second line under the name: when the session last moved, and its change request. Omit for a single-line row. */
  updatedAt?: string;
}) {
  const anchor = useRef<HTMLLIElement>(null);
  // Selecting a session navigates away, so the mobile nav drawer must close.
  const sidebar = useMaybeSidebar();
  // Touch has no hover: the card would only open behind the tap that already navigated away.
  const preview = sidebar?.isMobile ? undefined : previewDetails;
  // The live merge check lands before the work item catches up, so it wins over the item's state.
  const pullRequestStatus = merged ? 'merged' : pullRequest?.status;
  // A card that is a change request shows that request's state up front, in both layouts.
  const iconShowsStatus =
    pullRequestStatus !== undefined && source !== undefined && source !== 'user' && isPullRequestSource(source);
  const lineShowsStatus = updatedAt !== undefined && pullRequest !== undefined && pullRequestStatus !== undefined;
  const statusShown = iconShowsStatus || lineShowsStatus;
  const link = (
    <Link
      to={url}
      state={from ? { from } : undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={label ? `${label}: ${name}` : name}
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
      {source ? (
        <SessionSourceIcon source={source} pullRequestStatus={iconShowsStatus ? pullRequestStatus : undefined} />
      ) : null}
      <Sidebar.NavLabel
        description={
          updatedAt === undefined ? undefined : (
            <SessionMetaLine
              updatedAt={updatedAt}
              pullRequest={pullRequest}
              status={pullRequestStatus}
              showStatusIcon={!iconShowsStatus}
            />
          )
        }
      >
        {label ?? name}
      </Sidebar.NavLabel>
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
  // When the row already draws the change request's state, the merged badge would repeat it; keep it for screen readers only.
  const trailing = trailingKind({ loading, status, merged: merged && !statusShown });
  const mergedForScreenReaders = statusShown && trailingKind({ loading, status, merged }) === 'merged';
  const mergedLabel = changeRequestProvider === 'gitlab' ? 'Merge request merged' : 'Pull request merged';
  const action = (
    <>
      {belt ? <ActivityBelt status={belt} label={beltLabel(belt, name)} /> : null}
      {visibility === 'private' ? (
        <SessionSharingPopover
          name={name}
          disabled={disabled || loading}
          onShare={onVisibilityChange ? () => onVisibilityChange('org') : undefined}
          sharing={changingVisibility}
        />
      ) : null}
      {mergedForScreenReaders ? (
        <span role="img" aria-label={`${mergedLabel} for ${name}`} className="sr-only" />
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
            size={updatedAt === undefined ? undefined : 'two-line'}
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

function SessionMetaLine({
  updatedAt,
  pullRequest,
  status,
  showStatusIcon,
}: {
  updatedAt: string;
  pullRequest: SessionPullRequest | undefined;
  status: PullRequestStatus | undefined;
  /** Off when the leading icon already shows the change request's state. */
  showStatusIcon: boolean;
}) {
  const label =
    status && pullRequest?.provider === 'gitlab'
      ? PULL_REQUEST_STATUS_LABELS[status].replace('pull request', 'merge request')
      : status && PULL_REQUEST_STATUS_LABELS[status];
  const showNumber = pullRequest?.number !== undefined;
  return (
    <>
      <time dateTime={updatedAt} className="tabular-nums">
        {relativeTime(updatedAt)}
      </time>
      {pullRequest && status && (showStatusIcon || showNumber) ? (
        <span role="img" aria-label={label} title={label} className="flex items-center gap-0.5 tabular-nums">
          {showStatusIcon ? <PullRequestStatusIcon status={status} decorative /> : null}
          {showNumber ? (
            <span aria-hidden>
              {pullRequest.provider === 'gitlab' ? '!' : '#'}
              {pullRequest.number}
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  );
}

function SessionSourceIcon({
  source,
  pullRequestStatus,
}: {
  source: SessionSource;
  pullRequestStatus?: PullRequestStatus;
}) {
  if (source === 'user') {
    return <User data-source="user" aria-hidden className="text-muted-foreground size-3.5 shrink-0" />;
  }
  if (pullRequestStatus) {
    return <PullRequestIcon data-source={source} status={pullRequestStatus} aria-hidden className="size-3.5" />;
  }
  return <SourceIcon source={source} className="size-3.5" />;
}

// Matches the 24px the sidebar row gives its action buttons.
const trailingSlot = 'size-6 shrink-0 grid-rows-1 place-items-center *:col-start-1 *:row-start-1';

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
