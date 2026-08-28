import { Button } from '@mastra/playground-ui/components/Button';
import { Drawer, DrawerContent } from '@mastra/playground-ui/components/Drawer';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { useMeasuredAutoHeight } from '@mastra/playground-ui/hooks/use-measured-auto-height';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronLeft } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { cardMorphStyle } from '../hooks/useCardMorph';
import type { CardMorph } from '../hooks/useCardMorph';
import './cardMorph.css';

/** A thread column has to open tall enough to read: a short card would hand it a 7rem strip. */
const SPLIT_MIN_HEIGHT_PX = 320;

const SheetThreadContext = createContext<(() => void) | null>(null);

/** The sheet's "open the thread" action — null anywhere but the phone sheet, where the thread is a slide-over view. */
export function useSheetThread() {
  return useContext(SheetThreadContext);
}

// Both card kinds open this one panel, so the geometry and the motion are decided once.
export function CardDetailsPanel({
  morph,
  labelledBy,
  aside,
  asideLabel,
  children,
}: {
  morph: CardMorph;
  labelledBy: string;
  /** A conversation that fills its own box: beside the details on a desktop panel, a slide-over view in the sheet. */
  aside?: ReactNode;
  asideLabel?: string;
  children: ReactNode;
}) {
  // The content lays out unconstrained and the box follows, so a description arriving late grows the panel.
  const content = useMeasuredAutoHeight<HTMLDivElement>();
  const isMobile = useIsMobile();
  const [sheetView, setSheetView] = useState<'details' | 'thread'>('details');
  // Mounted on the first visit and kept: the queries behind it stay cold until then.
  const [threadMounted, setThreadMounted] = useState(false);
  const openThread = useCallback(() => {
    setThreadMounted(true);
    setSheetView('thread');
  }, []);
  // The sheet mounts on the first open, which would land it already in place:
  // one closed frame first gives the entrance transition somewhere to start.
  const [sheetEntered, setSheetEntered] = useState(false);
  useEffect(() => {
    setSheetEntered(morph.open);
  }, [morph.open]);

  if (!morph.mounted) return null;

  // No room to grow a card into a panel on a phone: the details come up as a sheet instead.
  if (isMobile) {
    // The sheet's height is owned here so switching views glides instead of snapping.
    const sheetHeight =
      sheetView === 'thread' ? '60dvh' : content.height === null ? undefined : `min(${content.height}px, 70dvh)`;

    return (
      <Drawer
        open={morph.open && sheetEntered}
        onOpenChange={open => {
          if (open) return;
          setSheetView('details');
          morph.closeDetails();
        }}
      >
        {/* The drawer's own auto height: a short card gets a short sheet instead of
            floating in a fixed one. */}
        <DrawerContent aria-labelledby={labelledBy} showCloseButton={false}>
          {aside === undefined ? (
            <div className="pb-[env(safe-area-inset-bottom)]">{children}</div>
          ) : (
            <div
              className="relative overflow-clip transition-[height] duration-300 ease-out"
              style={{ height: sheetHeight }}
            >
              <div
                className={cn(
                  'max-h-[70dvh] overflow-y-auto pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out',
                  sheetView === 'thread' && 'pointer-events-none -translate-x-[110%]',
                )}
              >
                {/* The details place their own thread button through this context. */}
                <SheetThreadContext value={openThread}>
                  <div ref={content.ref}>{children}</div>
                </SheetThreadContext>
              </div>
              {threadMounted && (
                <div
                  className={cn(
                    'absolute inset-0 flex translate-x-[110%] flex-col pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ease-out',
                    sheetView === 'thread' && 'translate-x-0',
                  )}
                >
                  <div className="flex shrink-0 items-center justify-between px-1 pt-0.5">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setSheetView('details')}>
                      <ChevronLeft aria-hidden />
                      Details
                    </Button>
                    <span className="text-ui-sm text-icon4 pr-3">{asideLabel ?? 'Comments'}</span>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col">{aside}</div>
                </div>
              )}
            </div>
          )}
        </DrawerContent>
      </Drawer>
    );
  }

  const fromSize = cardMorphStyle(morph.cardRef.current);
  const panelHeight =
    content.height !== null && aside !== undefined ? Math.max(content.height, SPLIT_MIN_HEIGHT_PX) : content.height;

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
          collisionAvoidance={{ side: 'shift', align: 'shift', fallbackAxisSide: 'none' }}
          // Bounded by the page, not by the column that clips at ~20rem.
          collisionBoundary={document.body}
          style={panelHeight === null ? fromSize : { ...fromSize, '--board-panel-h': `${panelHeight}px` }}
          // A clipped box scrolls to whatever is focused, and the first tabbable sits at the far corner.
          initialFocus={morph.panelRef}
          ref={morph.panelRef}
          className={cn('board-card-details relative overflow-hidden p-0', aside !== undefined && 'board-card-split')}
        >
          {/* Laid out at the panel's final width and clipped by the growing box,
            so the header rows hold still instead of reflowing frame by frame.
            Capped at the panel's own viewport budget: past it the column
            scrolls, keeping the composer and footer actions reachable. */}
          {aside === undefined ? (
            <div
              ref={content.ref}
              className="absolute top-0 left-0 flex max-h-(--board-panel-max-h) w-(--board-panel-w) flex-col overflow-y-auto"
            >
              {children}
            </div>
          ) : (
            // Two panels on a transparent stage: the details box morphs from the
            // card, the thread slides out from behind it a beat later.
            <>
              <div className="board-card-box border-border1 bg-surface3 shadow-dialog absolute top-0 left-0 z-10 flex flex-col overflow-hidden rounded-xl border">
                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                  {/* Only this column is measured: the thread beside it scrolls in
                    place, so comments landing never resize the panel. */}
                  <div ref={content.ref} className="flex flex-col">
                    {children}
                  </div>
                </div>
              </div>
              <div className="board-thread-panel border-border1 bg-surface3 shadow-dialog absolute top-3 right-0 bottom-1.5 flex w-(--board-thread-w) flex-col overflow-hidden rounded-xl border pl-(--board-thread-tuck)">
                {aside}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>
    </>
  );
}

