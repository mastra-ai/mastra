import { Button } from '@mastra/playground-ui/components/Button';
import { Drawer, DrawerContent } from '@mastra/playground-ui/components/Drawer';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useMeasuredAutoHeight } from '@mastra/playground-ui/hooks/use-measured-auto-height';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { cardMorphStyle } from '../hooks/useCardMorph';
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
  const isMobile = useIsMobile();

  if (!morph.mounted) return null;

  // No room to grow a card into a panel on a phone: the details come up as a sheet instead.
  if (isMobile) {
    return (
      <Drawer open={morph.open} onOpenChange={open => !open && morph.closeDetails()}>
        <DrawerContent aria-labelledby={labelledBy} showCloseButton={false} className="max-h-[85dvh]">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  const fromSize = cardMorphStyle(morph.cardRef.current);

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
        style={content.height === null ? fromSize : { ...fromSize, '--board-panel-h': `${content.height}px` }}
        // A clipped box scrolls to whatever is focused, and the first tabbable sits at the far corner.
        initialFocus={morph.panelRef}
        ref={morph.panelRef}
        className="board-card-details relative overflow-hidden p-0"
      >
        {/* Laid out at the panel's final width and clipped by the growing box,
            so the header rows hold still instead of reflowing frame by frame.
            Capped at the panel's own viewport budget: past it the column
            scrolls, keeping the composer and footer actions reachable. */}
        <div
          ref={content.ref}
          className="absolute top-0 left-0 flex max-h-[calc(100dvh-2rem)] w-[var(--board-panel-w)] flex-col overflow-y-auto"
        >
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const CLAMP_HEIGHT_PX = 128;
// Only clamp when at least ~2 lines are hidden: clipping a near-fit trades 20px for a click.
const CLAMP_TRIGGER_PX = 176;

// Caps its own height rather than filling the panel, so a description-less card still opens short.
// Long content clamps to a glance-sized excerpt behind "Show more".
export function CardDetailsBody({
  children,
  maxHeight = 'min(24rem, 60vh)',
}: {
  children: ReactNode;
  maxHeight?: string;
}) {
  const content = useMeasuredAutoHeight<HTMLDivElement>();
  const [expanded, setExpanded] = useState(false);
  const clamped = !expanded && content.height !== null && content.height > CLAMP_TRIGGER_PX;

  return (
    <div className="flex flex-col" data-card-morph="reveal">
      {expanded ? (
        <ScrollArea maxHeight={maxHeight} orientation="vertical">
          <div className="px-3 pb-3">{children}</div>
        </ScrollArea>
      ) : (
        <div className="relative overflow-hidden" style={clamped ? { maxHeight: CLAMP_HEIGHT_PX } : undefined}>
          <div ref={content.ref} className="px-3 pb-3">
            {children}
          </div>
          {clamped && (
            <div aria-hidden className="from-surface3 absolute inset-x-0 bottom-0 h-10 bg-linear-to-t to-transparent" />
          )}
        </div>
      )}
      {(clamped || expanded) && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="mx-2 mb-1.5 self-start"
          onClick={() => setExpanded(current => !current)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Button>
      )}
    </div>
  );
}
