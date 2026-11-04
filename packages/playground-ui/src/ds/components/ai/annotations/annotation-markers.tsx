import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { passageEndRect, rangeFromSource } from './annotatable-selection';
import { AnnotationCommentCard } from './annotation-comment-card';
import { paintHighlights } from './annotation-highlights';
import { AnnotationMarker } from './annotation-marker';
import type { ChatAnnotation } from './chat-annotations';
import { Popover, PopoverContent } from '@/ds/components/Popover';

export interface AnnotationMarkersProps {
  containerRef: RefObject<Element | null>;
  annotations: readonly ChatAnnotation[];
  onCommentChange: (id: string, comment: string) => void;
  onRemove: (id: string) => void;
}

interface CommentCard {
  id: string;
  anchor: HTMLElement;
  open: boolean;
}

interface PlacedBubble {
  marker: HTMLButtonElement;
  left: number;
  top: number;
  width: number;
}

// Leaves room for a hovered bubble's 115% scale.
const BUBBLE_GAP = 4;

/** Bubbles on one line sit side by side, in the order their passages end, inside the transcript. */
function spreadLine(line: readonly PlacedBubble[], layerWidth: number): PlacedBubble[] {
  const pushedRight: PlacedBubble[] = [];
  for (const bubble of line.toSorted((a, b) => a.left - b.left)) {
    const previous = pushedRight.at(-1);
    const left = previous ? Math.max(bubble.left, previous.left + previous.width + BUBBLE_GAP) : bubble.left;
    pushedRight.push({ ...bubble, left });
  }
  const fitted: PlacedBubble[] = [];
  for (const bubble of pushedRight.toReversed()) {
    const next = fitted.at(-1);
    const limit = next ? next.left - BUBBLE_GAP : layerWidth;
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

export function AnnotationMarkers({ containerRef, annotations, onCommentChange, onRemove }: AnnotationMarkersProps) {
  const transcriptId = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef(new Map<string, HTMLButtonElement>());
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [hovered, setHovered] = useState<string>();
  const [card, setCard] = useState<CommentCard>();
  const cardIndex = card ? annotations.findIndex(annotation => annotation.id === card.id) : -1;
  const cardAnnotation = annotations[cardIndex];
  const openId = card?.open ? card.id : undefined;
  const emphasized = openId ?? hovered;
  const tracking = annotations.length > 0;

  // Written straight to the bubbles: layout is read after commit, and nothing renders from it.
  const place = useEffectEvent(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const origin = layer.getBoundingClientRect();
    const passages = annotations.flatMap(annotation => {
      const marker = markersRef.current.get(annotation.id);
      if (!marker) return [];
      const range = rangeFromSource(annotation.source);
      return [{ id: annotation.id, marker, range, end: range && passageEndRect(range) }];
    });
    const shown = passages.flatMap(({ id, marker, range, end }) => (range && end ? [{ id, marker, range, end }] : []));
    for (const { marker, end } of passages) marker.hidden = !end;
    const bubbles = shown.map(({ marker, end }) => ({
      marker,
      // The bubble's tail (its square corner) sits just inside the top of the passage's last letter.
      left: end.right - origin.left - 1,
      top: end.top - origin.top + 7,
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

  const close = () => setCard(current => current && { ...current, open: false });

  return (
    <div
      ref={layerRef}
      data-slot="annotation-markers"
      // Above the transcript's own positioned parts, below the docked composer.
      className="pointer-events-none absolute inset-0 z-1"
    >
      {annotations.map((annotation, index) => (
        <AnnotationMarker
          key={annotation.id}
          ref={marker => {
            if (!marker) return;
            markersRef.current.set(annotation.id, marker);
            return () => {
              markersRef.current.delete(annotation.id);
            };
          }}
          annotation={annotation}
          number={index + 1}
          active={annotation.id === emphasized}
          expanded={annotation.id === openId}
          onHoverStart={() => setHovered(annotation.id)}
          onHoverEnd={() => setHovered(current => (current === annotation.id ? undefined : current))}
          onToggle={anchor =>
            setCard(current =>
              current?.open && current.id === annotation.id
                ? { ...current, open: false }
                : { id: annotation.id, anchor, open: true },
            )
          }
        />
      ))}
      {card && cardAnnotation && (
        <Popover
          open={card.open}
          onOpenChange={(next, { reason, event }) => {
            const target = event instanceof FocusEvent ? event.relatedTarget : event.target;
            // The bubble's own click toggles the card, so pressing or focusing it must not close the card first.
            const towardBubble =
              (reason === 'outside-press' || reason === 'focus-out') &&
              target instanceof Node &&
              card.anchor.contains(target);
            if (!next && !towardBubble) close();
          }}
        >
          <PopoverContent
            anchor={card.anchor}
            side="top"
            align="start"
            sideOffset={8}
            initialFocus={commentRef}
            aria-label={`Annotation ${cardIndex + 1}`}
            className="w-80 max-w-[calc(100vw-2rem)] p-3"
          >
            <AnnotationCommentCard
              annotation={cardAnnotation}
              number={cardIndex + 1}
              commentRef={commentRef}
              onCommentChange={comment => onCommentChange(cardAnnotation.id, comment)}
              onRemove={() => {
                close();
                onRemove(cardAnnotation.id);
              }}
              onDone={close}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
