import type { ReactNode } from 'react';

/** Retain the details until their exit finishes; the canvas never changes size. */
export function KnowledgeDetailsSurface({
  closing,
  onExited,
  children,
}: {
  closing: boolean;
  onExited: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      data-testid="knowledge-flyout"
      data-state={closing ? 'closing' : 'open'}
      className="knowledge-details bg-card shadow-overlay absolute top-4 right-4 bottom-16 z-20 flex w-95 max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-xl max-md:top-auto max-md:h-[45%]"
      aria-label="Knowledge node details"
      aria-hidden={closing || undefined}
      inert={closing}
      onTransitionEnd={event => {
        if (closing && event.target === event.currentTarget && event.propertyName === 'transform') onExited();
      }}
    >
      {children}
    </aside>
  );
}
