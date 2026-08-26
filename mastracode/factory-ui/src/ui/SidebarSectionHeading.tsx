import { Txt } from '@mastra/playground-ui/components/Txt';
import type { ReactNode } from 'react';

/** Title row above a sidebar nav list, with room for one trailing action. */
export function SidebarSectionHeading({
  children,
  icon,
  action,
}: {
  children: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="text-neutral6/40 mt-4 flex min-h-6 items-center justify-between px-1">
      <Txt as="span" variant="ui-sm" className="flex items-center gap-2 font-semibold [&_svg]:size-3.5">
        {icon}
        {children}
      </Txt>
      {action}
    </div>
  );
}
