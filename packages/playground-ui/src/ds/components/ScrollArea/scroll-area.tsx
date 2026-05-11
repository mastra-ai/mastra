import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
import * as React from 'react';

import { useAutoscroll } from '@/hooks/use-autoscroll';
import { cn } from '@/lib/utils';

type Orientation = 'vertical' | 'horizontal' | 'both';

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

export type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  viewPortClassName?: string;
  maxHeight?: string;
  autoScroll?: boolean;
  orientation?: Orientation;
  /** Fade content at the edges where it's clipped by overflow. Defaults to the axes matching `orientation`. */
  mask?: ScrollAreaMask;
  /** @deprecated Use `mask` instead. Retained for backward compatibility. */
  showMask?: boolean;
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

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  (
    {
      className,
      children,
      viewPortClassName,
      maxHeight,
      autoScroll = false,
      orientation = 'vertical',
      mask,
      showMask,
      ...props
    },
    ref,
  ) => {
    const areaRef = React.useRef<HTMLDivElement>(null);
    useAutoscroll(areaRef, { enabled: autoScroll });

    const effectiveMask: ScrollAreaMask | undefined = mask !== undefined ? mask : showMask;
    const sides = resolveMask(effectiveMask, orientation);

    return (
      <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <ScrollAreaPrimitive.Viewport
          ref={areaRef}
          className={cn('h-full w-full rounded-[inherit]', maskClasses(sides), viewPortClassName)}
          style={maxHeight ? { maxHeight } : undefined}
        >
          <ScrollAreaPrimitive.Content>{children}</ScrollAreaPrimitive.Content>
        </ScrollAreaPrimitive.Viewport>
        {(orientation === 'vertical' || orientation === 'both') && <ScrollBar orientation="vertical" />}
        {(orientation === 'horizontal' || orientation === 'both') && <ScrollBar orientation="horizontal" />}
        {orientation === 'both' && <ScrollAreaPrimitive.Corner />}
      </ScrollAreaPrimitive.Root>
    );
  },
);
ScrollArea.displayName = 'ScrollArea';

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-opacity duration-normal ease-out-custom',
      'opacity-0 data-[hovering]:opacity-100 data-[scrolling]:opacity-100 data-[scrolling]:duration-0',
      orientation === 'vertical' && 'h-full w-1.5 p-px',
      orientation === 'horizontal' && 'h-1.5 w-full flex-col p-px',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-neutral4/30 hover:bg-neutral4/60 transition-colors duration-normal" />
  </ScrollAreaPrimitive.Scrollbar>
));
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
