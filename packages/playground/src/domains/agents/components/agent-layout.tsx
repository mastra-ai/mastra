import { CollapsiblePanel, PanelDrawer, PanelSeparator, useIsMobile } from '@mastra/playground-ui';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  browserOverlay?: React.ReactNode;
}

export const AgentLayout = ({ agentId, children, leftSlot, rightSlot, browserOverlay }: AgentLayoutProps) => {
  const isMobile = useIsMobile();
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-v2-${agentId}`,
    storage: localStorage,
  });

  // Resizable side panels are a desktop paradigm; below the breakpoint the
  // slots move into edge drawers and the main content takes the full width.
  if (isMobile) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <div className="h-full w-full min-w-0">{children}</div>
        {leftSlot && (
          <PanelDrawer direction="left" label="Open left panel">
            {leftSlot}
          </PanelDrawer>
        )}
        {rightSlot && (
          <PanelDrawer direction="right" label="Open right panel">
            {rightSlot}
          </PanelDrawer>
        )}
        {browserOverlay}
      </div>
    );
  }

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
              collapsedSize={0}
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
              collapsedSize={0}
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
