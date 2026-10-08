import { useEffect, useEffectEvent, useRef } from 'react';
import type { RefObject } from 'react';
import type { KnowledgeGraphPayload } from '../../services/knowledge';
import type { KnowledgeGraphFilters } from './graphModel';
import { applyKnowledgePresentation } from './knowledgePresentation';

const ELEMENTS = '.react-flow__node, .react-flow__edge, [data-knowledge-edge-id]';

/** React Flow owns these elements; synchronize their independent presentation. */
export function KnowledgeGraphPresentation({
  canvasRef,
  payload,
  filters,
  focusedId,
  focusedRecordId,
}: {
  canvasRef: RefObject<HTMLDivElement | null>;
  payload: KnowledgeGraphPayload;
  filters: KnowledgeGraphFilters;
  focusedId?: string;
  focusedRecordId?: string;
}) {
  const cancelPresentation = useRef<(() => void) | undefined>(undefined);
  const present = useEffectEvent(() => {
    cancelPresentation.current?.();
    if (!canvasRef.current) return;
    cancelPresentation.current = applyKnowledgePresentation(canvasRef.current, payload, filters, {
      nodeId: focusedId,
      recordId: focusedRecordId,
    });
  });
  useEffect(() => {
    present();
    return () => cancelPresentation.current?.();
  }, [payload, filters, focusedId, focusedRecordId]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // New arrivals inherit focus before paint. Attribute updates do not retrigger
    // this observer, and floating controls/details do not require graph work.
    const observer = new MutationObserver(mutations => {
      const addedGraphElements = mutations.some(mutation =>
        [...mutation.addedNodes].some(
          node => node instanceof Element && (node.matches(ELEMENTS) || node.querySelector(ELEMENTS)),
        ),
      );
      if (addedGraphElements) {
        present();
      }
    });
    const finishFade = (event: TransitionEvent) => {
      const element = event.target;
      if (
        event.propertyName === 'opacity' &&
        element instanceof Element &&
        element.matches(ELEMENTS) &&
        element.hasAttribute('data-knowledge-hidden')
      )
        element.setAttribute('data-knowledge-hidden-settled', '');
    };
    canvas.addEventListener('transitionend', finishFade);
    observer.observe(canvas, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cancelPresentation.current?.();
      canvas.removeEventListener('transitionend', finishFade);
    };
  }, [canvasRef]);
  return null;
}
