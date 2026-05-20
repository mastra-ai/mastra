import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

type PopoverTriggerProps = PopoverPrimitive.Trigger.Props & {
  asChild?: boolean;
};

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = 'center', sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        'z-50 w-72 rounded-xl border border-border1 bg-surface3 text-neutral5 shadow-dialog focus-visible:outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        className && /\bp[trblxy]?-\S+/.test(className) ? false : `py-3.5 px-3`,
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

    return (
      <PopoverPrimitive.Trigger ref={ref} {...renderProps} {...props}>
        {asChild ? undefined : children}
      </PopoverPrimitive.Trigger>
    );
  },
);
PopoverTrigger.displayName = 'PopoverTrigger';

type PopoverContentProps = PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>;

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ className, align = 'center', alignOffset = 0, side = 'bottom', sideOffset = 4, ...props }, ref) => {
    const classNameString = typeof className === 'string' ? className : undefined;

    return (
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          align={align}
          alignOffset={alignOffset}
          side={side}
          sideOffset={sideOffset}
          className="z-50 outline-none"
        >
          <PopoverPrimitive.Popup
            ref={ref}
            data-slot="popover-content"
            className={cn(
              'z-50 w-72 rounded-xl border border-border1 bg-surface3 text-neutral5 shadow-dialog focus-visible:outline-hidden origin-[var(--transform-origin)]',
              'data-[open]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:fade-in-0 data-[closed]:zoom-out-95 data-[open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
              classNameString && /\bp[trblxy]?-\S+/.test(classNameString) ? false : `py-3.5 px-3`,
              className,
            )}
            {...props}
          />
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    );
  },
);
PopoverContent.displayName = 'PopoverContent';

function HoverPopover({
  children,
  ...props
}: Omit<React.ComponentProps<typeof Popover>, 'children'> & { children?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleOpen = React.useCallback(() => {
    clearTimeout(timeoutRef.current);
    setOpen(true);
  }, []);

  const handleClose = React.useCallback(() => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  }, []);

  React.useEffect(() => () => clearTimeout(timeoutRef.current), []);

  return (
    <Popover open={open} onOpenChange={setOpen} {...props}>
      <span
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocusCapture={handleOpen}
        onBlurCapture={handleClose}
        style={{ display: 'contents' }}
      >
        {children}
      </span>
    </Popover>
  );
}

export { Popover, PopoverTrigger, PopoverContent, HoverPopover };
