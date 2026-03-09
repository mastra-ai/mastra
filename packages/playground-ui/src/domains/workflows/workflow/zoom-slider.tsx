import React, { forwardRef } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';

import { Panel, useViewport, useReactFlow, PanelProps } from '@xyflow/react';

import { Slider } from '@/ds/components/Slider';
import { Button } from '@/ds/components/Button/Button';
import { cn } from '@/lib/utils';

export const ZoomSlider = forwardRef<HTMLDivElement, Omit<PanelProps, 'children'>>(({ className, ...props }) => {
  const { zoom } = useViewport();
  const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel className={cn('flex gap-1 rounded-md bg-surface2 p-1 text-neutral6', className)} {...props}>
      <Button onClick={() => zoomOut({ duration: 300 })}>
        <Minus className="h-4 w-4" />
      </Button>
      <Slider
        className="w-[140px]"
        value={[zoom]}
        min={0.01}
        max={1}
        step={0.01}
        onValueChange={values => {
          zoomTo(values[0]);
        }}
      />
      <Button onClick={() => zoomIn({ duration: 300 })}>
        <Plus className="h-4 w-4" />
      </Button>
      <Button className="min-w-20 tabular-nums" onClick={() => zoomTo(1, { duration: 300 })}>
        {(100 * zoom).toFixed(0)}%
      </Button>
      <Button onClick={() => fitView({ duration: 300, maxZoom: 1 })}>
        <Maximize className="h-4 w-4" />
      </Button>
    </Panel>
  );
});

ZoomSlider.displayName = 'ZoomSlider';
