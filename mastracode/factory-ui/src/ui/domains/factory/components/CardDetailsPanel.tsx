import { Drawer, DrawerContent } from '@mastra/playground-ui/components/Drawer';
import type { DrawerProps } from '@mastra/playground-ui/components/Drawer';
import { Popover, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { useIsMobile } from '@mastra/playground-ui/hooks/use-is-mobile';
import { raisedSurfaceStyle } from '@mastra/playground-ui/primitives/raised-surface';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { ReactNode } from 'react';
import { useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import type { BoardLayout } from '../boardLayout';
import { BoardDetailsDockContext } from '../context/BoardDetailsDockContext';
import { cardMorphStyle } from '../hooks/useCardMorph';
import type { CardMorph } from '../hooks/useCardMorph';
import './cardMorph.css';

interface CardDetailsProps {
  morph: CardMorph;
  labelledBy: string;
  /** The card's rows, laid out exactly as the card lays them out. */
  header: ReactNode;
  /** The tray. */
  children: ReactNode;
}

// Both card kinds open this one panel. On the kanban board it grows out of the card:
// the card's own rows in a box over it, and a tray beneath for what the card never carried.
export function CardDetailsPanel({
  morph,
  labelledBy,
  header,
  children,
  layout,
}: CardDetailsProps & { layout: BoardLayout }) {
  const isMobile = useIsMobile();
  const dock = useContext(BoardDetailsDockContext);

  // No room to grow a card into a panel on a phone: the details come up as a sheet instead.
  if (isMobile) {
    return (
      <CardDetailsDrawer
        morph={morph}
        labelledBy={labelledBy}
        header={header}
        side="bottom"
        className="max-h-[85dvh] pb-[env(safe-area-inset-bottom)]"
      >
        {children}
      </CardDetailsDrawer>
    );
  }

  if (layout === 'list' && dock) {
    return morph.open ? (
      <DockedCardDetails element={dock.element} morph={morph} labelledBy={labelledBy} header={header}>
        {children}
      </DockedCardDetails>
    ) : null;
  }

  if (layout === 'list') {
    return (
      <CardDetailsDrawer
        morph={morph}
        labelledBy={labelledBy}
        header={header}
        side="right"
        variant="floating"
        overlay="none"
        disablePointerDismissal={false}
        className="min-h-0 flex-1"
      >
        {children}
      </CardDetailsDrawer>
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
            'bg-sidebar/60 fixed inset-0 z-40 transition-opacity duration-200',
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
          <div
            className={`board-card-copy group ${raisedSurfaceStyle} rounded-card relative z-10 flex min-h-36 shrink-0 flex-col gap-3 p-2`}
          >
            {header}
          </div>
          <div className={`board-card-tray ${raisedSurfaceStyle} relative flex flex-col overflow-hidden rounded-xl`}>
            {children}
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

function DockedCardDetails({
  element,
  morph,
  labelledBy,
  header,
  children,
}: CardDetailsProps & { element: HTMLElement | null }) {
  const { cardRef } = morph;
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (element === null) return;
    sectionRef.current?.focus({ preventScroll: true });
    return () => {
      // Removing the focused panel drops focus onto the page.
      if (document.activeElement === document.body) cardRef.current?.focus({ preventScroll: true });
    };
  }, [element, cardRef]);

  if (element === null) return null;

  return createPortal(
    <section
      ref={sectionRef}
      role="dialog"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className="flex min-h-0 flex-1 flex-col outline-none"
    >
      <div className="relative flex shrink-0 flex-col gap-3 p-3">{header}</div>
      <div className="border-border flex min-h-0 grow flex-col border-t">{children}</div>
    </section>,
    element,
  );
}

// Its root sits in the tree closed, so the first open has a closed frame to transition from.
function CardDetailsDrawer({
  morph,
  labelledBy,
  header,
  children,
  className,
  ...drawerProps
}: CardDetailsProps & { className: string } & Pick<
    DrawerProps,
    'side' | 'variant' | 'overlay' | 'disablePointerDismissal'
  >) {
  return (
    <Drawer
      {...drawerProps}
      open={morph.open}
      onOpenChange={(open, details) => {
        if (open || dismissedByOwnRow(morph.cardRef.current, details)) return;
        morph.closeDetails();
      }}
    >
      <DrawerContent aria-labelledby={labelledBy} showCloseButton={false}>
        <div className={cn('flex flex-col', className)}>
          <div className="relative flex shrink-0 flex-col gap-3 p-3">{header}</div>
          <div className="border-border flex min-h-0 grow flex-col border-t">{children}</div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

type DrawerChangeDetails = Parameters<NonNullable<DrawerProps['onOpenChange']>>[1];

// The row's own click toggles the panel: dismissing on that press would reopen it.
function dismissedByOwnRow(row: HTMLElement | null, { reason, event }: DrawerChangeDetails): boolean {
  if (reason !== 'outside-press' && reason !== 'focus-out') return false;
  const target = event instanceof FocusEvent ? event.relatedTarget : event.target;
  return target instanceof Node && row !== null && row.contains(target);
}
