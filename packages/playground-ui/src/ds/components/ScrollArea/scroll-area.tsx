import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';

import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { quietTextHover } from '@/ds/primitives/typography';
import { useAutoscroll } from '@/hooks/use-autoscroll';
import { mergeRefs } from '@/lib/merge-refs';
import { cn } from '@/lib/utils';

type Orientation = 'vertical' | 'horizontal' | 'both';
type ScrollButtonDirection = 'left' | 'right';

const DEFAULT_SCROLL_BUTTON_SPEED = 100;
const DEFAULT_SCROLL_BUTTON_INTERVAL_TIME = 20;
const MIN_SCROLL_BUTTON_SPEED = 1;
const MIN_SCROLL_BUTTON_INTERVAL_TIME = 16;

type MaskFadeDepth = `${number}${'rem' | 'px'}`;
type MaskSide = boolean | MaskFadeDepth;

const DEFAULT_MASK_FADE_DEPTH: MaskFadeDepth = '2rem';
const NO_MASK_FADE: MaskFadeDepth = '0px';

const SCROLL_DRIVEN_FADE_CLASSES = [
  'mask-t-from-[calc(100%-min(var(--scroll-area-fade-top),var(--scroll-area-overflow-y-start,0px)))]',
  'mask-b-from-[calc(100%-min(var(--scroll-area-fade-bottom),var(--scroll-area-overflow-y-end,0px)))]',
  'mask-l-from-[calc(100%-min(var(--scroll-area-fade-left),var(--scroll-area-overflow-x-start,0px)))]',
  'mask-r-from-[calc(100%-min(var(--scroll-area-fade-right),var(--scroll-area-overflow-x-end,0px)))]',
].join(' ');

export type MaskSides = {
  top?: MaskSide;
  bottom?: MaskSide;
  left?: MaskSide;
  right?: MaskSide;
  /** Shorthand: sets both `left` and `right`. Per-side keys override. */
  x?: MaskSide;
  /** Shorthand: sets both `top` and `bottom`. Per-side keys override. */
  y?: MaskSide;
};

/**
 * - `true` / omitted: fade the edges that match `orientation`, 2rem deep.
 * - `false`: no fade.
 * - object: per-side override on top of the orientation default; a length (`'5rem'`) sets that side's fade depth.
 *
 * A fade grows with the distance scrolled from its edge, up to its depth.
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

export type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  maxHeight?: string;
  autoScroll?: boolean;
  orientation?: Orientation;
  /** Show left/right controls for horizontal overflow. Only applies to `horizontal` and `both` orientations. */
  scrollButtons?: ScrollAreaScrollButtons;
  /** Fade content at the edges where it's clipped by overflow. Defaults to the axes matching `orientation`. */
  mask?: ScrollAreaMask;
  /**
   * Reveal the overlay scrollbar when the pointer hovers the area. When `false`,
   * the scrollbar only appears while actively scrolling. Defaults to `true`.
   */
  revealScrollbarOnHover?: boolean;
};

type ResolvedMask = Record<'top' | 'bottom' | 'left' | 'right', MaskFadeDepth | false>;

type ScrollAreaViewportStyle = React.CSSProperties & {
  '--scroll-area-fade-top'?: MaskFadeDepth;
  '--scroll-area-fade-bottom'?: MaskFadeDepth;
  '--scroll-area-fade-left'?: MaskFadeDepth;
  '--scroll-area-fade-right'?: MaskFadeDepth;
};

const fadeDepth = (side: MaskSide) => (side === true ? DEFAULT_MASK_FADE_DEPTH : side);

function resolveMask(mask: ScrollAreaMask | undefined, orientation: Orientation): ResolvedMask {
  if (mask === false) return { top: false, bottom: false, left: false, right: false };

  const verticalFade = (orientation === 'vertical' || orientation === 'both') && DEFAULT_MASK_FADE_DEPTH;
  const horizontalFade = (orientation === 'horizontal' || orientation === 'both') && DEFAULT_MASK_FADE_DEPTH;
  const sides: ResolvedMask = { top: verticalFade, bottom: verticalFade, left: horizontalFade, right: horizontalFade };

  if (mask === true || mask === undefined) return sides;

  if (mask.y !== undefined) {
    sides.top = fadeDepth(mask.y);
    sides.bottom = fadeDepth(mask.y);
  }
  if (mask.x !== undefined) {
    sides.left = fadeDepth(mask.x);
    sides.right = fadeDepth(mask.x);
  }
  if (mask.top !== undefined) sides.top = fadeDepth(mask.top);
  if (mask.bottom !== undefined) sides.bottom = fadeDepth(mask.bottom);
  if (mask.left !== undefined) sides.left = fadeDepth(mask.left);
  if (mask.right !== undefined) sides.right = fadeDepth(mask.right);

  return sides;
}

