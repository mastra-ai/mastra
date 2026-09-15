import type { PanelProps } from '@xyflow/react';
import { Panel, useViewport, useReactFlow, useStore } from '@xyflow/react';
import { Maximize, Minus, Plus } from 'lucide-react';
import { forwardRef } from 'react';
import { Button } from '@/ds/components/Button';
import { Slider } from '@/ds/components/Slider';
import { cn } from '@/utils/cn';

export const ZoomSlider = forwardRef<
  HTMLDivElement,
  Omit<PanelProps, 'children'> & { compact?: boolean; onFitView?: () => void }
>(({ className, compact = false, onFitView, ...props }, ref) => {
  const { zoom } = useViewport();
  const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow();
  const minZoom = useStore(state => state.minZoom);
  const maxZoom = useStore(state => state.maxZoom);

  return (
    <Panel
      ref={ref}
      className={cn(
        'flex items-center gap-1 rounded-full border border-border1 bg-surface2 p-1 text-neutral6',
        className,
      )}
      {...props}
    >
      <Button size="icon-sm" tooltip="Zoom out" disabled={zoom <= minZoom} onClick={() => zoomOut({ duration: 300 })}>
        <Minus />
      </Button>
      {!compact && (
        <Slider
          className="w-[140px]"
          aria-label="Canvas zoom"
          value={[zoom]}
          min={minZoom}
          max={maxZoom}
          step={0.01}
          largeStep={0.25}
          format={{ style: 'percent' }}
          onValueChange={values => {
            const [nextZoom] = values;
            if (nextZoom !== undefined) void zoomTo(nextZoom);
          }}
        />
      )}
      <Button size="icon-sm" tooltip="Zoom in" disabled={zoom >= maxZoom} onClick={() => zoomIn({ duration: 300 })}>
        <Plus />
      </Button>
      <Button
        size="sm"
        className="min-w-16 tabular-nums"
        tooltip="Reset to actual size (100%)"
        onClick={() => zoomTo(1, { duration: 300 })}
      >
        {(100 * zoom).toFixed(0)}%
      </Button>
      <Button size="icon-sm" tooltip="Fit view" onClick={onFitView ?? (() => fitView({ duration: 300, maxZoom: 1 }))}>
        <Maximize />
      </Button>
    </Panel>
  );
});

ZoomSlider.displayName = 'ZoomSlider';
