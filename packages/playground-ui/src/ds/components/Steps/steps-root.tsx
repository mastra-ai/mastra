import type { ReactNode } from 'react';
import { StepsHeadingContext } from './steps-context';
import type { StepsHeadingLevel } from './steps-context';
import { cn } from '@/lib/utils';

export type StepsProps = {
  /**
   * Heading level for every step title. Pick the one that continues the page's outline: a page
   * whose last heading is the `h1` title wants 2.
   */
  headingLevel?: StepsHeadingLevel;
  className?: string;
  children: ReactNode;
};

/**
 * A numbered vertical rail for setup guides, like the steps in docs: a marker per step, a line to
 * the next one, and the step's content to the right without a card around it. Steps number
 * themselves in render order, so a caller can render them conditionally or compose them from
 * several components without breaking the sequence.
 */
export function StepsRoot({ headingLevel = 3, className, children }: StepsProps) {
  return (
    <StepsHeadingContext.Provider value={headingLevel}>
      <ol className={cn('flex flex-col [counter-reset:ds-step]', className)}>{children}</ol>
    </StepsHeadingContext.Provider>
  );
}
