import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { useAutoscroll } from '@/hooks/use-autoscroll';
import { cn } from '@/lib/utils';

type Orientation = 'vertical' | 'horizontal' | 'both';
type ScrollButtonDirection = 'left' | 'right';

const DEFAULT_SCROLL_BUTTON_SPEED = 100;
const DEFAULT_SCROLL_BUTTON_INTERVAL_TIME = 20;
const MIN_SCROLL_BUTTON_SPEED = 1;
const MIN_SCROLL_BUTTON_INTERVAL_TIME = 16;

export type MaskSides = {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  /** Shorthand: sets both `left` and `right`. Per-side keys override. */
  x?: boolean;
  /** Shorthand: sets both `top` and `bottom`. Per-side keys override. */
  y?: boolean;
};

/**
 * - `true` / omitted: fade the edges that match `orientation`.
 * - `false`: no fade.
 * - object: per-side override on top of the orientation default.
 */
export type ScrollAreaMask = boolean | MaskSides;

export type ScrollAreaScrollButtons =
  | boolean
  | {
      /** Pixels to scroll per repeated interval. */
      scrollSpeed?: number;
      /** Milliseconds between repeated scroll steps while the button is held. */
      scrollIntervalTime?: number;
      leftLabel?: string;
      rightLabel?: string;
    };

export type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  viewPortClassName?: string;
  maxHeight?: string;
  autoScroll?: boolean;
  orientation?: Orientation;
  /** Show left/right controls for horizontal overflow. Only applies to `horizontal` and `both` orientations. */
  scrollButtons?: ScrollAreaScrollButtons;
  /** Fade content at the edges where it's clipped by overflow. Defaults to the axes matching `orientation`. */
  mask?: ScrollAreaMask;
  /** @deprecated Use `mask` instead. Retained for backward compatibility. */
  showMask?: boolean;
  /**
   * Reveal the overlay scrollbar when the pointer hovers the area. When `false`,
   * the scrollbar only appears while actively scrolling. Defaults to `true`.
   */
  revealScrollbarOnHover?: boolean;
  /**
   * Ref to the scrolling viewport element. Use this as the scroll element for a
   * virtualizer (`getScrollElement: () => viewportRef.current`) so the list can
   * virtualize while still using the ScrollArea's overlay scrollbar + masks.
   */
  viewportRef?: React.Ref<HTMLDivElement>;
};

type ResolvedMask = { top: boolean; bottom: boolean; left: boolean; right: boolean };

function resolveMask(mask: ScrollAreaMask | undefined, orientation: Orientation): ResolvedMask {
  if (mask === false) return { top: false, bottom: false, left: false, right: false };

  const vertical = orientation === 'vertical' || orientation === 'both';
  const horizontal = orientation === 'horizontal' || orientation === 'both';
  const sides: ResolvedMask = { top: vertical, bottom: vertical, left: horizontal, right: horizontal };

  if (mask === true || mask === undefined) return sides;

  if (mask.y !== undefined) {
    sides.top = mask.y;
    sides.bottom = mask.y;
  }
  if (mask.x !== undefined) {
    sides.left = mask.x;
    sides.right = mask.x;
  }
  if (mask.top !== undefined) sides.top = mask.top;
  if (mask.bottom !== undefined) sides.bottom = mask.bottom;
  if (mask.left !== undefined) sides.left = mask.left;
  if (mask.right !== undefined) sides.right = mask.right;

  return sides;
}

function maskClasses(sides: ResolvedMask) {
  return cn(
    sides.top && 'data-[overflow-y-start]:mask-t-from-[calc(100%-2rem)]',
    sides.bottom && 'data-[overflow-y-end]:mask-b-from-[calc(100%-2rem)]',
    sides.left && 'data-[overflow-x-start]:mask-l-from-[calc(100%-2rem)]',
    sides.right && 'data-[overflow-x-end]:mask-r-from-[calc(100%-2rem)]',
  );
}

function clampScrollButtonNumber(value: number | undefined, fallback: number, min: number) {
  const resolvedValue = value ?? fallback;
  return Number.isFinite(resolvedValue) ? Math.max(min, resolvedValue) : Math.max(min, fallback);
}

