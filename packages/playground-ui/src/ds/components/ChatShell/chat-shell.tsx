import type { ComponentPropsWithoutRef } from 'react';

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
 * width), `--chat-surface` (page colour), `--chat-gutter` (room above and below
 * the composer), `--chat-veil` (what the dock paints with), `--chat-inset-end`
 * (room an overlay panel claims on the end edge).
 */
export function ChatShellRoot({ className, scroller, ...props }: ChatShellProps) {
  return (
    <MessageScrollerProvider {...scroller}>
      <div
        data-slot="chat-shell"
        className={cn(
          '@container relative isolate flex min-h-0 min-w-0 flex-col bg-(--chat-surface)',
          '[--chat-column:48rem] [--chat-gutter:0.75rem] [--chat-inset-end:0px]',
          '[--chat-surface:var(--color-surface2)]',
          '[--chat-veil:color-mix(in_oklab,var(--chat-surface)_70%,transparent)]',
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
      <div data-slot="chat-shell-track" className="flex min-h-full min-w-0 flex-col">
        {children}
      </div>
    </MessageScrollerViewport>
  );
}

/** Scrolling content. Its bottom padding is the unveiled air above the composer. */
export function ChatShellContent({ className, ...props }: MessageScrollerContentProps) {
  return <MessageScrollerContent className={cn('flex-1 pb-(--chat-gutter)', className)} {...props} />;
}

/** The shared reading column. Every chat region must go through it. */
export function ChatShellColumn({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="chat-shell-column"
      className={cn('mx-auto flex w-full max-w-(--chat-column) min-w-0 flex-col px-3 md:px-5', className)}
      {...props}
    />
  );
}

/**
 * Composer region, sticky but left in flow: its own height reserves the room the
 * transcript scrolls behind, so nothing measures it and a composer growing under
 * the cursor resizes no box the scroller watches.
 *
 * The veil is a background, not an overlay, so it passes behind the composer card
 * and dims the transcript in its rounded corners too.
 */
export function ChatShellDock({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      data-slot="chat-shell-dock"
      className={cn('sticky bottom-0 z-10 shrink-0 bg-(--chat-veil) pb-(--chat-gutter)', className)}
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
