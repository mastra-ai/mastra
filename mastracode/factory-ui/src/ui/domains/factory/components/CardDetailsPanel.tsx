import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import type { ReactNode } from 'react';
import { useLayoutEffect, useRef, useState } from 'react';

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
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>();

  // The panel is as tall as what it holds: a card whose source has no
  // description would otherwise open onto an empty half-screen box. The
  // content lays out unconstrained and the box follows it, so a description
  // arriving after the fetch grows the panel instead of being scrolled into a
  // height decided before it existed.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (content === null) return;
    setContentHeight(content.getBoundingClientRect().height);
    const observer = new ResizeObserver(([entry]) => setContentHeight(entry.contentRect.height));
    observer.observe(content);
    return () => observer.disconnect();
  }, [morph.open]);

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
        style={contentHeight === undefined ? morph.style : { ...morph.style, '--board-panel-h': `${contentHeight}px` }}
        // Focus the panel itself: a clipped box scrolls to reveal whatever is
        // focused, and the first tabbable sits at the far corner.
        initialFocus={morph.panelRef}
        ref={morph.panelRef}
        className="board-card-details relative overflow-hidden p-0"
      >
        {/* Laid out at the panel's final width and clipped by the growing box,
            so the header rows hold still instead of reflowing frame by frame. */}
        <div ref={contentRef} className="absolute top-0 left-0 flex w-[var(--board-panel-w)] flex-col">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * The panel's one scrolling region — everything the card never carried. It
 * caps its own height rather than filling the panel, so the panel can be as
 * short as a card whose source has no description at all.
 */
export function CardDetailsBody({ children }: { children: ReactNode }) {
  return (
    <ScrollArea maxHeight="min(24rem, 60vh)" orientation="vertical" data-card-morph="reveal">
      <div className="px-3 pb-3">{children}</div>
    </ScrollArea>
  );
}
