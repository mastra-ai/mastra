'use client';

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip';
import type { TooltipPopupProps, TooltipPositionerProps } from '@base-ui/react/tooltip';
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
      positionMethod,
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
            // Base UI's Popup omits `role="tooltip"` by default (only the trigger
            // gets `aria-describedby`). Radix used to set it on Content, and our
            // consumers query via `getByRole('tooltip')`, so set it explicitly.
            role="tooltip"
            className={cn(
              'relative z-100 flex origin-(--transform-origin) flex-col rounded-lg border border-border1 bg-surface3 px-2.5 py-1.5 text-ui-sm leading-ui-sm text-neutral5 shadow-dialog transition-[transform,scale,opacity] duration-150',
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
                'data-[side=top]:-bottom-2 data-[side=top]:rotate-180',
                'data-[side=bottom]:-top-2',
                'data-[side=left]:right-[-10px] data-[side=left]:rotate-90',
                'data-[side=right]:left-[-10px] data-[side=right]:-rotate-90',
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

// Triangle with a rounded apex. The stroke endpoints land on the popup border
// center (popup_top + 0.5 with `border border-border1`), so the arrow outline
// merges cleanly with the popup border without a horizontal extension that
// would overlap and thicken the border at the join.
function TooltipArrowSvg() {
  return (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" overflow="visible">
      <path d="M0 7L4 2Q6 0 8 2L12 7L12 8L0 8Z" className="fill-surface3" />
      <path
        d="M0 7.5L4 2.5Q6 0.5 8 2.5L12 7.5"
        className="fill-none stroke-border1"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