type ScrollButtonProps = {
  direction: ScrollButtonDirection;
  label: string;
  onStartScrolling: (direction: ScrollButtonDirection, event?: React.PointerEvent<HTMLButtonElement>) => void;
  onStopScrolling: () => void;
  onKeyboardScroll: (direction: ScrollButtonDirection) => void;
};

const ScrollButton = ({ direction, label, onStartScrolling, onStopScrolling, onKeyboardScroll }: ScrollButtonProps) => {
  const Icon = direction === 'left' ? ChevronLeftIcon : ChevronRightIcon;

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'duration-normal absolute inset-y-1 z-10 hidden w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-neutral3 transition-colors ease-out-custom hover:bg-neutral6/5 hover:text-neutral6 active:bg-neutral6/10',
        'outline-hidden focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-neutral5/55 focus-visible:outline-solid',
        direction === 'left'
          ? 'left-1 group-data-[overflow-x-start]/scroll-area:flex'
          : 'right-1 group-data-[overflow-x-end]/scroll-area:flex',
      )}
      onPointerDown={event => onStartScrolling(direction, event)}
      onPointerUp={onStopScrolling}
      onPointerLeave={onStopScrolling}
      onPointerCancel={onStopScrolling}
      onBlur={onStopScrolling}
      onClick={event => {
        if (event.detail === 0) onKeyboardScroll(direction);
      }}
    >
      <Icon aria-hidden="true" className="size-4" />
    </button>
  );
};

type ScrollButtonsProps = {
  areaRef: React.RefObject<HTMLDivElement | null>;
  scrollButtons: Exclude<ScrollAreaScrollButtons, false | undefined>;
};

