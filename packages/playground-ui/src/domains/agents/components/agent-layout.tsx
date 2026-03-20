import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';
import { getMainContentContentClassName } from '@/ds/components/MainContent';
import { PanelSeparator } from '@/lib/resize/separator';
import { CollapsiblePanel, CollapsiblePanelTriggerProps } from '@/lib/resize/collapsible-panel';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  rightDefaultCollapsed?: boolean;
  rightCollapsedTrigger?: CollapsiblePanelTriggerProps;
}

export const AgentLayout = ({
  agentId,
  children,
  leftSlot,
  rightSlot,
  rightDefaultCollapsed = false,
  rightCollapsedTrigger,
}: AgentLayoutProps) => {
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-${agentId}`,
    storage: localStorage,
  });

  const computedClassName = getMainContentContentClassName({
    isCentered: false,
    isDivided: true,
    hasLeftServiceColumn: Boolean(leftSlot),
  });

  return (
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
            defaultSize={rightDefaultCollapsed ? 60 : '30%'}
            collapsedSize={60}
            collapsible={true}
            collapsedTrigger={rightCollapsedTrigger}
          >
            {rightSlot}
          </CollapsiblePanel>
        </>
      )}
    </Group>
  );
};
