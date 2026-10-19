import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { BoardDetailsDockContext } from '../context/BoardDetailsDockContext';

const MIN_VIEWPORT_PX_FOR_DOCKED_DETAILS = 1280;

function createDockHolder() {
  let closeHeldPanel: (() => void) | undefined;
  return {
    claim: (close: () => void) => {
      closeHeldPanel?.();
      closeHeldPanel = close;
      return () => {
        if (closeHeldPanel === close) closeHeldPanel = undefined;
      };
    },
    closeHeldPanel: () => closeHeldPanel?.(),
  };
}

export function BoardDetailsDock({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const tooNarrow = useIsMobile(MIN_VIEWPORT_PX_FOR_DOCKED_DETAILS);
  const docked = enabled && !tooNarrow;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [holder] = useState(createDockHolder);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) holder.closeHeldPanel();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [holder]);

  const dock = docked ? { element, claim: holder.claim } : null;

  return (
    <div className="flex min-h-0 flex-1">
      <BoardDetailsDockContext value={dock}>{children}</BoardDetailsDockContext>
      {docked && (
        <div
          ref={setElement}
          className="border-border my-px mr-px flex w-md shrink-0 flex-col overflow-hidden rounded-r-[calc(var(--studio-frame-radius,1.5rem)-1px)] border-l empty:hidden"
        />
      )}
    </div>
  );
}
