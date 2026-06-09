import { CollapsiblePanel, PanelSeparator } from '@mastra/playground-ui';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';

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

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Group className="h-full min-h-0 w-full min-w-0" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
        {leftSlot && (
          <>
            <CollapsiblePanel
              direction="left"
              id="left-slot"
              minSize={200}
              maxSize={'30%'}
              defaultSize={300}
              collapsedSize={60}
              collapsible={true}
              className="min-w-0"
            >
              {leftSlot}
            </CollapsiblePanel>
            <PanelSeparator />
          </>
        )}
        <Panel id="main-slot" className="grid min-w-0 overflow-y-auto relative">
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
              className="min-w-0"
            >
              {rightSlot}
            </CollapsiblePanel>
          </>
        )}
      </Group>
      {/* Browser modal overlay - center view mode */}
      {browserOverlay}
    </div>
  );
};
