import type { ComponentProps, ComponentPropsWithoutRef } from 'react';

import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '../MessageScroller';
import type {
  MessageScrollerButtonProps,
  MessageScrollerContentProps,
  MessageScrollerProviderProps,
  MessageScrollerViewportProps,
} from '../MessageScroller';

import { cn } from '@/lib/utils';

export type ChatShellProps = ComponentPropsWithoutRef<'div'> & {
  scroller?: Omit<MessageScrollerProviderProps, 'children'>;
};

/**
 * A chat page frame with exactly one scroll container. Bars sit above it, the
 * composer docks inside it, every region shares one column.
 *
 * Tuned through custom properties, all defaulted here: `--chat-column` (column
 * width), `--chat-surface` (page colour), `--chat-fade` (the band the veil ramps
 * in across, above the composer), `--chat-veil` (strongest it ever gets — the
 * transcript keeps showing through), `--chat-gutter` (room below the composer),
 * `--chat-inset-end` (room an overlay panel claims on the end edge).
 */
export function ChatShellRoot({ className, scroller, ...props }: ChatShellProps) {
  return (
    <MessageScrollerProvider {...scroller}>
      <div
        data-slot="chat-shell"
        className={cn(
          '@container relative isolate flex min-h-0 min-w-0 flex-col bg-(--chat-surface)',
          '[--chat-column:48rem] [--chat-fade:1.5rem] [--chat-gutter:0.75rem] [--chat-inset-end:0px]',
          '[--chat-surface:var(--color-surface2)] [--chat-veil:70%]',
          className,
        )}
        {...props}
      />
    </MessageScrollerProvider>
  );
}

/**
 * Full-width row above the scroller (session header, goal bar). No end inset: the
 * overlay panel it would dodge floats inside the stage, below the bars.
 */
export function ChatShellBar({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <div data-slot="chat-shell-bar" className={cn('min-w-0 shrink-0', className)} {...props} />;
}

/** Positioned region holding the scroller plus anything overlaying it. */
export function ChatShellStage({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <MessageScroller className={cn('h-auto min-h-0 flex-1', className)} {...props} />;
}

/**
 * The one scroll container. It takes the end inset itself — on an ancestor the
 * same room would drag the scrollbar inward, off the true edge.
 */
export function ChatShellViewport({ className, children, ...props }: MessageScrollerViewportProps) {
  return (
    <MessageScrollerViewport
      className={cn(
        'h-auto min-h-0 flex-1 pe-(--chat-inset-end)',
        'transition-[padding] duration-360 ease-out-custom motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {/* Sticky against the scroller itself is clamped to its box, not the
          scrolled height, and strands the dock mid-transcript. */}
      <div data-slot="chat-shell-track" className="relative flex min-h-full min-w-0 flex-col">
        {children}
      </div>
    </MessageScrollerViewport>
  );
}

/** Scrolling content. The air above the composer belongs to the dock's fade band. */
export function ChatShellContent({ className, ...props }: MessageScrollerContentProps) {
  return <MessageScrollerContent className={cn('flex-1', className)} {...props} />;
}

/** The shared reading column. Every chat region must go through it. */
export function ChatShellColumn({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-shell-column"
      className={cn('mx-auto flex w-full max-w-(--chat-column) min-w-0 flex-col px-3 md:px-5', className)}
      {...props}
    />
  );
}

export interface ChatShellTurnProps extends ComponentPropsWithoutRef<'div'> {
  /** Opened by a user message: the turn reserves room and releases it through a slow drift. */
  opensTurn?: boolean;
  /** Holds the reply's share of the screen open under the live turn while the run answers. */
  holdsRoom?: boolean;
  /** Restored mid-run: the room is already due, so it opens with no transition. */
  restored?: boolean;
}

/**
 * One user turn and the reply under it. The room is the answer's share of the
 * screen: the scroller parks the sent message exactly one room above the end of
 * the box, so wherever the composer ends the message rests with this much space
 * under it, and the scroller has nothing to follow until the answer outgrows it.
 * A full screen parked the message against the very top; 70 leaves it breathing.
 * Opening must outrun the scroller's trip; closing is the conversation settling.
 */
export function ChatShellTurn({ opensTurn, holdsRoom, restored, className, ...props }: ChatShellTurnProps) {
  return (
    <div
      data-slot="chat-shell-turn"
      data-opens-turn={opensTurn ? 'true' : undefined}
      data-holds-room={holdsRoom ? 'true' : undefined}
      className={cn(
        'flex flex-col',
        opensTurn &&
          'min-h-0 transition-[min-height] duration-[1500ms] ease-[cubic-bezier(0.3,0,0.2,1)] motion-reduce:transition-none',
        holdsRoom && 'min-h-[70cqh] duration-[440ms] ease-[cubic-bezier(0.2,0,0.2,1)] starting:min-h-0',
        holdsRoom && restored && 'transition-none',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Composer region, sticky but left in flow: its own height reserves the room the
 * transcript scrolls behind, so nothing measures it and a composer growing under
 * the cursor resizes no box the scroller watches.
 *
 * Behind it, one sheet of the page masked in over `--chat-fade` of air and never
 * past `--chat-veil`, so the transcript dims as it slides under but stays
 * readable through the card's surroundings. The ramp runs three times the air, so
 * it tops out behind the card and its end never shows.
 */
export function ChatShellDock({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="chat-shell-dock"
      className={cn(
        'sticky bottom-0 z-10 mt-(--chat-fade) shrink-0 pb-(--chat-gutter)',
        'before:pointer-events-none before:absolute before:inset-x-0 before:-top-(--chat-fade) before:bottom-0 before:-z-10',
        'before:bg-(--chat-surface) before:[mask-image:linear-gradient(to_bottom,transparent,rgb(0_0_0/var(--chat-veil))_calc(var(--chat-fade)*3))]',
        className,
      )}
      {...props}
    />
  );
}

/**
 * Jump-to-latest, floating just above the dock. It belongs inside the dock:
 * anywhere else it centres on a box the scrollbar has not narrowed, landing off
 * the composer's axis.
 */
export function ChatShellScrollButton({ className, ...props }: MessageScrollerButtonProps) {
  return (
    <div
      data-slot="chat-shell-scroll-button"
      className="pointer-events-none absolute inset-x-0 bottom-[calc(100%+0.5rem)] flex"
    >
      <ChatShellColumn className="flex-row justify-center">
        <MessageScrollerButton
          className={cn('pointer-events-auto static translate-x-0 rtl:translate-x-0', className)}
          {...props}
        />
      </ChatShellColumn>
    </div>
  );
}
