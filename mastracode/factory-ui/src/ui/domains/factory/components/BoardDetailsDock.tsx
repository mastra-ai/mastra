import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useKeydown } from '@mastra/playground-ui/keyboard/use-keydown';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { BoardDetailsDockContext } from '../context/BoardDetailsDockContext';
import { useBoardOpenCard } from '../context/useBoardOpenCard';

const MIN_VIEWPORT_PX_FOR_DOCKED_DETAILS = 1280;

export function BoardDetailsDock({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const tooNarrow = useIsMobile(MIN_VIEWPORT_PX_FOR_DOCKED_DETAILS);
  const docked = enabled && !tooNarrow;
  const [element, setElement] = useState<HTMLElement | null>(null);
  const { openKey, setCardOpen } = useBoardOpenCard();

  const closeOpenCard = openKey === undefined ? undefined : () => setCardOpen(openKey, false);
  useKeydown(
    { Escape: () => closeOpenCard?.() },
    { enabled: docked && closeOpenCard !== undefined, insideFields: true },
  );

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
