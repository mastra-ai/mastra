import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import type { ReactNode } from 'react';
import { useEffect, useEffectEvent, useState } from 'react';

import { BoardDetailsDockContext } from '../context/BoardDetailsDockContext';
import { useBoardOpenCard } from '../context/useBoardOpenCard';

const MIN_VIEWPORT_PX_FOR_DOCKED_DETAILS = 1280;

export function BoardDetailsDock({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const tooNarrow = useIsMobile(MIN_VIEWPORT_PX_FOR_DOCKED_DETAILS);
  const docked = enabled && !tooNarrow;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const { openKey, setCardOpen } = useBoardOpenCard();

  const closeOpenCardOnEscape = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented && openKey !== undefined) setCardOpen(openKey, false);
  });
  useEffect(() => {
    if (!docked) return;
    const onKeyDown = (event: KeyboardEvent) => closeOpenCardOnEscape(event);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [docked]);

  return (
    <div className="flex min-h-0 flex-1">
      <BoardDetailsDockContext value={docked ? { element } : null}>{children}</BoardDetailsDockContext>
      {docked && (
        <div
          ref={setElement}
          className="border-border my-px mr-px flex w-md shrink-0 flex-col overflow-hidden rounded-r-[calc(var(--studio-frame-radius,1.5rem)-1px)] border-l empty:hidden"
        />
      )}
    </div>
  );
}
