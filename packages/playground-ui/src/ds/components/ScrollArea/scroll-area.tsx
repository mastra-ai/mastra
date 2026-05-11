import { ScrollArea as ScrollAreaPrimitive } from '@base-ui/react/scroll-area';
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

const MASK_CLASSES =
  'data-[overflow-y-start]:mask-t-from-[calc(100%-2rem)] data-[overflow-y-end]:mask-b-from-[calc(100%-2rem)] data-[overflow-x-start]:mask-l-from-[calc(100%-2rem)] data-[overflow-x-end]:mask-r-from-[calc(100%-2rem)]';

const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
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

    return (
      <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <ScrollAreaPrimitive.Viewport
          ref={areaRef}
          className={cn('h-full w-full rounded-[inherit]', showMask && MASK_CLASSES, viewPortClassName)}
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
ScrollArea.displayName = 'ScrollArea';

const ScrollBar = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>>(
  ({ className, orientation = 'vertical', ...props }, ref) => (
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
  ),
);
ScrollBar.displayName = 'ScrollBar';

export { ScrollArea, ScrollBar };
