import { CollapsiblePanel, PanelSeparator } from '@mastra/playground-ui';
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Panel, useDefaultLayout, Group } from 'react-resizable-panels';

export interface WorkflowLayoutProps {
  workflowId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const LEFT_PANEL_MIN_WIDTH = 380;
const LEFT_PANEL_DEFAULT_WIDTH = LEFT_PANEL_MIN_WIDTH;
const TIMELINE_LEFT_PANEL_OVERLAP = 8;

const getTimelineLeftOffset = (panelWidth: number) => Math.max(panelWidth - TIMELINE_LEFT_PANEL_OVERLAP, 0);

export const WorkflowLayout = ({ workflowId, children, leftSlot, rightSlot }: WorkflowLayoutProps) => {
  const [leftPanelWidth, setLeftPanelWidth] = useState(getTimelineLeftOffset(LEFT_PANEL_DEFAULT_WIDTH));
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `workflow-layout-v6-${workflowId}`,
    storage: localStorage,
  });

  return (
    <div
      className="relative h-full min-h-0 w-full min-w-0 overflow-hidden"
      style={{ '--workflow-left-panel-width': `${leftSlot ? leftPanelWidth : 0}px` } as CSSProperties}
    >
      <div className="absolute inset-0 min-w-0 overflow-y-auto">{children}</div>

      {leftSlot && (
        <Group
          className="pointer-events-none absolute inset-0 z-10 h-full min-h-0 w-full min-w-0 bg-transparent"
          defaultLayout={defaultLayout}
          onLayoutChange={onLayoutChange}
        >
          <CollapsiblePanel
            direction="left"
            id="left-slot"
            minSize={LEFT_PANEL_MIN_WIDTH}
            maxSize={'50%'}
            defaultSize={LEFT_PANEL_DEFAULT_WIDTH}
            collapsedSize={60}
            collapsible={true}
            className="pointer-events-auto min-w-0 bg-transparent"
            onResize={size => setLeftPanelWidth(getTimelineLeftOffset(size.inPixels))}
          >
            {leftSlot}
          </CollapsiblePanel>
          <PanelSeparator />
          <Panel id="left-overlay-filler" className="pointer-events-none min-w-0 bg-transparent" />
        </Group>
      )}

      {rightSlot && (
        <Group
          className="pointer-events-none absolute inset-0 z-10 h-full min-h-0 w-full min-w-0 bg-transparent"
          defaultLayout={defaultLayout}
          onLayoutChange={onLayoutChange}
        >
          <Panel id="right-overlay-filler" className="pointer-events-none min-w-0 bg-transparent" />
          <PanelSeparator />
          <CollapsiblePanel
            direction="right"
            id="right-slot"
            minSize={300}
            maxSize={'40%'}
            defaultSize={340}
            collapsedSize={60}
            collapsible={true}
            className="pointer-events-auto min-w-0 bg-transparent"
          >
            {rightSlot}
          </CollapsiblePanel>
        </Group>
      )}
    </div>
  );
};
