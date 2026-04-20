import { getMainContentContentClassName, PanelSeparator } from '@mastra/playground-ui';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  browserOverlay?: React.ReactNode;
}

export const AgentLayout = ({ agentId, children, leftSlot, rightSlot, browserOverlay }: AgentLayoutProps) => {
  const panelIds = ['main-slot', ...(rightSlot ? ['right-slot'] : [])];
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-v2-${agentId}`,
    panelIds,
    storage: localStorage,
  });

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: false,
  });

  const separatorClassName = 'bg-transparent! group-hover/agent-layout:bg-surface3! transition-colors duration-normal';

  return (
    <div className="group/agent-layout relative h-full w-full overflow-hidden flex">
      {leftSlot && <aside className="w-[260px] shrink-0 h-full overflow-hidden">{leftSlot}</aside>}
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
};
