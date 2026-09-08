import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { HoverCard, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { MainSidebar, useMaybeSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { cn } from '@mastra/playground-ui/utils/cn';
import { MoreHorizontal, Pin, PinOff, RefreshCw, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import type { RefObject } from 'react';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import type { SessionRowStatus } from '../services/sessionStatus';
import { SessionActivityBelt } from './SessionActivity';
import { SessionPreviewCard } from './SessionPreviewCard';
import type { SessionPreviewDetails } from './SessionPreviewCard';

/**
 * Shared sidebar row for workspace/user sessions. Built on `MainSidebar.NavLink`
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
  active,
  disabled,
  loading,
  status,
  merged,
  preview: previewDetails,
  pinned = false,
  onSelect,
  onPinChange,
  onDelete,
  onRegenerateTitle,
  regeneratingTitle,
}: {
  name: string;
  /** Hover tooltip, typically the branch name. */
  title?: string;
  url: string;
  active: boolean;
  disabled: boolean;
  /** True while this row's async open is in flight — shows a spinner and blocks clicks. */
  loading?: boolean;
  /** Merged pull request for this session's branch — shown only when the row is otherwise idle. */
  merged?: boolean;
  status?: SessionRowStatus;
  preview?: SessionPreviewDetails;
  pinned?: boolean;
  onSelect: () => void;
  onPinChange: (pinned: boolean) => void;
  /** Omit on sessions the viewer does not own: the server only lets owners delete. */
  onDelete?: () => void;
  /** Omitted for sessions the viewer does not own: the server only lets owners rename. */
  onRegenerateTitle?: () => void;
  regeneratingTitle?: boolean;
}) {
  const anchor = useRef<HTMLLIElement>(null);
  // Selecting a session navigates away, so the mobile nav drawer must close.
  const sidebar = useMaybeSidebar();
  // Touch has no hover: the card would only open behind the tap that already navigated away.
  const preview = sidebar?.isMobile ? undefined : previewDetails;
  const button = (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-label={name}
      disabled={disabled || loading}
      onClick={() => {
        sidebar?.setOpenMobile(false);
        onSelect();
      }}
      title={preview ? undefined : title}
    >
      <MainSidebar.NavLabel>{name}</MainSidebar.NavLabel>
      {pinned && !loading ? (
        <Pin aria-label={`${name} pinned`} className="text-icon3/70 size-2 shrink-0 rotate-45" />
      ) : null}
    </button>
  );
  const belt = loading ? undefined : status;
  const trailing = trailingKind({ loading, status, merged });
  const action = (
    <>
      {belt ? <SessionActivityBelt status={belt} label={beltLabel(belt, name)} /> : null}
      <span className={cn(trailingSlot, trailing ? 'grid' : revealedSlot)}>
        {trailing === 'loading' ? <Spinner size="sm" aria-label={`Opening ${name}`} className="text-icon3" /> : null}
        {trailing === 'merged' ? (
          <span
            role="img"
            aria-label={`Pull request merged for ${name}`}
            title="Pull request merged"
            className={cn('flex', yieldsToActions)}
          >
            <PullRequestStatusIcon status="merged" className="size-3!" decorative />
          </span>
        ) : null}
        {trailing === 'loading' ? null : (
          <SessionActionsMenu
            name={name}
            anchor={anchor}
            disabled={disabled}
            pinned={pinned}
            onPinChange={onPinChange}
            onDelete={onDelete}
            onRegenerateTitle={onRegenerateTitle}
            regeneratingTitle={regeneratingTitle}
          />
        )}
      </span>
    </>
  );
  const row = (
    <MainSidebar.NavLink
      ref={anchor}
      link={{ name, url }}
      isActive={active}
      className="group/session"
      // 0ms both ways — each row owns its card, so a close delay leaves the previous one up while the next opens
      render={preview ? <HoverCardTrigger delay={0} closeDelay={0} render={button} /> : button}
      action={action}
    />
  );

  if (!preview) return row;

  return (
    <HoverCard>
      {row}
      <SessionPreviewCard name={name} anchor={anchor} status={status} merged={merged} details={preview} />
    </HoverCard>
  );
}

const trailingSlot = 'size-form-sm shrink-0 place-items-center *:col-start-1 *:row-start-1';

// An empty slot claims no width, so the label runs the full row until there is something to show.
const revealedSlot =
  'hidden group-focus-within/session:grid group-hover/session:grid group-has-[[data-popup-open]]/session:grid';

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

function SessionActionsMenu({
  name,
  anchor,
  disabled,
  pinned,
  onPinChange,
  onDelete,
  onRegenerateTitle,
  regeneratingTitle,
}: {
  name: string;
  anchor: RefObject<HTMLElement | null>;
  disabled: boolean;
  pinned: boolean;
  onPinChange: (pinned: boolean) => void;
  onDelete?: () => void;
  onRegenerateTitle?: () => void;
  regeneratingTitle?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Session actions for ${name}`}
            disabled={disabled}
            className="hidden group-focus-within/session:flex group-hover/session:flex data-[popup-open]:flex"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenu.Content anchor={anchor} align="end">
        <DropdownMenu.Item onClick={() => onPinChange(!pinned)}>
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? 'Unpin' : 'Pin session'}
        </DropdownMenu.Item>
        {onRegenerateTitle ? (
          <DropdownMenu.Item disabled={regeneratingTitle} onClick={onRegenerateTitle}>
            <RefreshCw className={cn(regeneratingTitle && 'animate-spin')} />
            Regenerate title
          </DropdownMenu.Item>
        ) : null}
        {onDelete ? (
          <DropdownMenu.Item variant="destructive" onClick={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenu.Item>
        ) : null}
      </DropdownMenu.Content>
    </DropdownMenu>
  );
}

// The actions menu owns the slot as soon as the row is hovered, focused, or its menu is open.
const yieldsToActions =
  'group-hover/session:hidden group-focus-within/session:hidden group-has-[[data-popup-open]]/session:hidden';
