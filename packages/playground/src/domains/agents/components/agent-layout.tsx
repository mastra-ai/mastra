import { cn, getMainContentContentClassName, Icon, IconButton, PanelSeparator } from '@mastra/playground-ui';
import { PanelLeftOpen } from 'lucide-react';

import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';
import { RIGHT_PANEL_MAX_PERCENT } from '../context/panel-sizing-context';
import { SidebarCollapseProvider } from '../context/sidebar-collapse-context';
import { usePanelSizing } from '../context/use-panel-sizing';
import { useSidebarCollapse } from '../context/use-sidebar-collapse';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  browserOverlay?: React.ReactNode;
}

export const AgentLayout = ({ agentId, children, leftSlot, rightSlot, browserOverlay }: AgentLayoutProps) => {
  return (
    <SidebarCollapseProvider>
      <AgentLayoutInner agentId={agentId} leftSlot={leftSlot} rightSlot={rightSlot} browserOverlay={browserOverlay}>
        {children}
      </AgentLayoutInner>
    </SidebarCollapseProvider>
  );
};

function AgentLayoutInner({ agentId, children, leftSlot, rightSlot, browserOverlay }: AgentLayoutProps) {
  const panelIds = ['main-slot', ...(rightSlot ? ['right-slot'] : [])];
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: `agent-layout-v2-${agentId}`,
    panelIds,
    storage: localStorage,
  });
  const { collapsed, toggle } = useSidebarCollapse();
  const { rightPanelRef } = usePanelSizing();

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: false,
  });

  const separatorClassName = 'bg-transparent! group-hover/agent-layout:bg-surface3! transition-colors duration-normal';

  return (
    <div className="group/agent-layout relative h-full w-full overflow-hidden flex pt-1">
      {leftSlot && (
        <aside className={cn('shrink-0 h-full overflow-hidden pb-4 relative', collapsed ? 'w-[48px]' : 'w-[260px]')}>
          {collapsed ? (
            <div className="absolute top-2 left-2 pt-px pl-px z-10">
              <IconButton variant="ghost" size="sm" tooltip="Expand thread list" onClick={toggle}>
                <Icon>
                  <PanelLeftOpen />
                </Icon>
              </IconButton>
            </div>
          ) : (
            leftSlot
          )}
        </aside>
      )}
      <div className={cn('flex-1 min-w-0 h-full')}>
        <Group className={computedClassName} defaultLayout={defaultLayout} onLayoutChange={onLayoutChanged}>
          <Panel id="main-slot" className="grid overflow-y-auto relative pb-4">
            {children}
          </Panel>
          {rightSlot && (
            <>
              <PanelSeparator className={separatorClassName} />
              <Panel
                id="right-slot"
                panelRef={rightPanelRef}
                minSize="30%"
                maxSize={`${RIGHT_PANEL_MAX_PERCENT}%`}
                defaultSize="30%"
              >
                {rightSlot}
              </Panel>
            </>
          )}
        </Group>
      </div>
      {/* Browser modal overlay - center view mode */}
      {browserOverlay}
    </div>
  );
}
