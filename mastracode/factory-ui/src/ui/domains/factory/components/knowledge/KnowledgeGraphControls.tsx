import { ControlButton, Controls, useReactFlow } from '@xyflow/react';
import { Maximize } from 'lucide-react';
import type { RefObject } from 'react';

import { getKnowledgeFitOptions } from './knowledgeViewport';

export function KnowledgeGraphControls({
  canvasRef,
  visibleIds,
  focusedId,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  visibleIds: ReadonlySet<string>;
  focusedId?: string;
}) {
  const flow = useReactFlow();
  function fitView() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cameraIds = focusedId && visibleIds.has(focusedId) ? [focusedId] : [...visibleIds];
    void flow.fitView({
      ...getKnowledgeFitOptions(canvas, Boolean(focusedId)),
      nodes: cameraIds.map(id => ({ id })),
    });
  }
  return (
    <Controls position="bottom-right" showInteractive={false} showFitView={false}>
      <ControlButton onClick={fitView} title="Fit view" aria-label="Fit view">
        <Maximize />
      </ControlButton>
    </Controls>
  );
}
