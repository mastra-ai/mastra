import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import type { TxtProps } from '@/ds/components/Txt';
import { Txt } from '@/ds/components/Txt';
import { ChevronIcon } from '@/ds/icons/ChevronIcon';
import { cn } from '@/lib/utils';

// Tailwind needs static class names — map instead of interpolating.
const clampClasses = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
} as const;

export type ClampedTextLines = keyof typeof clampClasses;

export interface ClampedTextProps extends Omit<TxtProps, 'children' | 'ref'> {
  children: string;
  /** Number of lines to clamp to (default: 2) */
  lines?: ClampedTextLines;
  readMoreLabel?: string;
  showLessLabel?: string;
}

/**
 * Text clamped to a number of lines with a "read more" toggle. The toggle only
 * appears when the clamp actually cuts content: the rendered element is measured
 * (`scrollHeight > clientHeight`), so the detection follows layout — element
 * width, font loading — rather than any character count.
 */
export function ClampedText({
  children,
  lines = 2,
  readMoreLabel = 'Read more',
  showLessLabel = 'Show less',
  className,
  ...txtProps
}: ClampedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);

  return (
    <>
      <Txt
        {...txtProps}
        className={cn(!isExpanded && clampClasses[lines], className)}
        ref={el => {
          if (!el || isExpanded) return;
          const measure = () => setIsClamped(el.scrollHeight > el.clientHeight);
          if (typeof ResizeObserver === 'undefined') {
            measure();
            return;
          }
          // Clamping depends on rendered layout — re-measure when the element
          // resizes (fires once on observe) and once fonts finish loading.
          const observer = new ResizeObserver(measure);
          observer.observe(el);
          document.fonts?.ready.then(measure).catch(() => {});
          return () => observer.disconnect();
        }}
      >
        {children}
      </Txt>
      {(isClamped || isExpanded) && (
        <Button
          variant="ghost"
          size="xs"
          className="mt-1 -ml-[.8em] self-start justify-self-start"
          onClick={() => setIsExpanded(v => !v)}
        >
          {isExpanded ? showLessLabel : readMoreLabel}
          <ChevronIcon className={cn('transition-transform', isExpanded && 'rotate-180')} />
        </Button>
      )}
    </>
  );
}
