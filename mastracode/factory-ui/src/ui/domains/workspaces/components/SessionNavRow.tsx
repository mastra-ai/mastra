import { Button } from '@mastra/playground-ui/components/Button';
import { DropdownMenu } from '@mastra/playground-ui/components/DropdownMenu';
import { MainSidebar } from '@mastra/playground-ui/components/MainSidebar';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { GitBranch, GitMerge, MoreHorizontal, Trash2 } from 'lucide-react';

export function SessionNavRow({
  name,
  title,
  url,
  active,
  disabled,
  loading,
  status,
  merged,
  onSelect,
  onDelete,
}: {
  name: string;
  /** Hover tooltip, typically the branch name. */
  title: string;
  url: string;
  active: boolean;
  disabled: boolean;
  loading?: boolean;
  merged?: boolean;
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
            <Spinner
              size="sm"
              variant="default"
              aria-label={`Agent working in ${name}`}
              className="text-icon3 ml-auto shrink-0 group-hover/session:opacity-0"
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
              <GitMerge aria-hidden className="text-accent3!" />
            </span>
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
