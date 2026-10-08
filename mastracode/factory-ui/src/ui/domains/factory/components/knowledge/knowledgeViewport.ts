import { getViewportForBounds } from '@xyflow/react';
import type { FitViewOptions, ReactFlowInstance } from '@xyflow/react';
import type { KnowledgeFlowEdge } from './graphModel';
import type { KnowledgeFlowNode } from './knowledgeStyles';
import { easeKnowledgeMotion, readKnowledgeDuration } from './knowledgeMotion';

export function getKnowledgeMotionDuration(canvas: HTMLElement): number {
  const style = getComputedStyle(canvas);
  const duration = readKnowledgeDuration(canvas, '--duration-slow');
  const scale = parseFloat(style.getPropertyValue('--knowledge-motion-scale')) || 1.6;
  return duration * scale;
}

/** Reserve room for the floating controls without changing the canvas size. */
export function getKnowledgeFitOptions(canvas: HTMLElement, focused: boolean): FitViewOptions {
  const narrow = window.matchMedia('(max-width: 767px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    padding: {
      top: narrow ? '170px' : '200px',
      left: '48px',
      right: focused && !narrow ? '420px' : '48px',
      bottom: focused && narrow ? `${Math.round(canvas.clientHeight * 0.45) + 80}px` : '60px',
    },
    maxZoom: focused ? 1.4 : 1,
    duration: reducedMotion ? 0 : getKnowledgeMotionDuration(canvas),
    ease: easeKnowledgeMotion,
    interpolate: 'linear',
  };
}

/** Move only the viewport; fitView queues an unnecessary node-store update. */
export function fitKnowledgeViewport(
  flow: ReactFlowInstance<KnowledgeFlowNode, KnowledgeFlowEdge>,
  canvas: HTMLElement,
  ids: string[],
  focused: boolean,
) {
  if (ids.length === 0) return;
  const { padding = 0.1, maxZoom = 1, duration, ease, interpolate } = getKnowledgeFitOptions(canvas, focused);
  const bounds = flow.getNodesBounds(ids);
  const viewport = getViewportForBounds(bounds, canvas.clientWidth, canvas.clientHeight, 0.05, maxZoom, padding);
  void flow.setViewport(viewport, { duration, ease, interpolate });
}
