import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { GitBranch, MoreHorizontal, Trash2 } from 'lucide-react';

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
  onSelect,
  onDelete,
}: {
  name: string;
  /** Hover tooltip, typically the branch name. */
  title: string;
  url: string;
  active: boolean;
  disabled: boolean;
  /** True while this row's async open is in flight — shows a spinner and blocks clicks. */
  loading?: boolean;
  status?: 'running' | 'attention';
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <MainSidebar.NavLink
      link={{ name, url }}
      isActive={active}
      className="group/session"
      render={
        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          aria-label={name}
          disabled={disabled || loading}
          onClick={onSelect}
          title={title}
        >
          <GitBranch />
          <MainSidebar.NavLabel>{name}</MainSidebar.NavLabel>
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
          ) : null}
        </button>
      }
      action={
        loading ? undefined : (
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
              <DropdownMenu.Item variant="destructive" onClick={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu>
        )
      }
    />
  );
}
