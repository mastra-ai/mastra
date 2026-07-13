import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { PanelDrawer } from '@mastra/playground-ui/resize/panel-drawer';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { useEffect, useRef } from 'react';
import { Panel, useDefaultLayout } from 'react-resizable-panels';
import type { PanelImperativeHandle } from 'react-resizable-panels';
import { useMemoryTimeline } from '../context/memory-timeline-context';

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

const MEMORY_DETAIL_LEFT_PANEL_DEFAULT_RESTORE = '300px';

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
  const wasMemoryTimelineOpen = useRef(false);
  const sizeBeforeMemoryDetail = useRef<string | null>(null);
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    // Bumped to v6 because the OM detail now replaces the Memory content in the
    // single left panel and expands it to ~50%; avoids restoring stale widths.
    id: `agent-layout-v6-${agentId}`,
    storage: localStorage,
  });

  useEffect(() => {
    const leftPanel = leftPanelRef.current;
    if (!leftPanel) return;

    const wasOpen = wasMemoryTimelineOpen.current;
    wasMemoryTimelineOpen.current = isMemoryTimelineOpen;

    if (isMemoryTimelineOpen && !wasOpen) {
      // Opening OM: capture the current width, then expand to half the layout.
      sizeBeforeMemoryDetail.current = `${leftPanel.getSize().inPixels}px`;
      leftPanel.resize('50%');
    } else if (!isMemoryTimelineOpen && wasOpen) {
      // Closing OM: restore the width the panel had before opening the detail.
      leftPanel.resize(sizeBeforeMemoryDetail.current ?? MEMORY_DETAIL_LEFT_PANEL_DEFAULT_RESTORE);
      sizeBeforeMemoryDetail.current = null;
    }
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
      <PanelGroup
        className="h-full min-h-0 w-full min-w-0"
        defaultLayout={defaultLayout}
        onLayoutChange={onLayoutChange}
      >
        {leftSlot && (
          <Panel
            id="left-slot"
            panelRef={leftPanelRef}
            minSize={256}
            maxSize={'50%'}
            defaultSize={300}
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
      </PanelGroup>
      {/* Browser modal overlay - center view mode */}
      {browserOverlay}
    </div>
  );
};
