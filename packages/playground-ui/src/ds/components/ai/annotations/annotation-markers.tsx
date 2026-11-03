import { useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import type { Ref, RefObject } from 'react';

import { passageEndRect, rangeFromSource } from './annotatable-selection';
import { AnnotationCommentCard } from './annotation-comment-card';
import { annotationBubbleStyle } from './annotation-number';
import type { ChatAnnotation } from './chat-annotations';
import { Popover, PopoverContent } from '@/ds/components/Popover';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

import './annotation-markers.css';

/** Named in `annotation-markers.css`. */
const HIGHLIGHT = 'chat-annotation';
const ACTIVE_HIGHLIGHT = 'chat-annotation-active';

const paintedByTranscript = new Map<string, { ranges: Range[]; active: Range | undefined }>();

function paintHighlights(transcript: string, ranges: Range[], active: Range | undefined) {
  if (typeof CSS === 'undefined' || !('highlights' in CSS)) return;
  if (ranges.length === 0) paintedByTranscript.delete(transcript);
  else paintedByTranscript.set(transcript, { ranges, active });
  const painted = Array.from(paintedByTranscript.values());
  const allRanges = painted.flatMap(entry => entry.ranges);
  const activeRanges = painted.flatMap(entry => (entry.active ? [entry.active] : []));
  if (allRanges.length === 0) CSS.highlights.delete(HIGHLIGHT);
  else CSS.highlights.set(HIGHLIGHT, new Highlight(...allRanges));
  if (activeRanges.length === 0) {
    CSS.highlights.delete(ACTIVE_HIGHLIGHT);
    return;
  }
  const emphasis = new Highlight(...activeRanges);
  emphasis.priority = 1;
  CSS.highlights.set(ACTIVE_HIGHLIGHT, emphasis);
}

export interface AnnotationMarkersProps {
  containerRef: RefObject<Element | null>;
  annotations: readonly ChatAnnotation[];
  onCommentChange: (id: string, comment: string) => void;
  onRemove: (id: string) => void;
}

export function AnnotationMarkers({ containerRef, annotations, onCommentChange, onRemove }: AnnotationMarkersProps) {
  const transcript = useId();
  const layerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef(new Map<string, HTMLButtonElement>());
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const [hovered, setHovered] = useState<string>();
  const [open, setOpen] = useState<{ id: string; anchor: HTMLElement }>();
  const openIndex = open ? annotations.findIndex(annotation => annotation.id === open.id) : -1;
  const openAnnotation = annotations[openIndex];
  const emphasized = openAnnotation?.id ?? hovered;
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
    paintHighlights(transcript, ranges, active);
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
    return () => {
      cancelAnimationFrame(frame);
      resizes.disconnect();
      mutations.disconnect();
      paintHighlights(transcript, [], undefined);
    };
  }, [tracking, containerRef, transcript]);

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
          expanded={openAnnotation?.id === annotation.id}
          onHoverStart={() => setHovered(annotation.id)}
          onHoverEnd={() => setHovered(current => (current === annotation.id ? undefined : current))}
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
  ref: Ref<HTMLButtonElement>;
  annotation: ChatAnnotation;
  number: number;
  active: boolean;
  expanded: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onToggle: (anchor: HTMLElement) => void;
}

/** Starts hidden: `AnnotationMarkers` shows it once the passage is laid out. */
function AnnotationMarker({
  ref,
  annotation,
  number,
  active,
  expanded,
  onHoverStart,
  onHoverEnd,
  onToggle,
}: AnnotationMarkerProps) {
  const commented = Boolean(annotation.comment?.trim());
  return (
    <button
      ref={ref}
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
        'translate-x-[min(0px,calc(var(--room-right)_-_100%))]',
        'motion-safe:transition-[scale,background-color] motion-safe:duration-fast motion-safe:ease-out-custom',
        'hover:scale-115 hover:bg-info-bright data-[active]:scale-115 data-[active]:bg-info-bright',
        focusRing,
      )}
      onPointerEnter={onHoverStart}
      onPointerLeave={onHoverEnd}
      // Keyboard focus only: focus returns here when the card closes, which must not look hovered.
      onFocus={event => {
        if (event.currentTarget.matches(':focus-visible')) onHoverStart();
      }}
      onBlur={onHoverEnd}
      onClick={event => onToggle(event.currentTarget)}
    >
      {number}
      {commented && <span aria-hidden="true" className="size-1 rounded-full bg-current" />}
    </button>
  );
}
