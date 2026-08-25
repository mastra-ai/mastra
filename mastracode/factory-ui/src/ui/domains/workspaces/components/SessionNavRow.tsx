import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { HoverCard, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { MainSidebar, useMaybeSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { GitBranch, MoreHorizontal, Pin, PinOff, RefreshCw, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import type { RefObject } from 'react';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import { SessionPreviewCard } from './SessionPreviewCard';
import type { SessionPreviewDetails } from './SessionPreviewCard';

/**
 * Shared sidebar row for workspace/user sessions. Built on `MainSidebar.NavLink`
 * so every session list (work, review, user) renders with identical density,
 * hover, and active states. Spinner, status dot and actions menu share one
 * trailing slot beside the label: they swap in place, and the slot collapses
 * when there is nothing to show so the label gets the full row. Because that
 * slot comes and goes, the menu and the preview card anchor to the row box
 * instead — a resized or hidden anchor would drag them across the screen.
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
  preview,
  pinned = false,
  owner,
  onSelect,
  onPinChange,
  onDelete,
  onRegenerateTitle,
  regeneratingTitle,
}: {
  name: string;
  /** Hover tooltip, typically the branch name. */
  title?: string;
  /** Owner marker shown on sessions the viewer does not own. */
  owner?: string;
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
  const button = (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-label={owner ? `${name}, started by ${owner}` : name}
      disabled={disabled || loading}
      onClick={() => {
        sidebar?.setOpenMobile(false);
        onSelect();
      }}
      title={preview ? undefined : title}
    >
      <GitBranch />
      <MainSidebar.NavLabel className="flex-initial">{name}</MainSidebar.NavLabel>
      {owner ? (
        <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0 truncate">
          {owner}
        </Txt>
      ) : null}
      {pinned && !loading ? (
        <Pin aria-label={`${name} pinned`} className="text-icon3/70 size-2 shrink-0 rotate-45" />
      ) : null}
    </button>
  );
  const indicator = indicatorKind({ loading, status, merged });
  const action = (
    <span className={cn(trailingSlot, indicator ? 'grid' : revealedSlot)}>
      {indicator ? <SessionRowIndicator kind={indicator} name={name} /> : null}
      {indicator === 'loading' ? null : (
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

/**
 * Session lifecycle states surfaced by the row's status dot. The color scheme
 * mirrors `SessionFavicon` so the sidebar and the tab-favicon read the same
 * way at a glance.
 */
export type SessionRowStatus = 'initializing' | 'working' | 'ready';

type IndicatorKind = 'loading' | SessionRowStatus | 'merged';

function indicatorKind({
  loading,
  status,
  merged,
}: {
  loading?: boolean;
  status?: SessionRowStatus;
  merged?: boolean;
}): IndicatorKind | undefined {
  if (loading) return 'loading';
  if (status) return status;
  return merged ? 'merged' : undefined;
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

function SessionRowIndicator({ kind, name }: { kind: IndicatorKind; name: string }) {
  if (kind === 'loading') return <Spinner size="sm" aria-label={`Opening ${name}`} className="text-icon3" />;

  if (kind === 'initializing')
    return (
      <span
        role="status"
        aria-label={`Initializing ${name}`}
        title="Initializing"
        className={cn('bg-warning1 size-2 animate-pulse rounded-full', yieldsToActions)}
      />
    );

  if (kind === 'working')
    return (
      <span
        role="status"
        aria-label={`Agent working in ${name}`}
        title="Working"
        className={cn('bg-positive1 size-2 animate-pulse rounded-full', yieldsToActions)}
      />
    );

  if (kind === 'ready')
    return (
      <span
        role="status"
        aria-label={`${name} ready — open to dismiss`}
        title="Ready"
        className={cn('bg-accent3 size-2 rounded-full', yieldsToActions)}
      />
    );

  return (
    <span
      role="img"
      aria-label={`Pull request merged for ${name}`}
      title="Pull request merged"
      className={cn('flex', yieldsToActions)}
    >
      <PullRequestStatusIcon status="merged" className="size-3!" decorative />
    </span>
  );
}
