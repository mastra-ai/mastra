import type { SessionRowStatus } from '@mastra/factory/session/session-row-status';
import type { CardChangeRequest, PullRequestStatus } from '@mastra/factory/work-items/change-requests';
import { ContextMenu } from '@mastra/playground-ui/components/ContextMenu';
import { HoverCard, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { Sidebar, useMaybeSidebar } from '@mastra/playground-ui/components/Sidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Location } from 'react-router';

import { SourceIcon } from '../../factory/components/BoardIcons';
import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { SessionSource } from '../services/sessionPresentation';
import type { SessionExternalLink } from '../services/sessionRows';
import { ActivityBelt } from '@mastra/playground-ui/components/Activity';
import { SessionActionsMenu } from './SessionActionsMenu';
import { SessionMenuItems } from './SessionMenuItems';
import { SessionPreviewCard } from './SessionPreviewCard';
import type { SessionPreviewDetails } from './SessionPreviewCard';
import { SessionSharingPopover } from './SessionSharingPopover';
import { relativeTime } from '../../../../lib/date/relativeTime';
import { changeRequestStatusLabel } from '../../factory/changeRequestState';
import { changeRequestNumberLabel, changeRequestReference } from '../../factory/sessionChangeRequests';
import type { ChangeRequestProvider } from '../../factory/services/githubSubscriptions';
import { isPullRequestSource } from '../../factory/services/workItems';
import { IconPin } from '@mastra/playground-ui/icons/central/IconPin';
import { IconUser } from '@mastra/playground-ui/icons/central/IconUser';

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
  runByFactory,
  level,
  title,
  url,
  externalLinks,
  source,
  active,
  disabled,
  loading,
  status,
  preview: previewDetails,
  pinned = false,
  from,
  onPinChange,
  onDelete,
  onRename,
  onRegenerateTitle,
  onAnswerApproval,
  answeringApproval,
  regeneratingTitle,
  visibility,
  onVisibilityChange,
  changingVisibility,
  pullRequest,
  pullRequestStatus,
  repository,
  updatedAt,
  compact,
  subItems,
}: {
  name: string;
  /** Shown instead of the name, which stays in the accessible name: a child session's phase. */
  label?: string;
  /** The Factory owns this session, though it is listed under a person's. */
  runByFactory?: boolean;
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
  status?: SessionRowStatus;
  preview?: SessionPreviewDetails;
  pinned?: boolean;
  /** Retain the board location when opening a factory workspace in this tab. */
  from?: Location;
  onPinChange: (pinned: boolean) => void;
  /** Omit on sessions the viewer does not own: the server only lets owners delete. */
  onDelete?: () => void;
  /** Omitted for sessions the viewer does not own: the server only lets owners rename. */
  onRename?: () => void;
  onRegenerateTitle?: () => void;
  /** Set while a followed card's phase session waits on an approval this viewer may give. */
  onAnswerApproval?: (decision: 'approve' | 'decline') => void;
  answeringApproval?: boolean;
  regeneratingTitle?: boolean;
  /** Private rows show a sharing popover; shared rows have no visibility badge. */
  visibility?: 'org' | 'private';
  /** Omitted for sessions the viewer does not own: the server only lets owners change visibility. */
  onVisibilityChange?: (visibility: 'org' | 'private') => void;
  /** Disables the visibility item while a change is in flight, so overlapping requests cannot land out of order. */
  changingVisibility?: boolean;
  /** The change request the session's card is, or links to. */
  pullRequest?: CardChangeRequest;
  pullRequestStatus?: PullRequestStatus;
  repository?: string;
  updatedAt: string;
  /** Single-line row; otherwise a second line shows its time and its change request. */
  compact: boolean;
  /** Rows nested under this one: a card's child sessions. */
  subItems?: ReactNode;
}) {
  // The row box, not the list item, which also holds any nested rows.
  const anchor = useRef<HTMLSpanElement>(null);
  const statusId = useId();
  const timeId = useId();
  // Selecting a session navigates away, so the mobile nav drawer must close.
  const sidebar = useMaybeSidebar();
  // Touch has no hover: the card would only open behind the tap that already navigated away.
  const preview = sidebar?.isMobile ? undefined : previewDetails;
  const merged = pullRequestStatus === 'merged';
  const statusAt = pullRequestPlacement({ source, pullRequest, pullRequestStatus, compact, merged, loading, status });
  const statusLabel =
    (statusAt === 'icon' || statusAt === 'line') && pullRequest && pullRequestStatus
      ? [changeRequestStatusLabel(pullRequest.provider, pullRequestStatus), changeRequestNumberLabel(pullRequest)]
          .filter(Boolean)
          .join(' ')
      : undefined;
  const link = (
    <Link
      to={url}
      state={from ? { from } : undefined}
      aria-current={active ? 'page' : undefined}
      aria-label={[runByFactory ? 'Run by Factory' : undefined, label, name].filter(Boolean).join(': ')}
      aria-describedby={
        [statusLabel ? statusId : undefined, compact ? undefined : timeId].filter(Boolean).join(' ') || undefined
      }
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
        <SessionSourceIcon
          source={source}
          provider={pullRequest?.provider}
          pullRequestStatus={statusAt === 'icon' ? pullRequestStatus : undefined}
        />
      ) : null}
      <Sidebar.NavLabel
        description={
          compact ? undefined : (
            <SessionMetaLine
              id={timeId}
              updatedAt={updatedAt}
              pullRequest={pullRequest}
              repository={repository}
              status={statusAt === 'line' ? pullRequestStatus : undefined}
            />
          )
        }
      >
        {label ?? name}
        {runByFactory ? <span className="text-muted-foreground ml-1.5">run by Factory</span> : null}
      </Sidebar.NavLabel>
      {pinned && !loading ? (
        <IconPin aria-label={`${name} pinned`} className="text-muted-foreground/70 size-icon-xs shrink-0 rotate-45" />
      ) : null}
      {statusLabel ? (
        <span id={statusId} hidden>
          {statusLabel}
        </span>
      ) : null}
    </Link>
  );
  const menuProps = {
    url,
    externalLinks,
    pinned,
    onPinChange,
    onDelete,
    onRename,
    onRegenerateTitle,
    regeneratingTitle,
    onAnswerApproval,
    answeringApproval,
    visibility,
    onVisibilityChange,
    changingVisibility,
  };
  const belt = loading ? undefined : status;
  const trailing = loading ? 'loading' : statusAt === 'badge' ? 'merged' : undefined;
  const mergedLabel = changeRequestStatusLabel(pullRequest?.provider ?? 'github', 'merged');
  const action = (
    <>
      <span ref={anchor} aria-hidden className="pointer-events-none absolute inset-0" />
      {belt ? <ActivityBelt status={belt} label={beltLabel(belt, name)} /> : null}
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
            link={{ name, url }}
            isActive={active}
            level={level}
            // 0ms both ways — each row owns its card, so a close delay leaves the previous one up while the next opens
            render={preview ? <HoverCardTrigger delay={0} closeDelay={0} render={link} /> : link}
            action={action}
            subItems={subItems}
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

type PullRequestPlacement = 'icon' | 'line' | 'badge' | undefined;

/**
 * Where a row draws its change request's state, once: the leading icon of a card that is
 * the change request, the second line of an expanded row, or a merged badge on a compact
 * row with no lifecycle left to report.
 */
function pullRequestPlacement({
  source,
  pullRequest,
  pullRequestStatus,
  compact,
  merged,
  loading,
  status,
}: {
  source?: SessionSource;
  pullRequest?: CardChangeRequest;
  pullRequestStatus?: PullRequestStatus;
  compact: boolean;
  merged?: boolean;
  loading?: boolean;
  status?: SessionRowStatus;
}): PullRequestPlacement {
  if (pullRequestStatus && source && isPullRequestSource(source)) return 'icon';
  if (pullRequestStatus && pullRequest && !compact) return 'line';
  if (merged && !loading && !status) return 'badge';
  return undefined;
}

/** The link describes the change request itself, so the line only draws it. */
function SessionMetaLine({
  id,
  updatedAt,
  pullRequest,
  repository,
  status,
}: {
  id: string;
  updatedAt: string;
  pullRequest: CardChangeRequest | undefined;
  repository: string | undefined;
  /** Omitted when the leading icon already shows the change request's state. */
  status: PullRequestStatus | undefined;
}) {
  const reference = pullRequest?.number === undefined ? undefined : changeRequestReference(pullRequest, repository);
  const ago = relativeTime(updatedAt);
  return (
    <>
      <time id={id} dateTime={updatedAt} title={`Updated ${ago}`} className="tabular-nums">
        <span className="sr-only">Updated </span>
        {ago}
      </time>
      {status || reference ? (
        <span aria-hidden className="flex items-center gap-0.5 tabular-nums">
          {status ? <PullRequestStatusIcon status={status} provider={pullRequest?.provider} decorative /> : null}
          {reference}
        </span>
      ) : null}
    </>
  );
}

function SessionSourceIcon({
  source,
  provider,
  pullRequestStatus,
}: {
  source: SessionSource;
  provider: ChangeRequestProvider | undefined;
  pullRequestStatus?: PullRequestStatus;
}) {
  if (source === 'user') {
    return <IconUser data-source="user" aria-hidden className="text-muted-foreground size-icon-sm shrink-0" />;
  }
  if (pullRequestStatus) {
    return <PullRequestStatusIcon status={pullRequestStatus} provider={provider} decorative className="size-3.5" />;
  }
  return <SourceIcon source={source} className="size-3.5" />;
}

// As wide as `Sidebar.NavAction`, so swapping the badge for the menu never moves the label.
const trailingSlot = 'size-6 shrink-0 grid-rows-1 place-items-center *:col-start-1 *:row-start-1';

// An empty slot claims no width, so the label runs the full row until there is something to show.
const revealedSlot =
  'grid pointer-fine:hidden group-focus-within/nav-row:grid group-hover/nav-row:grid group-has-[[data-popup-open]]/nav-row:grid';

function beltLabel(status: SessionRowStatus, name: string) {
  if (status === 'initializing') return `Initializing ${name}`;
  if (status === 'working') return `Agent working in ${name}`;
  return `${name} waiting on you`;
}

// The actions menu owns the slot as soon as the row is hovered, focused, or its menu is open.
const yieldsToActions =
  'pointer-coarse:hidden group-hover/nav-row:hidden group-focus-within/nav-row:hidden group-has-[[data-popup-open]]/nav-row:hidden';
