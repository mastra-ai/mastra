import { CreateButton } from '@mastra/playground-ui/components/Button';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import type { ReactNode } from 'react';

export interface HeaderCreateActionProps {
  href: string;
  tooltip: string;
  children: ReactNode;
}

/** "New X" link rendered in the page header of listing pages. One per page (owns the `C` shortcut). */
export function HeaderCreateAction({ href, tooltip, children }: HeaderCreateActionProps) {
  const { Link } = useLinkComponent();
  return (
    <CreateButton render={<Link href={href} />} tooltip={tooltip} variant="ghost" size="sm">
      {children}
    </CreateButton>
  );
}
