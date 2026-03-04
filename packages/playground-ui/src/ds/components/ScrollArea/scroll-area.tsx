import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { useAutoscroll } from '@/hooks/use-autoscroll';
import { useHasOverflow } from '@/hooks/use-has-overflow';

export type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  viewPortClassName?: string;
  maxHeight?: string;
  autoScroll?: boolean;
  permanentScrollbar?: boolean;
};

const ScrollArea = React.forwardRef<React.ElementRef<typeof ScrollAreaPrimitive.Root>, ScrollAreaProps>(
  (
    { className, children, viewPortClassName, maxHeight, autoScroll = false, permanentScrollbar = false, ...props },
    ref,
  ) => {
    const areaRef = React.useRef<HTMLDivElement>(null);
    useAutoscroll(areaRef, { enabled: autoScroll });
    const hasOverflow = useHasOverflow(areaRef, permanentScrollbar);

    return (
      <ScrollAreaPrimitive.Root ref={ref} className={cn('relative overflow-hidden', className)} {...props}>
        <ScrollAreaPrimitive.Viewport
          ref={areaRef}
          className={cn(
            'h-full w-full rounded-[inherit] [&>div]:!block',
            hasOverflow && '[&>div]:pr-4',
            viewPortClassName,
          )}
          style={maxHeight ? { maxHeight } : undefined}
        >
          {children}
        </ScrollAreaPrimitive.Viewport>
        <ScrollBar alwaysVisible={permanentScrollbar} />
        <ScrollAreaPrimitive.Corner />
      </ScrollAreaPrimitive.Root>
    );
  },
);
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar> & { alwaysVisible?: boolean }
>(({ className, orientation = 'vertical', alwaysVisible = false, ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    forceMount={alwaysVisible || undefined}
    className={cn(
      'z-50 flex touch-none select-none transition-all duration-normal ease-out-custom',
      !alwaysVisible && 'opacity-0 hover:opacity-100 data-[state=visible]:opacity-100',
      orientation === 'vertical' && 'h-full w-2 border-l border-l-transparent p-px',
      orientation === 'horizontal' && 'h-2 flex-col border-t border-t-transparent p-px',
      className,
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb className="relative flex-1 rounded-full bg-neutral1/50 hover:bg-neutral2 transition-colors duration-normal" />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
