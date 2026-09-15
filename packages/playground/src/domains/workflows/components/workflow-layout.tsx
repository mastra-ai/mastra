import { WorkflowCanvasInsetContext } from '@mastra/playground-ui/components/Workflow';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { CollapsiblePanel } from '@mastra/playground-ui/resize/collapsible-panel';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Panel, useDefaultLayout } from 'react-resizable-panels';
import './workflow-layout.css';

export interface WorkflowLayoutProps {
  workflowId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
}

const LEFT_PANEL_MIN_WIDTH = 380;
const LEFT_PANEL_DEFAULT_WIDTH = LEFT_PANEL_MIN_WIDTH;
const PANEL_GUTTER = 8;

interface WorkflowLayoutStyle extends CSSProperties {
  '--workflow-left-panel-width': string;
}

export const WorkflowLayout = ({ workflowId, children, leftSlot }: WorkflowLayoutProps) => {
  const isDocked = useIsMobile();
  const hasLeftSlot = Boolean(leftSlot);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(0);
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `workflow-canvas-panels-${workflowId}`,
    storage: localStorage,
  });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const panel = panelRef.current;
    if (!canvas || !panel) return;
    const measurePanelInset = () => {
      const canvasBounds = canvas.getBoundingClientRect();
      const panelBounds = panel.getBoundingClientRect();
      setLeftPanelWidth(Math.max(0, panelBounds.right - canvasBounds.left - PANEL_GUTTER));
    };
    measurePanelInset();
    const observer = new ResizeObserver(measurePanelInset);
    observer.observe(canvas);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [isDocked, hasLeftSlot]);

  if (isDocked) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-[180px] min-w-0 flex-1 overflow-hidden">{children}</div>
        {leftSlot && <div className="bg-surface2 min-h-0 min-w-0 basis-[44%] overflow-hidden">{leftSlot}</div>}
      </div>
    );
  }

  const canvasInset = leftSlot ? leftPanelWidth : 0;
  const style: WorkflowLayoutStyle = { '--workflow-left-panel-width': `${canvasInset}px` };

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden" style={style}>
      <WorkflowCanvasInsetContext value={canvasInset}>
        <div ref={canvasRef} className="absolute inset-0 min-h-0 min-w-0 overflow-hidden">
          {children}
        </div>
      </WorkflowCanvasInsetContext>

      {leftSlot && (
        <PanelGroup
          className="pointer-events-none absolute inset-0 z-10 h-full min-h-0 w-full min-w-0"
          defaultLayout={defaultLayout}
          onLayoutChange={onLayoutChange}
        >
          <CollapsiblePanel
            direction="left"
            id="left-slot"
            minSize={LEFT_PANEL_MIN_WIDTH}
            maxSize={'50%'}
            defaultSize={LEFT_PANEL_DEFAULT_WIDTH}
            collapsedSize={0}
            collapsible={true}
            className="pointer-events-none min-w-0 bg-transparent [&>button]:pointer-events-auto"
          >
            <div ref={panelRef} className="h-full min-w-0">
              {leftSlot}
            </div>
          </CollapsiblePanel>
          <PanelSeparator className="pointer-events-auto" />
          <Panel id="left-overlay-filler" className="pointer-events-none min-w-0 bg-transparent" />
        </PanelGroup>
      )}
    </div>
  );
};
