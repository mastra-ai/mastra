import type { PanelProps } from '@xyflow/react';
import { Panel, useViewport, useReactFlow } from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { forwardRef } from 'react';
import { Button } from '@/ds/components/Button';
import { Slider } from '@/ds/components/Slider';
import { cn } from '@/utils/cn';

export const ZoomSlider = forwardRef<HTMLDivElement, Omit<PanelProps, 'children'>>(({ className, ...props }, ref) => {
  const { zoom } = useViewport();
  const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel
      ref={ref}
      className={cn(
        'flex items-center gap-1 rounded-full border border-border1 bg-surface2 p-1 text-neutral6',
        className,
      )}
      {...props}
    >
      <Button size="icon-sm" tooltip="Zoom out" onClick={() => zoomOut({ duration: 300 })}>
        <Minus />
      </Button>
      <Slider
        style={{ width: 140 }}
        value={[zoom]}
        min={0.01}
        max={1}
        step={0.01}
        onValueChange={values => {
          const [nextZoom] = values;
          if (nextZoom !== undefined) void zoomTo(nextZoom);
        }}
      />
      <Button size="icon-sm" tooltip="Zoom in" onClick={() => zoomIn({ duration: 300 })}>
        <Plus />
      </Button>
      <Button size="sm" className="min-w-16 tabular-nums" onClick={() => zoomTo(1, { duration: 300 })}>
        {(100 * zoom).toFixed(0)}%
      </Button>
      <Button size="icon-sm" tooltip="Fit view" onClick={() => fitView({ duration: 300, maxZoom: 1 })}>
        <Maximize />
      </Button>
    </Panel>
  );
});

ZoomSlider.displayName = 'ZoomSlider';
