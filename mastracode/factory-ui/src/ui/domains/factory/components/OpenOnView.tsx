import { useInView } from '@mastra/playground-ui/hooks/use-in-view';
import type { ReactNode } from 'react';
import { useEffect, useEffectEvent } from 'react';

/**
 * Stands in for a column's cards until the column is first on screen, then asks for them. A collapsed
 * group or a column scrolled off to the side never comes into view, so it never reads.
 */
export function OpenOnView({ onOpen, children }: { onOpen: () => void; children?: ReactNode }) {
  const { inView, setRef } = useInView();
  const open = useEffectEvent(onOpen);

  useEffect(() => {
    if (inView) open();
  }, [inView]);

  return (
    <div ref={setRef} className="min-h-px">
      {children}
    </div>
  );
}
