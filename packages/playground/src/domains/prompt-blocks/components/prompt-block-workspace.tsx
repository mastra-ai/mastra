import { ScrollArea, ScrollAreaViewport } from '@mastra/playground-ui/components/ScrollArea';
import type { ReactNode } from 'react';
import { SidebarContent } from '@/components/ui/sidebar-content';
import { useSidebarSlot } from '@/components/ui/sidebar-slot-context';
import { AgentEditLayout } from '@/domains/agents/components/agent-edit-page/agent-edit-layout';

/** Prompt configuration occupies the route sidebar, leaving the main pane for content. */
export function PromptBlockWorkspace({ configuration, children }: { configuration: ReactNode; children: ReactNode }) {
  const slot = useSidebarSlot();
  if (!slot) return <AgentEditLayout leftSlot={configuration}>{children}</AgentEditLayout>;
  return (
    <>
      <SidebarContent>{configuration}</SidebarContent>
      <ScrollArea className="h-full min-h-0 min-w-0 py-4" mask={false}>
        <ScrollAreaViewport className="[&>div]:h-full">{children}</ScrollAreaViewport>
      </ScrollArea>
    </>
  );
}
