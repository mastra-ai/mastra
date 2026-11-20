import type { ReactNode } from 'react';
import { useRecordNavigation } from '@/domains/chat/context/record-navigation';
import { Txt } from '@/ds/components/Txt';
import { useLinkComponent } from '@/lib/framework';

export interface WorkspaceLinkProps {
  /** The workspace the call ran in; without it, the link opens the workspaces list. */
  workspaceId?: string;
  /** The path of its filesystem the call named. */
  path?: string;
  icon: ReactNode;
  children: ReactNode;
}

const TEXT_CLASS = 'flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground';
const LINK_CLASS = `${TEXT_CLASS} transition-colors hover:bg-fill hover:text-foreground`;

/**
 * The workspace a call ran in. In a live chat it links to the workspace's Studio page; read back from a
 * record it opens through the host's `onOpenWorkspace`, and shows as text without one.
 */
export const WorkspaceLink = ({ workspaceId, path, icon, children }: WorkspaceLinkProps) => {
  const record = useRecordNavigation();
  const { Link } = useLinkComponent();
  const label = (
    <>
      {icon}
      <Txt as="span" variant="meta" className="truncate">
        {children}
      </Txt>
    </>
  );

  if (record) {
    const { onOpenWorkspace } = record;
    if (!onOpenWorkspace) return <span className={TEXT_CLASS}>{label}</span>;
    return (
      <button type="button" className={LINK_CLASS} onClick={() => onOpenWorkspace({ workspaceId, path })}>
        {label}
      </button>
    );
  }

  const query = path ? `?path=${encodeURIComponent(path)}` : '';
  return (
    <Link href={workspaceId ? `/workspaces/${workspaceId}${query}` : '/workspaces'} className={LINK_CLASS}>
      {label}
    </Link>
  );
};
