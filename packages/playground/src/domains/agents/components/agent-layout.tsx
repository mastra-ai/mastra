import { cn, getMainContentContentClassName, Icon, IconButton, PanelSeparator } from '@mastra/playground-ui';
import { ChevronRight } from 'lucide-react';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';
import { SidebarCollapseProvider } from '../context/sidebar-collapse-context';
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
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-v2-${agentId}`,
    panelIds,
    storage: localStorage,
  });
  const { collapsed, expand } = useSidebarCollapse();

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: false,
  });

  const separatorClassName = 'bg-transparent! group-hover/agent-layout:bg-surface3! transition-colors duration-normal';

  return (
    <div className="group/agent-layout relative h-full w-full overflow-hidden flex">
      {leftSlot && (
        <aside
          className={cn(
            'shrink-0 h-full overflow-hidden transition-all duration-normal',
            collapsed ? 'w-[48px]' : 'w-[260px]',
          )}
        >
          {collapsed ? (
            <div className="flex h-full items-start justify-center pt-3">
              <IconButton variant="default" size="sm" tooltip="Expand thread list" onClick={expand}>
                <Icon>
                  <ChevronRight />
                </Icon>
              </IconButton>
            </div>
          ) : (
            leftSlot
          )}
        </aside>
      )}
      <div className="flex-1 min-w-0 h-full">
        <Group className={computedClassName} defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
          <Panel id="main-slot" className="grid overflow-y-auto relative pb-4">
            {children}
          </Panel>
          {rightSlot && (
            <>
              <PanelSeparator className={separatorClassName} />
              <Panel id="right-slot" minSize={300} maxSize={'50%'} defaultSize="30%">
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
