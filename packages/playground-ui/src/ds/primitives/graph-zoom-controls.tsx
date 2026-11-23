import { useReactFlow, useStore } from '@xyflow/react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { IconFullscreen1 } from '@/ds/icons/central/IconFullscreen1';
import { IconMinusMedium } from '@/ds/icons/central/IconMinusMedium';
import { IconPlusMedium } from '@/ds/icons/central/IconPlusMedium';

// Keep the graph covered by the field surface and layer the disabled tint over it.
const disabledZoomSurface = 'disabled:bg-field disabled:[--surface-tint:var(--fill-subtle)]';

interface GraphZoomControlsProps {
  duration: number;
  onFitView: (duration: number) => void;
  slider?: ReactNode;
  reset?: ReactNode;
}

export function GraphZoomControls({ duration, onFitView, slider, reset }: GraphZoomControlsProps) {
  const { zoomIn, zoomOut } = useReactFlow();
  const atMinZoom = useStore(state => state.transform[2] <= state.minZoom);
  const atMaxZoom = useStore(state => state.transform[2] >= state.maxZoom);
  const motionDuration = () => (window.matchMedia?.('(prefers-reduced-motion: no-preference)').matches ? duration : 0);

  return (
    <>
      <Button
        size="icon-sm"
        tooltip="Zoom out"
        className={disabledZoomSurface}
        disabled={atMinZoom}
        onClick={() => void zoomOut({ duration: motionDuration() })}
      >
        <IconMinusMedium />
      </Button>
      {slider}
      <Button
        size="icon-sm"
        tooltip="Zoom in"
        className={disabledZoomSurface}
        disabled={atMaxZoom}
        onClick={() => void zoomIn({ duration: motionDuration() })}
      >
        <IconPlusMedium />
      </Button>
      {reset}
      <Button size="icon-sm" tooltip="Fit view" onClick={() => onFitView(motionDuration())}>
        <IconFullscreen1 />
      </Button>
    </>
  );
}
