import { Drawer, DrawerContent } from '@mastra/playground-ui/components/Drawer';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { cardMorphStyle } from '../hooks/useCardMorph';
import type { CardMorph } from '../hooks/useCardMorph';
import './cardMorph.css';

// Both card kinds open this one panel: the card's own rows in a box over the
// card, and a tray beneath them for what the card never carried.
export function CardDetailsPanel({
  morph,
  labelledBy,
  header,
  children,
}: {
  morph: CardMorph;
  labelledBy: string;
  /** The card's rows, laid out exactly as the card lays them out. */
  header: ReactNode;
  /** The tray. */
  children: ReactNode;
}) {
  const isMobile = useIsMobile();

  // No room to grow a card into a panel on a phone: the details come up as a sheet instead.
  // Its root sits in the tree closed, so the first open has a closed frame to transition from.
  if (isMobile) {
    return (
      <Drawer open={morph.open} onOpenChange={open => !open && morph.closeDetails()}>
        <DrawerContent aria-labelledby={labelledBy} showCloseButton={false}>
          <div className="flex max-h-[85dvh] flex-col pb-[env(safe-area-inset-bottom)]">
            <div className="relative flex shrink-0 flex-col gap-3 p-3">{header}</div>
            <div className="border-border1 flex min-h-0 flex-col border-t">{children}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  if (!morph.mounted) return null;

  return (
    <>
      {/* Dims the board under the open panel and swallows the click that lands on
          it: closing must never press whatever sat underneath. */}
      {createPortal(
        <div
          aria-hidden
          onPointerDown={() => morph.closeDetails()}
          className={cn(
            'bg-surface1/60 fixed inset-0 z-40 transition-opacity duration-200',
            morph.open ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        />,
        document.body,
      )}
      <Popover open={morph.open} onOpenChange={open => !open && morph.closeDetails()}>
        <PopoverContent
          aria-labelledby={labelledBy}
          anchor={morph.cardRef}
          side="bottom"
          align="start"
          // Opens over the card it came from, not beside it.
          sideOffset={({ anchor }) => -anchor.height}
          collisionPadding={12}
          // No room below: the stage flips above the card, still over it, and the
          // tray rides on top. Never shifted, the rows would move with it.
          collisionAvoidance={{ side: 'flip', align: 'none', fallbackAxisSide: 'none' }}
          // Bounded by the page, not by the column that clips at ~20rem.
          collisionBoundary={document.body}
          style={cardMorphStyle(morph.cardRef.current)}
          // A clipped box scrolls to whatever is focused, and the first tabbable sits at the far corner.
          initialFocus={morph.panelRef}
          ref={morph.panelRef}
          className="board-card-details flex flex-col p-0"
        >
          <div className="board-card-copy group border-border1 bg-surface3 shadow-dialog relative z-10 flex min-h-36 shrink-0 flex-col gap-3 rounded-3xl border p-2.5">
            {header}
          </div>
          <div className="board-card-tray border-border1 bg-surface3 shadow-dialog relative flex flex-col overflow-hidden rounded-xl border">
            {children}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
