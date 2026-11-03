import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { passageEndRect, rangeFromSource } from './annotatable-selection';
import { AnnotationCommentCard } from './annotation-comment-card';
import { annotationBubbleStyle } from './annotation-number';
import type { ChatAnnotation } from './chat-annotations';
import { Popover, PopoverContent } from '@/ds/components/Popover';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

import './annotation-markers.css';

/** Named in `annotation-markers.css`. One transcript per page, so one registry entry each is enough. */
const HIGHLIGHT = 'chat-annotation';
const ACTIVE_HIGHLIGHT = 'chat-annotation-active';

function paintHighlights(ranges: Range[], active: Range | undefined) {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  if (ranges.length === 0) CSS.highlights.delete(HIGHLIGHT);
  else CSS.highlights.set(HIGHLIGHT, new Highlight(...ranges));
  if (!active) {
    CSS.highlights.delete(ACTIVE_HIGHLIGHT);
    return;
  }
  const emphasis = new Highlight(active);
  emphasis.priority = 1;
  CSS.highlights.set(ACTIVE_HIGHLIGHT, emphasis);
}

export interface AnnotationMarkersProps {
  annotations: readonly ChatAnnotation[];
  onCommentChange: (id: string, comment: string) => void;
  onRemove: (id: string) => void;
}

/**
 * Marks each waiting annotation with a numbered comment bubble at the end of its passage, and
 * tints the passage. Hovering a bubble deepens its passage's tint; clicking it opens a card to
 * comment on the passage or remove it. Render it inside the scrolling transcript, below a
 * positioned ancestor that scrolls with it: the bubbles are placed in that content's coordinates,
 * so they move with the text without listening to scroll.
 */
export function AnnotationMarkers({ annotations, onCommentChange, onRemove }: AnnotationMarkersProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [hovered, setHovered] = useState<string>();
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement }>();
  const openIndex = open ? annotations.findIndex(annotation => annotation.id === open.id) : -1;
  const openAnnotation = annotations[openIndex];
  const emphasized = openAnnotation?.id ?? hovered;

  // Written straight to the marks: layout is read after commit, and nothing else renders from it.
  const place = useEffectEvent(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const origin = layer.getBoundingClientRect();
    const ranges: Range[] = [];
    let active: Range | undefined;
    layer.querySelectorAll<HTMLElement>('[data-slot="annotation-marker"]').forEach((marker, index) => {
      const annotation = annotations[index];
      const range = annotation?.source && rangeFromSource(annotation.source);
      const end = range && passageEndRect(range);
      marker.hidden = !end;
      if (!annotation || !range || !end) return;
      ranges.push(range);
      if (annotation.id === emphasized) active = range;
      // The bubble's tail (its square corner) sits just inside the top of the passage's last letter,
      // low enough to leave the line above mostly clear.
      marker.style.left = `${end.right - origin.left - 1}px`;
      marker.style.top = `${end.top - origin.top + 7}px`;
    });
    paintHighlights(ranges, active);
  });

  // After every commit: the transcript renders with this layer, so a message that changed or left
  // the page is placed again without waiting for a resize.
  useEffect(() => {
    place();
  });

  // Text above a annotation growing, older messages loading, or the column reflowing all resize the
  // content the marks are placed in.
  useEffect(() => {
    const layer = layerRef.current;
    const space = layer?.offsetParent ?? layer?.parentElement;
    const resize = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(() => place());
    if (space) resize?.observe(space);
    return () => {
      resize?.disconnect();
      paintHighlights([], undefined);
    };
  }, []);

  const close = () => setOpen(undefined);

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
          annotation={annotation}
          number={index + 1}
          active={annotation.id === emphasized}
          expanded={openAnnotation?.id === annotation.id}
          onHoverChange={hovering =>
            setHovered(current => (hovering ? annotation.id : current === annotation.id ? undefined : current))
          }
          onToggle={anchor =>
            setOpen(current => (current?.id === annotation.id ? undefined : { id: annotation.id, anchor }))
          }
        />
      ))}
      <Popover
        open={openAnnotation !== undefined}
        onOpenChange={next => {
          if (!next) close();
        }}
      >
        <PopoverContent
          anchor={open?.anchor}
          side="top"
          align="start"
          sideOffset={8}
          initialFocus={commentRef}
          aria-label={openAnnotation ? `Annotation ${openIndex + 1}` : undefined}
          className="w-80 max-w-[calc(100vw-2rem)] p-3"
        >
          {openAnnotation && (
            <AnnotationCommentCard
              annotation={openAnnotation}
              number={openIndex + 1}
              commentRef={commentRef}
              onCommentChange={comment => onCommentChange(openAnnotation.id, comment)}
              onRemove={() => {
                close();
                onRemove(openAnnotation.id);
              }}
              onDone={close}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

interface AnnotationMarkerProps {
  annotation: ChatAnnotation;
  number: number;
  /** Hovered, focused or open: the bubble lifts and its passage's tint deepens. */
  active: boolean;
  expanded: boolean;
  onHoverChange: (hovering: boolean) => void;
  onToggle: (anchor: HTMLElement) => void;
}

/** One annotation's bubble. Placed by `AnnotationMarkers` after layout, so it starts hidden. */
function AnnotationMarker({ annotation, number, active, expanded, onHoverChange, onToggle }: AnnotationMarkerProps) {
  const commented = Boolean(annotation.comment?.trim());
  return (
    <button
      type="button"
      data-slot="annotation-marker"
      data-active={active || undefined}
      data-commented={commented || undefined}
      hidden
      aria-label={commented ? `Annotation ${number}, with a comment` : `Annotation ${number}`}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      className={cn(
        annotationBubbleStyle,
        'pointer-events-auto absolute origin-bottom-left -translate-y-full cursor-pointer shadow-raised',
        'motion-safe:transition-[scale,background-color] motion-safe:duration-fast motion-safe:ease-out-custom',
        'hover:scale-115 hover:bg-info-bright data-[active]:scale-115 data-[active]:bg-info-bright',
        focusRing,
      )}
      onPointerEnter={() => onHoverChange(true)}
      onPointerLeave={() => onHoverChange(false)}
      // Keyboard focus only: a click also focuses the bubble, and focus returns to it when its card
      // closes, which must not leave the passage looking hovered.
      onFocus={event => {
        if (event.currentTarget.matches(':focus-visible')) onHoverChange(true);
      }}
      onBlur={() => onHoverChange(false)}
      onClick={event => onToggle(event.currentTarget)}
    >
      {number}
      {commented && <span aria-hidden="true" className="size-1 rounded-full bg-current" />}
    </button>
  );
}
