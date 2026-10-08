import { useReactFlow } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import type { KnowledgeGraphPayload } from '../../services/knowledge';
import type { Arrivals } from './graphDiff';
import type { KnowledgeFlowEdge, KnowledgeGraphFilters } from './graphModel';
import type { KnowledgeFlowNode } from './knowledgeStyles';
import { getKnowledgeFitOptions } from './knowledgeViewport';
import {
  createKnowledgeScene,
  getVisibleKnowledgeIds,
  presentKnowledgeEdges,
  presentKnowledgeNodes,
} from './knowledgeScene';

export function KnowledgeGraphController({
  payload,
  arrivals,
  filters,
  focusedId,
  focusedRecordId,
  canvasRef,
}: {
  payload: KnowledgeGraphPayload;
  arrivals?: Arrivals;
  filters: KnowledgeGraphFilters;
  focusedId?: string;
  focusedRecordId?: string;
  canvasRef: RefObject<HTMLDivElement | null>;
}) {
  const flow = useReactFlow<KnowledgeFlowNode, KnowledgeFlowEdge>();
  const previousPayload = useRef(payload);

  // React Flow owns dragging and positions. Synchronize only domain changes to
  // its external store, rather than feeding rebuilt controlled arrays on every render.
  useEffect(() => {
    const currentNodes = flow.getNodes();
    const scene =
      previousPayload.current === payload
        ? { nodes: currentNodes, edges: flow.getEdges() }
        : createKnowledgeScene(payload, currentNodes);
    previousPayload.current = payload;
    const visibleIds = getVisibleKnowledgeIds(payload, filters, focusedId);
    flow.setNodes(
      presentKnowledgeNodes(scene.nodes, visibleIds, { nodeId: focusedId, recordId: focusedRecordId }, arrivals),
    );
    flow.setEdges(presentKnowledgeEdges(scene.edges, visibleIds, focusedRecordId, arrivals));
  }, [payload, arrivals, filters, focusedId, focusedRecordId, flow]);

  const fitScene = useEffectEvent(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const visibleIds = getVisibleKnowledgeIds(payload, filters, focusedId);
    const cameraIds = focusedId && visibleIds.has(focusedId) ? [focusedId] : [...visibleIds];
    void flow.fitView({
      ...getKnowledgeFitOptions(canvas, Boolean(focusedId)),
      nodes: cameraIds.map(id => ({ id })),
    });
  });

  // Focus and filters move the camera; polling, hovering, dragging and record
  // expansion do not. Effect Events read the latest scene without subscribing to it.
  useEffect(() => {
    const frame = requestAnimationFrame(fitScene);
    return () => cancelAnimationFrame(frame);
  }, [focusedId, filters]);

  return null;
}
