import { useReactFlow } from '@xyflow/react';
import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import type { KnowledgeGraphPayload } from '../../services/knowledge';
import type { Arrivals } from './graphDiff';
import type { KnowledgeFlowEdge, KnowledgeGraphFilters } from './graphModel';
import type { KnowledgeFlowNode } from './knowledgeStyles';
import { fitKnowledgeViewport } from './knowledgeViewport';
import { readKnowledgeDuration } from './knowledgeMotion';
import { createKnowledgeScene, getVisibleKnowledgeIds, getKnowledgeArrivalScene } from './knowledgeScene';

export function KnowledgeGraphController({
  payload,
  arrivals,
  filters,
  focusedId,
  canvasRef,
}: {
  payload: KnowledgeGraphPayload;
  arrivals?: Arrivals;
  filters: KnowledgeGraphFilters;
  focusedId?: string;
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
    const arrived = getKnowledgeArrivalScene(scene, arrivals);
    flow.setNodes(arrived.nodes);
    flow.setEdges(arrived.edges);
  }, [payload, arrivals, flow]);

  const fitScene = useEffectEvent(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const visibleIds = getVisibleKnowledgeIds(payload, filters, focusedId);
    // Frame connected context together with the selected node, preserving positions.
    fitKnowledgeViewport(flow, canvas, [...visibleIds], Boolean(focusedId));
  });

  // Focus and filters move the camera; polling, hovering, dragging and record
  // expansion do not. Effect Events read the latest scene without subscribing to it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Give the context fade a brief lead before camera travel.
    const delay = focusedId && !reducedMotion ? readKnowledgeDuration(canvas, '--duration-normal') : 0;
    const timer = window.setTimeout(fitScene, delay);
    return () => window.clearTimeout(timer);
  }, [focusedId, filters]);

  return null;
}
