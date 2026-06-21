import { Drawer, DrawerContent, DrawerTitle, PanelDrawer, PanelSeparator, useIsMobile } from '@mastra/playground-ui';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  /** Accessible label for the mobile drawer that hosts the left slot */
  leftDrawerLabel?: string;
  /** Accessible label for the drawer that hosts the right slot */
  rightDrawerLabel?: string;
  onRightDrawerOpenChange?: (open: boolean) => void;
  browserOverlay?: React.ReactNode;
}

function FloatingRightDrawer({
  children,
  label,
  onOpenChange,
}: {
  children: React.ReactNode;
  label: string;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Drawer side="right" variant="floating" open={true} onOpenChange={onOpenChange}>
      <DrawerContent className="overflow-hidden" showCloseButton={false}>
        <DrawerTitle className="sr-only">{label}</DrawerTitle>
        {children}
      </DrawerContent>
    </Drawer>
  );
}

export const AgentLayout = ({
  agentId,
  children,
  leftSlot,
  rightSlot,
  leftDrawerLabel = 'Open left panel',
  rightDrawerLabel = 'Open right panel',
  onRightDrawerOpenChange,
  browserOverlay,
}: AgentLayoutProps) => {
  const isMobile = useIsMobile();
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `agent-layout-v5-${agentId}`,
    storage: localStorage,
  });

  // Resizable side panels are a desktop paradigm; below the breakpoint the
  // left slot moves into an edge drawer and the main content takes the full width.
  if (isMobile) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <div className="h-full w-full min-w-0">{children}</div>
        {leftSlot && (
          <PanelDrawer direction="left" label={leftDrawerLabel}>
            {leftSlot}
          </PanelDrawer>
        )}
        {rightSlot && (
          <FloatingRightDrawer label={rightDrawerLabel} onOpenChange={onRightDrawerOpenChange}>
            {rightSlot}
          </FloatingRightDrawer>
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
            {/* Resizable but intentionally not collapsible: threads + memory stay visible on desktop */}
            <Panel id="left-slot" minSize={200} maxSize={'30%'} defaultSize={300} className="min-w-0">
              {leftSlot}
            </Panel>
            <PanelSeparator />
          </>
        )}
        <Panel id="main-slot" className="grid min-w-0 overflow-y-auto relative">
          {children}
        </Panel>
      </Group>
      {rightSlot && (
        <FloatingRightDrawer label={rightDrawerLabel} onOpenChange={onRightDrawerOpenChange}>
          {rightSlot}
        </FloatingRightDrawer>
      )}
      {/* Browser modal overlay - center view mode */}
      {browserOverlay}
    </div>
  );
};
