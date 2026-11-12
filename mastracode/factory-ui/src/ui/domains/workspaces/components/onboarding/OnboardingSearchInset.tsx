import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';
import type { ReactNode } from 'react';

/**
 * An inset with its search fixed above a scrolling list, like the chat model picker's. Only the list
 * scrolls, inside the inset's clipped corners, so rows never pass behind the search or out of the
 * rounded shape. Once the list scrolls, a fade under the search shows that rows continue above.
 */
export function OnboardingSearchInset({ search, children }: { search: ReactNode; children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  return (
    <div className="bg-background flex min-w-0 flex-col overflow-hidden rounded-xl">
      <div
        data-scrolled={scrolled || undefined}
        className={cn(
          'relative z-10 p-1',
          'after:from-background after:duration-fast after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-3 after:bg-linear-to-b after:to-transparent after:opacity-0 after:transition-opacity',
          'data-scrolled:after:opacity-100',
        )}
      >
        {search}
      </div>
      <div
        className="max-h-60 overflow-y-auto overscroll-contain sm:max-h-68"
        onScroll={event => setScrolled(event.currentTarget.scrollTop > 0)}
      >
        <div className="flex flex-col gap-0.5 px-1 pb-1">{children}</div>
      </div>
    </div>
  );
}
