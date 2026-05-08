import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as React from 'react';

import { useAutoscroll } from '@/hooks/use-autoscroll';
import { cn } from '@/lib/utils';

export type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  viewPortClassName?: string;
  maxHeight?: string;
  autoScroll?: boolean;
  orientation?: 'vertical' | 'horizontal' | 'both';
  /** Fade content at the edges where it's clipped by overflow. */
  showMask?: boolean;
};

// Reflects scroll position as data attributes so consumers can style edges
// (e.g. fade masks) only when there's clipped content past the viewport.
function useScrollOverflowAttrs(ref: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const { scrollTop, scrollLeft, scrollHeight, scrollWidth, clientHeight, clientWidth } = el;
      el.toggleAttribute('data-overflow-y-start', scrollTop > 0);
      el.toggleAttribute('data-overflow-y-end', scrollTop + clientHeight < scrollHeight - 1);
      el.toggleAttribute('data-overflow-x-start', scrollLeft > 0);
      el.toggleAttribute('data-overflow-x-end', scrollLeft + clientWidth < scrollWidth - 1);
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const inner = el.firstElementChild;
    if (inner) ro.observe(inner);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [ref]);
}

const MASK_CLASSES =
  'data-[overflow-y-start]:mask-t-from-[calc(100%-2rem)] data-[overflow-y-end]:mask-b-from-[calc(100%-2rem)] data-[overflow-x-start]:mask-l-from-[calc(100%-2rem)] data-[overflow-x-end]:mask-r-from-[calc(100%-2rem)]';

const ScrollArea = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  (
    {
      className,
      children,
      viewPortClassName,
      maxHeight,
      autoScroll = false,
      orientation = 'vertical',
      showMask = false,
      ...props
    },
    ref,
  ) => {
    const areaRef = React.useRef<HTMLDivElement>(null);
    useAutoscroll(areaRef, { enabled: autoScroll });
    useScrollOverflowAttrs(areaRef);

    return (
      <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <ScrollAreaPrimitive.Viewport
          ref={areaRef}
          className={cn('h-full w-full rounded-[inherit] [&>div]:block!', showMask && MASK_CLASSES, viewPortClassName)}
          style={maxHeight ? { maxHeight } : undefined}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        {(orientation === 'vertical' || orientation === 'both') && <ScrollBar orientation="vertical" />}
        {(orientation === 'horizontal' || orientation === 'both') && <ScrollBar orientation="horizontal" />}
        {orientation === 'both' && <ScrollAreaPrimitive.Corner />}
      </ScrollAreaPrimitive.Root>
    );
  },
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-all duration-normal ease-out-custom',
      'opacity-0 hover:opacity-100 data-[state=visible]:opacity-100',
      orientation === 'vertical' && 'h-full w-1.5 p-px',
      orientation === 'horizontal' && 'h-1.5 w-full flex-col p-px',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-neutral4/30 hover:bg-neutral4/60 transition-colors duration-normal" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
