import { WorkflowCanvasInsetContext } from '@mastra/playground-ui/components/Workflow';
import { CollapsiblePanel } from '@mastra/playground-ui/resize/collapsible-panel';
import { PanelGroup } from '@mastra/playground-ui/resize/panel-group';
import { PanelSeparator } from '@mastra/playground-ui/resize/separator';
import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Panel, useDefaultLayout } from 'react-resizable-panels';
import { WorkflowPanelEdgesContext } from '../context/workflow-panel-edges-context';
import { WorkflowPanelSeparator } from './workflow-panel-separator';
import './workflow-layout.css';

export interface WorkflowLayoutProps {
  workflowId: string;
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

const LEFT_PANEL_MIN_WIDTH = 380;
const LEFT_PANEL_DEFAULT_WIDTH = LEFT_PANEL_MIN_WIDTH;
interface WorkflowLayoutStyle extends CSSProperties {
  '--workflow-left-panel-width': string;
}

export const WorkflowLayout = ({ workflowId, children, leftSlot, rightSlot }: WorkflowLayoutProps) => {
  const hasLeftPanel = Boolean(leftSlot);
  const canvasRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [leftPanelWidth, setLeftPanelWidth] = useState(0);
  const [informationSurface, setInformationSurface] = useState<HTMLElement | null>(null);
  const [recentRunsSurface, setRecentRunsSurface] = useState<HTMLElement | null>(null);
  const { defaultLayout, onLayoutChange } = useDefaultLayout({
    id: `workflow-layout-v6-${workflowId}`,
    storage: localStorage,
  });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const panel = panelRef.current;
    if (!canvas || !panel) return;
    const measurePanelInset = () => {
      const canvasBounds = canvas.getBoundingClientRect();
      const panelBounds = panel.getBoundingClientRect();
      const overlaysCanvas = panelBounds.top < canvasBounds.bottom && panelBounds.bottom > canvasBounds.top;
      setLeftPanelWidth(overlaysCanvas ? Math.max(0, panelBounds.right - canvasBounds.left - 8) : 0);
    };
    measurePanelInset();
    const observer = new ResizeObserver(measurePanelInset);
    observer.observe(canvas);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [hasLeftPanel]);

  const style: WorkflowLayoutStyle = { '--workflow-left-panel-width': `${leftSlot ? leftPanelWidth : 0}px` };

  return (
    <div className="workflow-layout-container" style={style}>
      <div className="workflow-layout-surfaces" data-has-panels={Boolean(leftSlot || rightSlot) || undefined}>
        <WorkflowCanvasInsetContext value={leftSlot ? leftPanelWidth : 0}>
          <div ref={canvasRef} className="workflow-layout-canvas">
            {children}
          </div>
        </WorkflowCanvasInsetContext>

        {leftSlot && (
          <PanelGroup className="workflow-left-overlay" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
            <CollapsiblePanel
              direction="left"
              id="left-slot"
              minSize={LEFT_PANEL_MIN_WIDTH}
              maxSize={'50%'}
              defaultSize={LEFT_PANEL_DEFAULT_WIDTH}
              collapsedSize={0}
              collapsible={true}
              className="workflow-left-panel pointer-events-none min-w-0 bg-transparent"
            >
              <div ref={panelRef} className="h-full min-w-0">
                <WorkflowPanelEdgesContext
                  value={{ information: setInformationSurface, recentRuns: setRecentRunsSurface }}
                >
                  {leftSlot}
                </WorkflowPanelEdgesContext>
              </div>
            </CollapsiblePanel>
            <WorkflowPanelSeparator
              surface={informationSurface}
              containerRef={panelRef}
              label="Resize workflow panel"
            />
            <WorkflowPanelSeparator surface={recentRunsSurface} containerRef={panelRef} label="Resize recent runs" />
            <Panel id="left-overlay-filler" className="pointer-events-none min-w-0 bg-transparent" />
          </PanelGroup>
        )}

        {rightSlot && (
          <PanelGroup className="workflow-right-overlay" defaultLayout={defaultLayout} onLayoutChange={onLayoutChange}>
            <Panel id="right-overlay-filler" className="pointer-events-none min-w-0 bg-transparent" />
            <PanelSeparator />
            <CollapsiblePanel
              direction="right"
              id="right-slot"
              minSize={300}
              maxSize={'40%'}
              defaultSize={340}
              collapsedSize={0}
              collapsible={true}
              className="pointer-events-auto min-w-0 bg-transparent"
            >
              {rightSlot}
            </CollapsiblePanel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
};
