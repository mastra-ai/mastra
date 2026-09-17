import { WorkflowCanvasInsetContext } from '@mastra/playground-ui/components/Workflow';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useLocalStorageState } from '@mastra/playground-ui/hooks/use-local-storage-state';
import { ResizeHandleIndicator } from '@mastra/playground-ui/primitives/resize-handle-indicator';
import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { z } from 'zod/v4';
import './workflow-layout.css';

export interface WorkflowLayoutProps {
  children: React.ReactNode;
  leftSlot?: React.ReactNode;
}

const LEFT_PANEL_MIN_WIDTH = 380;
const LEFT_PANEL_WIDTH_STORAGE_KEY = 'workflow-canvas-left-panel-width';
const PANEL_GUTTER = 8;
const KEYBOARD_RESIZE_STEP = 16;

interface WorkflowLayoutStyle extends CSSProperties {
  '--workflow-left-panel-width': string;
}

interface PanelResize {
  width: number;
  resizeTo: (clientX: number) => void;
  resizeBy: (delta: number) => void;
}

const WorkflowPanelResizeContext = createContext<PanelResize | undefined>(undefined);

function clampPanelWidth(candidate: number, maxWidth: number) {
  return Math.max(LEFT_PANEL_MIN_WIDTH, Math.min(candidate, maxWidth));
}

export function WorkflowPanelResizeHandle() {
  const resize = useContext(WorkflowPanelResizeContext);
  if (!resize) return null;

  const beginResize = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const followPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    resize.resizeTo(event.clientX);
  };
  const nudgeWithArrows = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    resize.resizeBy(event.key === 'ArrowRight' ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize panel"
      aria-valuenow={resize.width}
      aria-valuemin={LEFT_PANEL_MIN_WIDTH}
      tabIndex={0}
      className="group/resize pointer-events-auto absolute inset-y-0 left-full flex w-2 cursor-col-resize touch-none items-center justify-center outline-hidden"
      onPointerDown={beginResize}
      onPointerMove={followPointer}
      onKeyDown={nudgeWithArrows}
    >
      <ResizeHandleIndicator className="group-focus-visible/resize:via-accent1 group-active/resize:via-neutral6/45 group-hover/resize:opacity-100 group-focus-visible/resize:opacity-100 group-active/resize:opacity-100" />
    </div>
  );
}

export const WorkflowLayout = ({ children, leftSlot }: WorkflowLayoutProps) => {
  const isDocked = useIsMobile();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [storedWidth, setStoredWidth] = useLocalStorageState({
    initialKey: LEFT_PANEL_WIDTH_STORAGE_KEY,
    defaultValue: LEFT_PANEL_MIN_WIDTH,
    schema: z.number(),
  });
  const [maxWidth, setMaxWidth] = useState(Number.POSITIVE_INFINITY);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const measureHalfCanvas = () => setMaxWidth(Math.floor(canvas.getBoundingClientRect().width / 2));
    measureHalfCanvas();
    const observer = new ResizeObserver(measureHalfCanvas);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [isDocked]);

  if (isDocked) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative min-h-[180px] min-w-0 flex-1 overflow-hidden">{children}</div>
        {leftSlot && <div className="bg-surface2 min-h-0 min-w-0 basis-[44%] overflow-hidden">{leftSlot}</div>}
      </div>
    );
  }

  const width = clampPanelWidth(storedWidth, maxWidth);
  const resizeTo = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStoredWidth(clampPanelWidth(clientX - canvas.getBoundingClientRect().left, maxWidth));
  };
  const resizeBy = (delta: number) => setStoredWidth(clampPanelWidth(width + delta, maxWidth));

  const canvasInset = leftSlot ? width - PANEL_GUTTER : 0;
  const style: WorkflowLayoutStyle = { '--workflow-left-panel-width': `${canvasInset}px` };

  return (
    <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden" style={style}>
      <WorkflowCanvasInsetContext value={canvasInset}>
        <div ref={canvasRef} className="absolute inset-0 min-h-0 min-w-0 overflow-hidden">
          {children}
        </div>
      </WorkflowCanvasInsetContext>

      {leftSlot && (
        <WorkflowPanelResizeContext value={{ width, resizeTo, resizeBy }}>
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 min-w-0" style={{ width }}>
            {leftSlot}
          </div>
        </WorkflowPanelResizeContext>
      )}
    </div>
  );
};
