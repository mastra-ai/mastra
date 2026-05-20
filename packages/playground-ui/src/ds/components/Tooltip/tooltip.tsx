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

type TooltipTriggerProps = TooltipPrimitive.Trigger.Props & {
  /** Radix-style alias for Base UI's native `render` prop. */
  asChild?: boolean;
};

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, children, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-lg border border-border1 bg-surface3 px-2.5 py-1.5 text-ui-sm leading-ui-sm text-neutral5 shadow-dialog animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        className,
      )}
      {...props}
    >
      {children}
      <TooltipPrimitive.Arrow className="fill-surface3" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