const CLAMP_HEIGHT_PX = 128;

interface DescriptionSkeletonVars extends CSSProperties {
  '--description-max-h': string;
  '--description-clamp-h': string;
}
// Only clamp when at least ~2 lines are hidden: clipping a near-fit trades 20px for a click.
const CLAMP_TRIGGER_PX = 176;

// On the desktop panel the whole description shows and the column around it is
// the scroller, the header riding sticky above. The sheet keeps a clamp behind
// Show more — its space is the phone screen itself.
export function CardDetailsBody({
  children,
  /** What the description skeleton holds open while loading, so the actions under it stay put. */
  maxHeight = 'min(24rem, calc(100dvh - 26rem))',
}: {
  children: ReactNode;
  maxHeight?: string;
}) {
  const content = useMeasuredAutoHeight<HTMLDivElement>();
  const isMobile = useIsMobile();
  const [expanded, setExpanded] = useState(false);
  const clamped = isMobile && !expanded && content.height !== null && content.height > CLAMP_TRIGGER_PX;
  // The description skeleton sizes itself from these, staying one truth apart.
  const skeletonVars: DescriptionSkeletonVars = {
    '--description-max-h': maxHeight,
    '--description-clamp-h': `${CLAMP_HEIGHT_PX}px`,
  };

  if (!isMobile) {
    return (
      <div className="flex flex-col" style={skeletonVars} data-card-morph="reveal">
        <div className="px-3 pb-3">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={skeletonVars} data-card-morph="reveal">
      {expanded ? (
        <ScrollArea maxHeight={maxHeight} orientation="vertical">
          <div className="px-3 pb-3">{children}</div>
        </ScrollArea>
      ) : (
        // Capped even before the content is measured: a landing description must
        // never lay out at full height for a frame and snap back once clamped.
        <div className="relative overflow-hidden" style={{ maxHeight: clamped ? CLAMP_HEIGHT_PX : CLAMP_TRIGGER_PX }}>
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
