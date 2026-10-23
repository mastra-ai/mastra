import type { ReactNode } from 'react';
import { Txt } from '@/ds/components/Txt';
import { useLinkComponent } from '@/lib/framework';

export interface WorkspaceLinkProps {
  href: string;
  icon: ReactNode;
  children: ReactNode;
}

export const WorkspaceLink = ({ href, icon, children }: WorkspaceLinkProps) => {
  const { Link } = useLinkComponent();

  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-fill hover:text-foreground"
    >
      {icon}
      <Txt as="span" variant="meta" className="truncate">
        {children}
      </Txt>
    </Link>
  );
};
