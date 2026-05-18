'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

type TooltipProviderProps = Omit<TooltipPrimitive.Provider.Props, 'delay' | 'timeout'> & {
  delay?: number;
  timeout?: number;
  /** Radix API compatibility alias for `delay`. */
  delayDuration?: number;
  /** Radix API compatibility alias for `timeout`. */
  skipDelayDuration?: number;
};

function TooltipProvider({ delay, delayDuration, timeout, skipDelayDuration, ...props }: TooltipProviderProps) {
  const resolvedDelay = delay ?? delayDuration;
  const resolvedTimeout = timeout ?? skipDelayDuration;
  return (
    <TooltipPrimitive.Provider
      {...(resolvedDelay !== undefined ? { delay: resolvedDelay } : {})}
      {...(resolvedTimeout !== undefined ? { timeout: resolvedTimeout } : {})}
      {...props}
    />
  );
}

const Tooltip = TooltipPrimitive.Root;

type TooltipTriggerProps = Omit<TooltipPrimitive.Trigger.Props, 'render'> & {
  asChild?: boolean;
};

const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  ({ asChild, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return <TooltipPrimitive.Trigger ref={ref} render={children} {...props} />;
    }
    return (
      <TooltipPrimitive.Trigger ref={ref} {...props}>
        {children}
      </TooltipPrimitive.Trigger>
    );
  },
);
TooltipTrigger.displayName = 'TooltipTrigger';

type TooltipContentProps = TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, 'side' | 'sideOffset' | 'align' | 'alignOffset'>;

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  ({ className, side = 'top', sideOffset = 8, align = 'center', alignOffset = 0, children, ...props }, ref) => (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        arrowPadding={10}
      >
        <TooltipPrimitive.Popup
          ref={ref}
          className={cn(
            'relative z-50 flex flex-col origin-(--transform-origin) rounded-lg outline-1 outline-border1 bg-surface3 px-2.5 py-1.5 text-ui-sm leading-ui-sm text-neutral5 shadow-dialog transition-[transform,scale,opacity] duration-150 dark:-outline-offset-1',
            'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
            'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
            'data-[instant]:transition-none',
            className,
          )}
          {...props}
        >
          {children}
          <TooltipPrimitive.Arrow
            className={cn(
              'flex',
              'data-[side=top]:-bottom-1.5 data-[side=top]:rotate-180',
              'data-[side=bottom]:-top-1.5',
              'data-[side=left]:-right-[9px] data-[side=left]:rotate-90',
              'data-[side=right]:-left-[9px] data-[side=right]:-rotate-90',
            )}
          >
            <TooltipArrowSvg />
          </TooltipPrimitive.Arrow>
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  ),
);
TooltipContent.displayName = 'TooltipContent';

function TooltipArrowSvg() {
  return (
    <svg width="12" height="6" viewBox="0 0 12 6" fill="none" overflow="visible">
      <path d="M0 6L6 0L12 6Z" className="fill-surface3" />
      <path
        d="M0 6L6 0L12 6"
        className="fill-none stroke-border1"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