const ScrollButtons = ({ areaRef, scrollButtons }: ScrollButtonsProps) => {
  const scrollButtonInterval = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollButtonOptions = typeof scrollButtons === 'object' ? scrollButtons : undefined;
  const scrollButtonSpeed = clampScrollButtonNumber(
    scrollButtonOptions?.scrollSpeed,
    DEFAULT_SCROLL_BUTTON_SPEED,
    MIN_SCROLL_BUTTON_SPEED,
  );
  const scrollButtonIntervalTime = clampScrollButtonNumber(
    scrollButtonOptions?.scrollIntervalTime,
    DEFAULT_SCROLL_BUTTON_INTERVAL_TIME,
    MIN_SCROLL_BUTTON_INTERVAL_TIME,
  );
  const leftScrollButtonLabel = scrollButtonOptions?.leftLabel ?? 'Scroll left';
  const rightScrollButtonLabel = scrollButtonOptions?.rightLabel ?? 'Scroll right';

  const stopScrollButtonScrolling = React.useCallback(() => {
    if (!scrollButtonInterval.current) return;
    clearInterval(scrollButtonInterval.current);
    scrollButtonInterval.current = null;
  }, []);

  const scrollByDirection = React.useCallback(
    (direction: ScrollButtonDirection, multiplier = 1) => {
      const viewport = areaRef.current;
      if (!viewport) return;

      viewport.scrollBy({
        left: direction === 'right' ? scrollButtonSpeed * multiplier : -scrollButtonSpeed * multiplier,
        behavior: 'smooth',
      });
    },
    [areaRef, scrollButtonSpeed],
  );

  const startScrollButtonScrolling = React.useCallback(
    (direction: ScrollButtonDirection, event?: React.PointerEvent<HTMLButtonElement>) => {
      event?.preventDefault();
      event?.stopPropagation();
      event?.currentTarget.setPointerCapture?.(event.pointerId);

      stopScrollButtonScrolling();
      scrollByDirection(direction, 2);

      scrollButtonInterval.current = setInterval(() => {
        scrollByDirection(direction);
      }, scrollButtonIntervalTime);
    },
    [scrollButtonIntervalTime, scrollByDirection, stopScrollButtonScrolling],
  );

  React.useEffect(() => {
    return () => {
      stopScrollButtonScrolling();
    };
  }, [stopScrollButtonScrolling]);

  return (
    <>
      <ScrollButton
        direction="left"
        label={leftScrollButtonLabel}
        onStartScrolling={startScrollButtonScrolling}
        onStopScrolling={stopScrollButtonScrolling}
        onKeyboardScroll={direction => scrollByDirection(direction, 2)}
      />
      <ScrollButton
        direction="right"
        label={rightScrollButtonLabel}
        onStartScrolling={startScrollButtonScrolling}
        onStopScrolling={stopScrollButtonScrolling}
        onKeyboardScroll={direction => scrollByDirection(direction, 2)}
      />
    </>
  );
};

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      children,
      viewPortClassName,
      maxHeight,
      autoScroll = false,
      orientation = 'vertical',
      scrollButtons,
      mask,
      showMask,
      revealScrollbarOnHover = true,
      viewportRef,
      ...props
    },
    ref,
  ) => {
    const areaRef = React.useRef<HTMLDivElement>(null);
    useAutoscroll(areaRef, { enabled: autoScroll });

    // Keep the internal autoscroll ref while also exposing the viewport to callers
    // (e.g. a virtualizer's scroll element).
    const setViewportRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        areaRef.current = node;
        if (typeof viewportRef === 'function') viewportRef(node);
        else if (viewportRef) (viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [viewportRef],
    );

    const effectiveMask: ScrollAreaMask | undefined = mask !== undefined ? mask : showMask;
    const sides = resolveMask(effectiveMask, orientation);

    const viewportStyle: React.CSSProperties = {};
    if (maxHeight) viewportStyle.maxHeight = maxHeight;
    if (orientation === 'vertical') {
      viewportStyle.overflowX = 'hidden';
      viewportStyle.overflowY = 'scroll';
    } else if (orientation === 'horizontal') {
      viewportStyle.overflowX = 'scroll';
      viewportStyle.overflowY = 'hidden';
    }

    // Base UI's ScrollAreaContent forces `min-width: fit-content` so the
    // content can grow wider than the viewport (required for horizontal scroll
    // measurement). For vertical-only scroll we override it so children shrink
    // to the viewport width instead of forcing horizontal scroll.
    const contentStyle: React.CSSProperties | undefined =
      orientation === 'vertical'
        ? { minWidth: '0px' }
        : orientation === 'horizontal'
          ? { minHeight: '0px' }
          : undefined;

    return (
      <ScrollAreaPrimitive.Root
        ref={ref}
        className={cn('group/scroll-area relative overflow-hidden', className)}
        {...props}
      >
        <ScrollAreaPrimitive.Viewport
          ref={setViewportRef}
          className={cn('size-full rounded-[inherit]', maskClasses(sides), viewPortClassName)}
          style={viewportStyle}
        >
          <ScrollAreaPrimitive.Content style={contentStyle}>{children}</ScrollAreaPrimitive.Content>
        </ScrollAreaPrimitive.Viewport>
        {scrollButtons && orientation !== 'vertical' && (
          <ScrollButtons areaRef={areaRef} scrollButtons={scrollButtons} />
        )}
        {(orientation === 'vertical' || orientation === 'both') && (
          <ScrollBar orientation="vertical" revealOnHover={revealScrollbarOnHover} />
        )}
        {(orientation === 'horizontal' || orientation === 'both') && (
          <ScrollBar orientation="horizontal" revealOnHover={revealScrollbarOnHover} />
        )}
        {orientation === 'both' && <ScrollAreaPrimitive.Corner />}
      </ScrollAreaPrimitive.Root>
    );
  },
);
ScrollArea.displayName = 'ScrollArea';

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar> & { revealOnHover?: boolean }
>(({ className, orientation = 'vertical', revealOnHover = true, ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'duration-normal flex touch-none transition-opacity ease-out-custom select-none',
      'opacity-0 data-[scrolling]:opacity-100 data-[scrolling]:duration-0',
      revealOnHover && 'data-[hovering]:opacity-100',
      orientation === 'vertical' && 'h-full w-1.5 p-px',
      orientation === 'horizontal' && 'h-1.5 w-full flex-col p-px',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb className="duration-normal relative flex-1 rounded-full bg-neutral4/30 transition-colors hover:bg-neutral4/60" />
  </ScrollAreaPrimitive.Scrollbar>
));
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
