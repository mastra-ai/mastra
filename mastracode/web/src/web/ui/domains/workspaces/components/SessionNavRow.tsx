import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
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
          disabled={disabled}
          onClick={onSelect}
          title={title}
        >
          <GitBranch />
          <MainSidebar.NavLabel>{name}</MainSidebar.NavLabel>
          {status === 'running' ? (
            <span
              role="status"
              aria-label={`Agent working in ${name}`}
              title="Agent working"
              className="ml-auto size-2 shrink-0 animate-pulse rounded-full bg-accent1 group-hover/session:opacity-0"
            />
          ) : status === 'attention' ? (
            <span
              role="status"
              aria-label={`Agent finished in ${name}`}
              title="Agent finished — open to dismiss"
              className="ml-auto size-2 shrink-0 rounded-full bg-accent1 group-hover/session:opacity-0"
            />
          ) : null}
        </button>
      }
      action={
        <DropdownMenu>
          <DropdownMenu.Trigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Session actions for ${name}`}
                disabled={disabled}
                className="opacity-0 group-hover/session:opacity-100 group-focus-within/session:opacity-100 data-[popup-open]:opacity-100"
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
      }
    />
  );
}
