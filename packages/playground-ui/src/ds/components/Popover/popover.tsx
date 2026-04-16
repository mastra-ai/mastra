import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

const PopoverTrigger = PopoverPrimitive.Trigger;

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
        'z-50 w-72 rounded-xl border-2 border-border1/50 bg-surface3 text-neutral5 shadow-md focus-visible:outline-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
        className && /\bp[trblxy]?-\S+/.test(className) ? false : `py-3.5 px-3`,
        className,
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

function HoverPopover({ children, ...props }: PopoverPrimitive.PopoverProps) {
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
