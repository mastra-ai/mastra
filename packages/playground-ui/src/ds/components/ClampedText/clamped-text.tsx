import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import type { TxtProps } from '@/ds/components/Txt';
import { Txt } from '@/ds/components/Txt';
import { ChevronIcon } from '@/ds/icons/ChevronIcon';
import { useIsClamped } from '@/hooks/use-is-clamped';
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

/** Text clamped to a number of lines, with a "read more" toggle shown only when the clamp actually cuts content. */
export function ClampedText({
  children,
  lines = 2,
  readMoreLabel = 'Read more',
  showLessLabel = 'Show less',
  className,
  ...txtProps
}: ClampedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { ref, isClamped } = useIsClamped({ enabled: !isExpanded });

  return (
    <>
      <Txt {...txtProps} className={cn(!isExpanded && clampClasses[lines], className)} ref={ref}>
        {children}
      </Txt>
      {(isClamped || isExpanded) && (
        <Button
          variant="ghost"
          size="xs"
          className="mt-1 -ml-[.8em] self-start justify-self-start"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded(v => !v)}
        >
          {isExpanded ? showLessLabel : readMoreLabel}
          <ChevronIcon className={cn('transition-transform', isExpanded && 'rotate-180')} />
        </Button>
      )}
    </>
  );
}
