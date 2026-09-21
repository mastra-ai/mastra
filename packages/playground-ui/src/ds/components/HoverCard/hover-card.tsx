import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import type { PreviewCardPopupProps, PreviewCardPositionerProps } from '@base-ui/react/preview-card';
import * as React from 'react';

import { FLOATING_POSITION_METHOD } from '@/ds/primitives/floating';
import { overlaySurfaceStyle } from '@/ds/primitives/raised-surface';
import { cn } from '@/lib/utils';

const HoverCard = PreviewCardPrimitive.Root;

export type HoverCardTriggerProps = Omit<PreviewCardPrimitive.Trigger.Props, 'className'> & {
  className?: string;
};

const HoverCardTrigger = React.forwardRef<HTMLAnchorElement, HoverCardTriggerProps>(
  ({ className, delay = 250, ...props }, ref) => (
    <PreviewCardPrimitive.Trigger ref={ref} delay={delay} className={className} {...props} />
  ),
);
HoverCardTrigger.displayName = 'HoverCardTrigger';

type HoverCardContentPositionerProps = Omit<PreviewCardPositionerProps, keyof PreviewCardPopupProps>;

export type HoverCardContentProps = Omit<PreviewCardPopupProps, 'className'> &
  HoverCardContentPositionerProps & {
    className?: string;
    container?: HTMLElement | null;
    showArrow?: boolean;
  };

const HoverCardContent = React.forwardRef<HTMLDivElement, HoverCardContentProps>(
  (
    {
      className,
      children,
      side = 'top',
      align,
      sideOffset = 5,
      container,
      showArrow = true,
      anchor,
      positionMethod = FLOATING_POSITION_METHOD,
      alignOffset,
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
    const positionerProps: HoverCardContentPositionerProps = {
      side,
      align,
      sideOffset,
      anchor,
      positionMethod,
      alignOffset,
      collisionBoundary,
      collisionPadding,
      sticky,
      arrowPadding,
      disableAnchorTracking,
      collisionAvoidance,
    };

    return (
      <PreviewCardPrimitive.Portal container={container ?? undefined}>
        <PreviewCardPrimitive.Positioner className="z-50 data-[anchor-hidden]:hidden" {...positionerProps}>
          <PreviewCardPrimitive.Popup
            ref={ref}
            className={cn(
              'max-w-100 w-auto origin-[var(--transform-origin)] rounded-xl px-3 py-2.5 text-caption text-foreground',
              overlaySurfaceStyle,
              'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
              'motion-reduce:data-[open]:animate-none motion-reduce:data-[closed]:animate-none',
              className,
            )}
            {...props}
          >
            {children}
            {showArrow && <PreviewCardPrimitive.Arrow className="fill-popover" />}
          </PreviewCardPrimitive.Popup>
        </PreviewCardPrimitive.Positioner>
      </PreviewCardPrimitive.Portal>
    );
  },
);
HoverCardContent.displayName = 'HoverCardContent';

export { HoverCard, HoverCardTrigger, HoverCardContent };
