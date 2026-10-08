import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import type { ReactNode } from 'react';
import { SidebarContent } from './ui/sidebar-content';
import { useSidebarSlot } from './ui/sidebar-slot-context';

/** Keep controls in the route's sidebar, while standalone consumers retain an inline layout. */
export function ExecutionWorkspace({ controls, children }: { controls: ReactNode; children: ReactNode }) {
  const slot = useSidebarSlot();
  if (slot) {
    return (
      <>
        <SidebarContent>{controls}</SidebarContent>
        {children}
      </>
    );
  }
  return (
    <ScrollArea className="h-full min-h-0 min-w-0" mask={false}>
      <div className="grid min-w-0 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
        <div className="min-w-0 border-b border-border lg:border-r lg:border-b-0">{controls}</div>
        {children}
      </div>
    </ScrollArea>
  );
}
