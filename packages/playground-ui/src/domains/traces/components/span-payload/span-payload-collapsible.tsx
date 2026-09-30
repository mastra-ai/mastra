import { Maximize2, Minimize2 } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/ds/components/Button';
import { cn } from '@/lib/utils';

const COLLAPSED_HEIGHT = 220;

/** Same pattern as the submit_plan card: wraps a whole payload box, clips by measured height, fades the bottom, and offers expand. */
export function SpanPayloadCollapsible({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isClipped, setIsClipped] = useState(false);

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) return;

    const measure = () => setIsClipped(element.scrollHeight > COLLAPSED_HEIGHT);
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div
        className={cn(!isExpanded && 'overflow-hidden', !isExpanded && isClipped && 'mask-b-from-60% mask-b-to-100%')}
        style={isExpanded ? undefined : { maxHeight: COLLAPSED_HEIGHT }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
      {(isClipped || isExpanded) && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-start"
          icon={isExpanded ? <Minimize2 /> : <Maximize2 />}
          onClick={() => setIsExpanded(expanded => !expanded)}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      )}
    </div>
  );
}
