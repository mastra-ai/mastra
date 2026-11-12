import { useEffect, useEffectEvent, useId, useRef } from 'react';
import type { RefObject } from 'react';

import { passageEndRect, rangeFromSource } from './annotatable-selection';
import { paintHighlights } from './annotation-highlights';
import type { ChatAnnotation } from './chat-annotations';

export interface AnnotationPlacementOptions {
  containerRef: RefObject<Element | null>;
  annotations: readonly ChatAnnotation[];
  emphasized: string | undefined;
}

interface PlacedPassage {
  id: string;
  marker: HTMLButtonElement;
  range: Range;
  end: DOMRect;
}

interface PlacedBubble {
  marker: HTMLButtonElement;
  left: number;
  top: number;
  width: number;
}

// Leaves room for a hovered bubble's 115% scale.
const BUBBLE_GAP_PX = 4;
const TAIL_INSET_X_PX = 1;
const TAIL_DROP_Y_PX = 7;

/** Bubbles on one line sit side by side, in the order their passages end, inside the transcript. */
function spreadLine(line: readonly PlacedBubble[], layerWidth: number): PlacedBubble[] {
  const pushedRight: PlacedBubble[] = [];
  for (const bubble of line.toSorted((a, b) => a.left - b.left)) {
    const previous = pushedRight.at(-1);
    const left = previous ? Math.max(bubble.left, previous.left + previous.width + BUBBLE_GAP_PX) : bubble.left;
    pushedRight.push({ ...bubble, left });
  }
  const fitted: PlacedBubble[] = [];
  for (const bubble of pushedRight.toReversed()) {
    const next = fitted.at(-1);
    const limit = next ? next.left - BUBBLE_GAP_PX : layerWidth;
    fitted.push({ ...bubble, left: Math.min(bubble.left, limit - bubble.width) });
  }
  return fitted;
}

function spreadBubbles(bubbles: readonly PlacedBubble[], layerWidth: number): PlacedBubble[] {
  const lines = new Map<number, PlacedBubble[]>();
  for (const bubble of bubbles) {
    const line = Math.round(bubble.top);
    lines.set(line, [...(lines.get(line) ?? []), bubble]);
  }
  return [...lines.values()].flatMap(line => spreadLine(line, layerWidth));
}

function placedPassage(annotation: ChatAnnotation, marker: HTMLButtonElement): PlacedPassage | undefined {
  const range = rangeFromSource(annotation.source);
  if (!range) return undefined;
  const end = passageEndRect(range);
  if (!end) return undefined;
  return { id: annotation.id, marker, range, end };
}

export function useAnnotationPlacement({ containerRef, annotations, emphasized }: AnnotationPlacementOptions) {
  const transcriptId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef(new Map<string, HTMLButtonElement>());
  const tracking = annotations.length > 0;

  // Written straight to the bubbles: layout is read after commit, and nothing renders from it.
  const place = useEffectEvent(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const origin = layer.getBoundingClientRect();
    const shown: PlacedPassage[] = [];
    for (const annotation of annotations) {
      const marker = markersRef.current.get(annotation.id);
      if (!marker) continue;
      const passage = placedPassage(annotation, marker);
      marker.hidden = !passage;
      if (passage) shown.push(passage);
    }
    const bubbles = shown.map(({ marker, end }) => ({
      marker,
      left: end.right - origin.left - TAIL_INSET_X_PX,
      top: end.top - origin.top + TAIL_DROP_Y_PX,
      width: marker.offsetWidth,
    }));
    for (const { marker, left, top } of spreadBubbles(bubbles, origin.width)) {
      marker.style.left = `${left}px`;
      marker.style.top = `${top}px`;
    }
    paintHighlights(
      transcriptId,
      shown.map(passage => passage.range),
      shown.find(passage => passage.id === emphasized)?.range,
    );
  });

  useEffect(() => {
    place();
  }, [annotations, emphasized]);

  useEffect(() => {
    const layer = layerRef.current;
    const container = containerRef.current;
    if (!tracking || !layer || !container) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => place());
    };
    const resizes = new ResizeObserver(schedule);
    resizes.observe(layer);
    const mutations = new MutationObserver(schedule);
    mutations.observe(container, { childList: true, characterData: true, subtree: true });
    container.addEventListener('scroll', schedule, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resizes.disconnect();
      mutations.disconnect();
      container.removeEventListener('scroll', schedule, { capture: true });
      paintHighlights(transcriptId, [], undefined);
    };
  }, [tracking, containerRef, transcriptId]);

  const markerRef = (id: string) => (marker: HTMLButtonElement | null) => {
    if (!marker) return;
    markersRef.current.set(id, marker);
    return () => {
      markersRef.current.delete(id);
    };
  };

  return { layerRef, markerRef };
}
