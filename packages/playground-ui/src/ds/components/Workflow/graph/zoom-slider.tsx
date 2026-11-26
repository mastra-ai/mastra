import type { PanelProps } from '@xyflow/react';
import { Panel, useReactFlow, useStore } from '@xyflow/react';
import { forwardRef } from 'react';
import { WORKFLOW_CAMERA_DURATION, workflowCameraDuration } from './workflow-camera-duration';
import { Button } from '@/ds/components/Button';
import { Slider } from '@/ds/components/Slider';
import { GraphZoomControls } from '@/ds/primitives/graph-zoom-controls';
import { cn } from '@/utils/cn';

export const ZoomSlider = forwardRef<
  HTMLDivElement,
  Omit<PanelProps, 'children'> & { compact?: boolean; onFitView?: (duration: number) => void }
>(({ className, compact = false, onFitView, ...props }, ref) => {
  const { zoomTo, fitView } = useReactFlow();
  const zoom = useStore(state => state.transform[2]);
  const minZoom = useStore(state => state.minZoom);
  const maxZoom = useStore(state => state.maxZoom);

  return (
    <Panel
      ref={ref}
      className={cn(
        'flex items-center gap-1 rounded-full border border-border bg-background p-1 text-foreground',
        className,
      )}
      {...props}
    >
      <GraphZoomControls
        duration={WORKFLOW_CAMERA_DURATION}
        onFitView={onFitView ?? (duration => void fitView({ duration, maxZoom: 1 }))}
        slider={
          !compact && (
            <Slider
              className="w-35"
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
          )
        }
        reset={
          <Button
            size="sm"
            className="min-w-16 tabular-nums"
            tooltip="Reset to actual size (100%)"
            onClick={() => zoomTo(1, { duration: workflowCameraDuration() })}
          >
            {(100 * zoom).toFixed(0)}%
          </Button>
        }
      />
    </Panel>
  );
});

ZoomSlider.displayName = 'ZoomSlider';
