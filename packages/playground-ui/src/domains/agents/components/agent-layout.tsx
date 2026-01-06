import { Panel, useDefaultLayout, Group, PanelImperativeHandle } from 'react-resizable-panels';
import { getMainContentContentClassName } from '@/components/ui/containers/MainContent';
import { PanelSeparator } from '@/lib/resize/separator';
import { CollapsiblePanel } from '@/lib/resize/collapsible-panel';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

export const AgentLayout = ({ agentId, children, leftSlot, rightSlot }: AgentLayoutProps) => {
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
            defaultSize={300}
            collapsedSize={60}
            collapsible={true}
          >
            {rightSlot}
          </CollapsiblePanel>
        </>
      )}
    </Group>
  );
};
