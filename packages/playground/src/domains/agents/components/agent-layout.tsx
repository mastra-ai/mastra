import { PanelDrawer, PanelSeparator, useIsMobile } from '@mastra/playground-ui';
import { useEffect, useRef } from 'react';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { useMemoryTimeline } from '../context';

export interface AgentLayoutProps {
  agentId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
  /** Accessible label for the mobile drawer that hosts the left slot */
  leftDrawerLabel?: string;
  /** Accessible label for the mobile drawer that hosts the right slot */
  rightDrawerLabel?: string;
  browserOverlay?: React.ReactNode;
}

const MEMORY_DETAIL_LEFT_PANEL_MIN_WIDTH = 760;

export const AgentLayout = ({
  agentId,
  children,
  leftSlot,
  rightSlot,
  leftDrawerLabel = 'Open left panel',
  rightDrawerLabel = 'Open right panel',
  browserOverlay,
}: AgentLayoutProps) => {
  const isMobile = useIsMobile();
  const { isPanelOpen: isMemoryTimelineOpen } = useMemoryTimeline();
  const leftPanelRef = useRef<PanelImperativeHandle | null>(null);
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    // Bumped to v5 because the Memory sidepanel can expand into a two-column
    // layout; avoids restoring stale narrow widths that hide the OM detail column.
    id: `agent-layout-v5-${agentId}`,
    storage: localStorage,
  });

  useEffect(() => {
    if (!isMemoryTimelineOpen) return;

    const leftPanel = leftPanelRef.current;
    if (!leftPanel) return;

    const currentSize = leftPanel.getSize();
    if (currentSize.inPixels >= MEMORY_DETAIL_LEFT_PANEL_MIN_WIDTH) return;

    leftPanel.resize(`${MEMORY_DETAIL_LEFT_PANEL_MIN_WIDTH}px`);
  }, [isMemoryTimelineOpen]);

  // Resizable side panels are a desktop paradigm; below the breakpoint the
  // side slots move into edge drawers and the main content takes the full width.
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
          <PanelDrawer direction="right" label={rightDrawerLabel}>
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
          <Panel
            id="left-slot"
            panelRef={leftPanelRef}
            minSize={256}
            maxSize={isMemoryTimelineOpen ? '80%' : '50%'}
            defaultSize={isMemoryTimelineOpen ? MEMORY_DETAIL_LEFT_PANEL_MIN_WIDTH : 300}
            className="min-w-0"
          >
            {leftSlot}
          </Panel>
        )}

        {leftSlot && <PanelSeparator />}
        <Panel id="main-slot" className="grid min-w-0 overflow-y-auto relative">
          {children}
        </Panel>
        {rightSlot && (
          <>
            <PanelSeparator />
            <Panel id="right-slot" minSize={320} maxSize={'45%'} defaultSize={420} className="min-w-0">
              {rightSlot}
            </Panel>
          </>
        )}
      </Group>
      {/* Browser modal overlay - center view mode */}
      {browserOverlay}
    </div>
  );
};
