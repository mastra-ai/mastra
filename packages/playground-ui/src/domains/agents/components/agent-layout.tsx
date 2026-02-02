import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';
import { getMainContentContentClassName } from '@/ds/components/MainContent';
import { PanelSeparator } from '@/lib/resize/separator';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  browserOverlay?: React.ReactNode;
}

export const AgentLayout = ({ agentId, children, leftSlot, rightSlot, browserOverlay }: AgentLayoutProps) => {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-v2-${agentId}`,
    storage: localStorage,
  });

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: Boolean(leftSlot),
  });

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Group className={computedClassName} defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {leftSlot && (
          <>
            <CollapsiblePanel
              direction="left"
              id="left-slot"
              minSize={200}
              maxSize={'30%'}
              defaultSize={200}
              collapsedSize={60}
              collapsible={true}
            >
              {leftSlot}
            </CollapsiblePanel>
            <PanelSeparator />
          </>
        )}
        <Panel id="main-slot" className="grid overflow-y-auto relative bg-surface1 py-4">
          {children}
        </Panel>
        {rightSlot && (
          <>
            <PanelSeparator />
            <CollapsiblePanel
              direction="right"
              id="right-slot"
              minSize={300}
              maxSize={'50%'}
              defaultSize="30%"
              collapsedSize={60}
              collapsible={true}
            >
              {rightSlot}
            </CollapsiblePanel>
          </>
        )}
      </Group>
      {browserOverlay}
    </div>
  );
};
