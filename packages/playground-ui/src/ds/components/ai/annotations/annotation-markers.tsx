import { useState } from 'react';
import type { RefObject } from 'react';

import { AnnotationCommentPopover } from './annotation-comment-popover';
import type { CommentCard } from './annotation-comment-popover';
import { AnnotationMarker } from './annotation-marker';
import { visibleComment } from './chat-annotations';
import type { ChatAnnotation } from './chat-annotations';
import { useAnnotationPlacement } from './use-annotation-placement';

export interface AnnotationMarkersProps {
  containerRef: RefObject<Element | null>;
  annotations: readonly ChatAnnotation[];
  onCommentChange: (id: string, comment: string) => void;
  onRemove: (id: string) => void;
}

export function AnnotationMarkers({ containerRef, annotations, onCommentChange, onRemove }: AnnotationMarkersProps) {
  const [hovered, setHovered] = useState<string>();
  const [card, setCard] = useState<CommentCard>();
  const cardIndex = card ? annotations.findIndex(annotation => annotation.id === card.id) : -1;
  const cardAnnotation = annotations[cardIndex];
  const openId = card?.open ? card.id : undefined;
  const emphasized = openId ?? hovered;
  const { layerRef, markerRef } = useAnnotationPlacement({ containerRef, annotations, emphasized });

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
          ref={markerRef(annotation.id)}
          number={index + 1}
          commented={Boolean(visibleComment(annotation))}
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
        <AnnotationCommentPopover
          card={card}
          annotation={cardAnnotation}
          number={cardIndex + 1}
          onCommentChange={comment => onCommentChange(cardAnnotation.id, comment)}
          onRemove={() => {
            close();
            onRemove(cardAnnotation.id);
          }}
          onClose={close}
        />
      )}
    </div>
  );
}
