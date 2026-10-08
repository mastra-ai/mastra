import { ControlButton, Controls, useReactFlow } from '@xyflow/react';
import { Maximize } from 'lucide-react';
import type { RefObject } from 'react';

import { fitKnowledgeViewport } from './knowledgeViewport';
import type { KnowledgeFlowNode } from './knowledgeStyles';
import type { KnowledgeFlowEdge } from './graphModel';

export function KnowledgeGraphControls({
  canvasRef,
  visibleIds,
  focusedId,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  visibleIds: ReadonlySet<string>;
  focusedId?: string;
}) {
  const flow = useReactFlow<KnowledgeFlowNode, KnowledgeFlowEdge>();
  function fitView() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cameraIds = focusedId && visibleIds.has(focusedId) ? [focusedId] : [...visibleIds];
    fitKnowledgeViewport(flow, canvas, cameraIds, Boolean(focusedId));
  }
  return (
    <Controls position="bottom-right" showInteractive={false} showFitView={false}>
      <ControlButton onClick={fitView} title="Fit view" aria-label="Fit view">
        <Maximize />
      </ControlButton>
    </Controls>
  );
}
