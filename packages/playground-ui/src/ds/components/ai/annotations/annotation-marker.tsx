import type { Ref } from 'react';

import { annotationBubbleStyle } from './annotation-number';
import { focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface AnnotationMarkerProps {
  ref: Ref<HTMLButtonElement>;
  commented: boolean;
  number: number;
  active: boolean;
  expanded: boolean;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onToggle: (anchor: HTMLElement) => void;
}

/** Starts hidden: `AnnotationMarkers` shows it once the passage is laid out. */
export function AnnotationMarker({
  ref,
  commented,
  number,
  active,
  expanded,
  onHoverStart,
  onHoverEnd,
  onToggle,
}: AnnotationMarkerProps) {
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
