import { Popover as PopoverPrimitive } from '@base-ui/react/popover';
import type { PopoverPopupProps, PopoverPositionerProps } from '@base-ui/react/popover';
import * as React from 'react';

import { usePortalContainer } from '@/ds/primitives/portal-container';
import { asChildRenderProps } from '@/lib/as-child';
import { cn } from '@/lib/utils';

const Popover = PopoverPrimitive.Root;

type PopoverTriggerProps = PopoverPrimitive.Trigger.Props & {
  /** @deprecated Use Base UI's `render` prop instead, e.g. `render={<Button />}`. */
  asChild?: boolean;
};

const PopoverTrigger = React.forwardRef<HTMLButtonElement, PopoverTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    return (
      <PopoverPrimitive.Trigger ref={ref} {...asChildRenderProps(asChild, children)} {...props}>
        {asChild ? undefined : children}
      </PopoverPrimitive.Trigger>
    );
  },
);
PopoverTrigger.displayName = 'PopoverTrigger';

type PopoverContentPositionerProps = Omit<PopoverPositionerProps, keyof PopoverPopupProps>;

type PopoverContentProps = PopoverPopupProps &
  PopoverContentPositionerProps & {
    /** Optional portal container, forwarded to `Popover.Portal`. */
    container?: HTMLElement | null;
  };

const PopoverContent = React.forwardRef<HTMLDivElement, PopoverContentProps>(
  (
    {
      className,
      container,
      align = 'center',
      alignOffset = 0,
      side = 'bottom',
      sideOffset = 4,
      anchor,
      positionMethod,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
      ...props
    },
    ref,
  ) => {
    const classNameString = typeof className === 'string' ? className : undefined;
    // Default to the nearest SideDialog/Drawer popup so the content stays
    // interactive inside a modal drawer; an explicit `container` still wins.
    const resolvedContainer = usePortalContainer(container);
    const positionerProps: PopoverContentPositionerProps = {
      align,
      alignOffset,
      side,
      sideOffset,
      anchor,
      positionMethod,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
    };

    return (
      <PopoverPrimitive.Portal container={resolvedContainer}>
        <PopoverPrimitive.Positioner className="z-50 outline-none" {...positionerProps}>
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
