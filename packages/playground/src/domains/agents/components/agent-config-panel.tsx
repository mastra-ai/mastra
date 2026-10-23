import {
  Drawer,
  DrawerBackdrop,
  DrawerPopup,
  DrawerPortal,
  DrawerTitle,
  DrawerViewport,
} from '@mastra/playground-ui/components/Drawer';
import { ActivatedSkillsProvider } from '@mastra/playground-ui/domains/agents/context/activated-skills-context';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import type { ReactNode } from 'react';

import { AgentOverviewPanel } from './agent-overview-panel/agent-overview-panel';
import { RouteSidePanel } from '@/lib/route-side-panel';

/**
 * The agent Config panel. On desktop it is the route side panel next to the Studio frame.
 * Below the breakpoint it opens in a drawer instead, whose trigger is the header Config button
 * (`AgentConfigToggle`), so wrap the page in it.
 */
export function AgentConfigPanel({ agentId, children }: { agentId: string; children: ReactNode }) {
  const isMobile = useIsMobile();
  const panel = (
    <ActivatedSkillsProvider key={agentId}>
      <AgentOverviewPanel agentId={agentId} />
    </ActivatedSkillsProvider>
  );

  return (
    <Drawer side="right">
      {children}
      {isMobile ? (
        <DrawerPortal>
          <DrawerBackdrop />
          <DrawerViewport>
            <DrawerPopup className="w-[calc(100vw-2.5rem)] max-w-md">
              <DrawerTitle className="sr-only">Config</DrawerTitle>
              <div className="flex min-h-0 flex-1 flex-col">{panel}</div>
            </DrawerPopup>
          </DrawerViewport>
        </DrawerPortal>
      ) : (
        <RouteSidePanel owner="agent-detail">{panel}</RouteSidePanel>
      )}
    </Drawer>
  );
}
