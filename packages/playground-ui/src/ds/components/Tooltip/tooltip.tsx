'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { TooltipPopupProps, TooltipPositionerProps } from '@base-ui/react/tooltip';
import * as React from 'react';

import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
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
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
};

const TooltipTrigger = React.forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  ({ asChild, render, children, ...props }, ref) => {
    if (asChild && React.isValidElement(children)) {
      return <TooltipPrimitive.Trigger ref={ref} render={children} {...props} />;
    }
    return (
      <TooltipPrimitive.Trigger ref={ref} render={render} {...props}>
        {children}
      </TooltipPrimitive.Trigger>
    );
  },
);
TooltipTrigger.displayName = 'TooltipTrigger';

type TooltipContentPositionerProps = Omit<TooltipPositionerProps, keyof TooltipPopupProps>;

type TooltipContentProps = TooltipPopupProps & TooltipContentPositionerProps;

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
  (
    {
      className,
      side = 'top',
      sideOffset = 8,
      align = 'center',
      alignOffset = 0,
      arrowPadding = 10,
      anchor,
      positionMethod = FLOATING_POSITION_METHOD,
      collisionBoundary,
      collisionPadding,
      sticky,
      disableAnchorTracking,
      collisionAvoidance,
      children,
      ...props
    },
    ref,
  ) => {
    const positionerProps: TooltipContentPositionerProps = {
      side,
      sideOffset,
      align,
      alignOffset,
      arrowPadding,
      anchor,
      positionMethod,
      collisionBoundary,
      collisionPadding,
      sticky,
      disableAnchorTracking,
      collisionAvoidance,
    };

    return (
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner className="isolate z-100" {...positionerProps}>
          <TooltipPrimitive.Popup
            ref={ref}
            // Base UI omits the tooltip role queried by existing consumers.
            role="tooltip"
            className={cn(
              'relative z-100 flex origin-(--transform-origin) flex-col rounded-lg px-2.5 py-1.5 text-caption text-foreground transition-[transform,scale,opacity] duration-150',
              overlaySurfaceStyle,
              'data-[starting-style]:scale-95 data-[starting-style]:opacity-0',
              'data-[ending-style]:scale-95 data-[ending-style]:opacity-0',
              'data-[instant]:transition-none motion-reduce:transition-none',
              className,
            )}
            {...props}
          >
            {children}
            <TooltipPrimitive.Arrow
              className={cn(
                'flex',
                'data-[side=top]:-bottom-[7px] data-[side=top]:rotate-180',
                'data-[side=bottom]:-top-[7px]',
                'data-[side=left]:right-[-9px] data-[side=left]:rotate-90',
                'data-[side=right]:left-[-9px] data-[side=right]:-rotate-90',
              )}
            >
              <TooltipArrowSvg />
            </TooltipPrimitive.Arrow>
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    );
  },
);
TooltipContent.displayName = 'TooltipContent';

// The arrow is the popup's edge, continued: same fill, and a stroke on the one
// rim the overlay material draws. It overlaps that edge by a pixel so its base
// band paints over the rim, which is inset and would otherwise run straight
// across the arrow's mouth.
function TooltipArrowSvg() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" overflow="visible">
      <path d="M0 7L4 2Q6 0 8 2L12 7L12 8L0 8Z" className="fill-card" />
      <path
        d="M0 7.5L4 2.5Q6 0.5 8 2.5L12 7.5"
        className="fill-none [stroke:var(--surface-rim)]"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
