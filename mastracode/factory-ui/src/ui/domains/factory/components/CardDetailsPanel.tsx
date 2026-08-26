import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { useMeasuredAutoHeight } from '@mastra/playground-ui/hooks/use-measured-auto-height';
import type { ReactNode } from 'react';

import type { CardMorph } from '../hooks/useCardMorph';
import './cardMorph.css';

// Both card kinds open this one panel, so the geometry and the motion are decided once.
export function CardDetailsPanel({
  morph,
  labelledBy,
  children,
}: {
  morph: CardMorph;
  labelledBy: string;
  children: ReactNode;
}) {
  // The content lays out unconstrained and the box follows, so a description arriving late grows the panel.
  const content = useMeasuredAutoHeight<HTMLDivElement>();

  if (!morph.mounted) return null;

  return (
    <Popover open={morph.open} onOpenChange={open => !open && morph.closeDetails()}>
      <PopoverContent
        aria-labelledby={labelledBy}
        anchor={morph.cardRef}
        side="bottom"
        align="start"
        // Opens over the card it came from, not beside it.
        sideOffset={({ anchor }) => -anchor.height}
        collisionPadding={12}
        collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
        // Bounded by the page, not by the column that clips at ~20rem.
        collisionBoundary={document.body}
        style={content.height === null ? morph.style : { ...morph.style, '--board-panel-h': `${content.height}px` }}
        // A clipped box scrolls to whatever is focused, and the first tabbable sits at the far corner.
        initialFocus={morph.panelRef}
        ref={morph.panelRef}
        className="board-card-details relative overflow-hidden p-0"
      >
        {/* Laid out at the panel's final width and clipped by the growing box,
            so the header rows hold still instead of reflowing frame by frame. */}
        <div ref={content.ref} className="absolute top-0 left-0 flex w-[var(--board-panel-w)] flex-col">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Caps its own height rather than filling the panel, so a description-less card still opens short.
export function CardDetailsBody({ children }: { children: ReactNode }) {
  return (
    <ScrollArea maxHeight="min(24rem, 60vh)" orientation="vertical" data-card-morph="reveal">
      <div className="px-3 pb-3">{children}</div>
    </ScrollArea>
  );
}