const fadeDepthVars = (sides: ResolvedMask): ScrollAreaViewportStyle => ({
  '--scroll-area-fade-top': sides.top || NO_MASK_FADE,
  '--scroll-area-fade-bottom': sides.bottom || NO_MASK_FADE,
  '--scroll-area-fade-left': sides.left || NO_MASK_FADE,
  '--scroll-area-fade-right': sides.right || NO_MASK_FADE,
});

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
        'absolute inset-y-1 z-10 hidden w-8 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent hover:bg-fill-subtle active:bg-fill',
        quietTextHover,
        controlStateColorTransition,
        focusRing,
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

type ScrollAreaViewportContextValue = {
  areaRef: React.RefObject<HTMLDivElement | null>;
  className: string;
  style: React.CSSProperties;
  contentStyle: React.CSSProperties | undefined;
};

const ScrollAreaViewportContext = React.createContext<ScrollAreaViewportContextValue | null>(null);

export type ScrollAreaViewportProps = {
  className?: string;
  children?: React.ReactNode;
  /** The scrolling element, e.g. a virtualizer's `getScrollElement`. */
  ref?: React.Ref<HTMLDivElement>;
};

function useScrollAreaViewportContext() {
  const viewport = React.use(ScrollAreaViewportContext);
  if (!viewport) throw new Error('ScrollAreaViewport must be a direct child of ScrollArea');
  return viewport;
}

function ScrollAreaViewport({ className, children, ref }: ScrollAreaViewportProps) {
  const viewport = useScrollAreaViewportContext();
  const { areaRef } = viewport;
  const viewportRef = React.useMemo(() => mergeRefs(areaRef, ref), [areaRef, ref]);

  return (
    <ScrollAreaPrimitive.Viewport
      ref={viewportRef}
      className={cn(viewport.className, className)}
      style={viewport.style}
    >
      <ScrollAreaPrimitive.Content style={viewport.contentStyle}>
        <ScrollAreaViewportContext value={null}>{children}</ScrollAreaViewportContext>
      </ScrollAreaPrimitive.Content>
    </ScrollAreaPrimitive.Viewport>
  );
}

function ScrollArea({
  className,
  children,
  maxHeight,
  autoScroll = false,
  orientation = 'vertical',
  scrollButtons,
  mask,
  revealScrollbarOnHover = true,
  ...props
}: ScrollAreaProps) {
  const areaRef = React.useRef<HTMLDivElement>(null);
  useAutoscroll(areaRef, { enabled: autoScroll });

  const sides = resolveMask(mask, orientation);
  const fadesAnySide = Object.values(sides).some(Boolean);

  const viewportStyle = fadeDepthVars(sides);
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
    orientation === 'vertical' ? { minWidth: '0px' } : orientation === 'horizontal' ? { minHeight: '0px' } : undefined;

  const viewport: ScrollAreaViewportContextValue = {
    areaRef,
    className: cn('size-full', fadesAnySide && SCROLL_DRIVEN_FADE_CLASSES),
    style: viewportStyle,
    contentStyle,
  };
  const callerViewportCount = React.Children.toArray(children).filter(
    child => React.isValidElement(child) && child.type === ScrollAreaViewport,
  ).length;
  if (callerViewportCount > 1) throw new Error('ScrollArea takes at most one ScrollAreaViewport');
  const callerRendersViewport = callerViewportCount === 1;

  return (
    <ScrollAreaPrimitive.Root className={cn('group/scroll-area relative overflow-hidden', className)} {...props}>
      <ScrollAreaViewportContext value={viewport}>
        {callerRendersViewport ? children : <ScrollAreaViewport>{children}</ScrollAreaViewport>}
      </ScrollAreaViewportContext>
      {scrollButtons && orientation !== 'vertical' && <ScrollButtons areaRef={areaRef} scrollButtons={scrollButtons} />}
      {(orientation === 'vertical' || orientation === 'both') && (
        <ScrollBar orientation="vertical" revealOnHover={revealScrollbarOnHover} />
      )}
      {(orientation === 'horizontal' || orientation === 'both') && (
        <ScrollBar orientation="horizontal" revealOnHover={revealScrollbarOnHover} />
      )}
      {orientation === 'both' && <ScrollAreaPrimitive.Corner />}
    </ScrollAreaPrimitive.Root>
  );
}

function ScrollBar({
  className,
  orientation = 'vertical',
  revealOnHover = true,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Scrollbar> & { revealOnHover?: boolean }) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        'flex touch-none transition-opacity duration-normal ease-out-custom select-none',
        'opacity-0 data-[scrolling]:opacity-100 data-[scrolling]:duration-0',
        revealOnHover && 'data-[hovering]:opacity-100',
        orientation === 'vertical' && 'h-full w-1.5 p-px',
        orientation === 'horizontal' && 'h-1.5 w-full flex-col p-px',
        className,
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-muted-foreground/30 hover:bg-muted-foreground/60" />
    </ScrollAreaPrimitive.Scrollbar>
  );
}

export { ScrollArea, ScrollAreaViewport, ScrollBar };
