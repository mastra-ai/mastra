import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { HoverCard, HoverCardTrigger } from '@mastra/playground-ui/components/HoverCard';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { GitBranch, MoreHorizontal, Pin, PinOff, Trash2 } from 'lucide-react';

import { PullRequestStatusIcon } from '../../factory/components/PullRequestStatusIcon';
import { SessionPreviewCard } from './SessionPreviewCard';
import type { SessionPreviewDetails } from './SessionPreviewCard';

/**
 * Shared sidebar row for workspace/user sessions. Built on `MainSidebar.NavLink`
 * so every session list (work, review, user) renders with identical density,
 * hover, and active states. The optional status dot (agent running/finished)
 * hides on hover so the actions menu can take its place.
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
  onSelect,
  onPinChange,
  onDelete,
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
  status?: 'running' | 'attention';
  preview?: SessionPreviewDetails;
  pinned?: boolean;
  onSelect: () => void;
  onPinChange: (pinned: boolean) => void;
  onDelete: () => void;
}) {
  const button = (
    <button
      type="button"
      aria-current={active ? 'page' : undefined}
      aria-label={name}
      disabled={disabled || loading}
      onClick={onSelect}
      title={preview ? undefined : title}
    >
      <GitBranch />
      <MainSidebar.NavLabel className="flex-initial">{name}</MainSidebar.NavLabel>
      {pinned && !loading ? (
        <Pin aria-label={`${name} pinned`} className="text-icon3/70 size-2 shrink-0 rotate-45" />
      ) : null}
      {loading ? (
        <Spinner size="sm" aria-label={`Opening ${name}`} className="text-icon3 ml-auto shrink-0" />
      ) : status === 'running' ? (
        <span
          role="status"
          aria-label={`Agent working in ${name}`}
          title="Agent working"
          className="bg-accent1 ml-auto size-2 shrink-0 animate-pulse rounded-full group-hover/session:opacity-0"
        />
      ) : status === 'attention' ? (
        <span
          role="status"
          aria-label={`Agent finished in ${name}`}
          title="Agent finished — open to dismiss"
          className="bg-accent1 ml-auto size-2 shrink-0 rounded-full group-hover/session:opacity-0"
        />
      ) : merged ? (
        <span
          role="img"
          aria-label={`Pull request merged for ${name}`}
          title="Pull request merged"
          className="ml-auto flex shrink-0 group-hover/session:opacity-0"
        >
          <PullRequestStatusIcon status="merged" className="size-3!" decorative />
        </span>
      ) : null}
    </button>
  );
  const action = loading ? undefined : (
    <DropdownMenu>
      <DropdownMenu.Trigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Session actions for ${name}`}
            disabled={disabled}
            className="opacity-0 group-focus-within/session:opacity-100 group-hover/session:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenu.Content align="end" className="min-w-28">
        <DropdownMenu.Item onClick={() => onPinChange(!pinned)}>
          {pinned ? <PinOff /> : <Pin />}
          {pinned ? 'Unpin' : 'Pin session'}
        </DropdownMenu.Item>
        <DropdownMenu.Item variant="destructive" onClick={onDelete}>
          <Trash2 />
          Delete
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu>
  );
  const row = (
    <MainSidebar.NavLink
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
      <SessionPreviewCard name={name} status={status} merged={merged} details={preview} />
    </HoverCard>
  );
}
