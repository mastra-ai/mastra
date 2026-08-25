import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import type { ReactNode } from 'react';

import type { CardMorph } from '../hooks/useCardMorph';
import './cardMorph.css';

/**
 * The surface a board card expands into: one popover pinned over the card's own
 * box, growing from it and folding back into it. Both card kinds open the same
 * panel, so the geometry and the motion are decided once, here.
 */
export function CardDetailsPanel({
  morph,
  labelledBy,
  children,
}: {
  morph: CardMorph;
  labelledBy: string;
  children: ReactNode;
}) {
  if (!morph.mounted) return null;

  return (
    <Popover open={morph.open} onOpenChange={open => !open && morph.closeDetails()}>
      <PopoverContent
        aria-labelledby={labelledBy}
        anchor={morph.cardRef}
        side="bottom"
        align="start"
        // Zero distance from the card's own top edge: the panel opens over the
        // card it came from instead of beside it.
        sideOffset={({ anchor }) => -anchor.height}
        collisionPadding={12}
        collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
        // The card sits in a column that clips at ~20rem; bounding the panel by
        // its column would squeeze it. It answers to the page instead.
        collisionBoundary={document.body}
        style={morph.style}
        // Focus the panel itself: a clipped box scrolls to reveal whatever is
        // focused, and the first tabbable sits at the far corner.
        initialFocus={morph.panelRef}
        ref={morph.panelRef}
        className="board-card-details relative overflow-hidden p-0"
      >
        {/* Laid out at the panel's final size and clipped by the growing box, so
            the header rows hold still instead of reflowing frame by frame. */}
        <div className="absolute top-0 left-0 flex h-[var(--board-panel-h)] w-[var(--board-panel-w)] flex-col">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
