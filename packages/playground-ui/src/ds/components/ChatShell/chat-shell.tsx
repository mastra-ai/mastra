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
 * composer docks below it, every region shares one column.
 *
 * Tuned through custom properties, all defaulted here: `--chat-column` (column
 * width), `--chat-surface` (the colour the composer veil ramps to — the shell
 * paints no fill of its own and inherits whatever surface hosts it, so this has
 * to name that same surface), `--chat-fade` (the band the veil ramps in
 * across, above the composer), `--chat-veil` (strongest it ever gets — the
 * transcript keeps showing through), `--chat-gutter` (room below the composer),
 * `--chat-inset-end` (room an overlay panel claims on the end edge).
 */
export function ChatShellRoot({ className, scroller, ...props }: ChatShellProps) {
  return (
    <MessageScrollerProvider {...scroller}>
      <div
        data-slot="chat-shell"
        className={cn(
          '@container relative isolate flex min-h-0 min-w-0 flex-col',
          '[--chat-column:48rem] [--chat-fade:2rem] [--chat-gutter:0.75rem] [--chat-inset-end:0px]',
          '[--chat-surface:var(--color-background)] [--chat-veil:100%]',
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
 * same room would drag the scrollbar inward, off the true edge. No overscroll
 * bounce on either axis: the dock is sticky inside this box, so the rubber band
 * would carry the composer off its edge along with the transcript.
 */
export function ChatShellViewport({ className, children, ...props }: MessageScrollerViewportProps) {
  return (
    <MessageScrollerViewport
      className={cn(
        'h-auto min-h-0 flex-1 overscroll-none pe-(--chat-inset-end)',
        'transition-[padding] duration-360 ease-out-custom motion-reduce:transition-none',
        className,
      )}
      {...props}
    >
      {/* Sticky against the scroller itself is clamped to its box, not the
          scrolled height, and strands the fade mid-transcript. */}
      <div data-slot="chat-shell-track" className="relative flex min-h-full min-w-0 flex-col">
        {children}
        {/* The air under the last row, and the band the transcript fades out across
            as it scrolls toward the dock. */}
        <div
          aria-hidden
          data-slot="chat-shell-fade"
          className="pointer-events-none sticky bottom-0 z-10 h-(--chat-fade) shrink-0 bg-(--chat-surface) [mask-image:linear-gradient(to_bottom,transparent,rgb(0_0_0/var(--chat-veil)))]"
        />
      </div>
    </MessageScrollerViewport>
  );
}

/** Scrolling content. The air under it belongs to the viewport's fade band. */
export function ChatShellContent({ className, ...props }: MessageScrollerContentProps) {
  return <MessageScrollerContent className={cn('flex-1', className)} {...props} />;
}

/** The shared reading column. Every chat region must go through it. */
export function ChatShellColumn({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-shell-column"
      className={cn('mx-auto flex w-full max-w-(--chat-column) min-w-0 flex-col px-3 md:px-4', className)}
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
 * Composer region, the scroller's sibling under it, so neither the transcript nor
 * the scrollbar runs behind it. It takes the end inset with the scroller, so the
 * two stay on one axis.
 */
export function ChatShellDock({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="chat-shell-dock"
      className={cn(
        'relative z-10 shrink-0 pe-(--chat-inset-end) pb-(--chat-gutter)',
        'transition-[padding-inline-end] duration-360 ease-out-custom motion-reduce:transition-none',
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
      className="pointer-events-none absolute inset-s-0 inset-e-(--chat-inset-end) bottom-[calc(100%+0.5rem)] flex"
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
