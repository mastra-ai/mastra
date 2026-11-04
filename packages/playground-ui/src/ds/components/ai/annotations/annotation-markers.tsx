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
    const ranges: Range[] = [];
    let active: Range | undefined;
    for (const annotation of annotations) {
      const marker = markersRef.current.get(annotation.id);
      if (!marker) continue;
      const range = rangeFromSource(annotation.source);
      const end = range && passageEndRect(range);
      marker.hidden = !end;
      if (!range || !end) continue;
      ranges.push(range);
      if (annotation.id === emphasized) active = range;
      // The bubble's tail (its square corner) sits just inside the top of the passage's last letter.
      const left = end.right - origin.left - 1;
      marker.style.left = `${left}px`;
      marker.style.top = `${end.top - origin.top + 7}px`;
      marker.style.setProperty('--room-right', `${origin.width - left}px`);
    }
    paintHighlights(transcriptId, ranges, active);
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
