import React, { forwardRef } from 'react';
import { Maximize, Minus, Plus } from 'lucide-react';

import { Panel, useViewport, useReactFlow, PanelProps } from '@xyflow/react';

import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const ZoomSlider = forwardRef<HTMLDivElement, Omit<PanelProps, 'children'>>(({ className, ...props }) => {
  const { zoom } = useViewport();
  const { zoomTo, zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <Panel className={cn('flex gap-1 rounded-md bg-primary-foreground p-1 text-foreground', className)} {...props}>
      <Button variant="ghost" size="icon" onClick={() => zoomOut({ duration: 300 })}>
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
      <Button variant="ghost" size="icon" onClick={() => zoomIn({ duration: 300 })}>
        <Plus className="h-4 w-4" />
      </Button>
      <Button className="min-w-20 tabular-nums" variant="ghost" onClick={() => zoomTo(1, { duration: 300 })}>
        {(100 * zoom).toFixed(0)}%
      </Button>
      <Button variant="ghost" size="icon" onClick={() => fitView({ duration: 300, maxZoom: 1 })}>
        <Maximize className="h-4 w-4" />
      </Button>
    </Panel>
  );
});

ZoomSlider.displayName = 'ZoomSlider';
