import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import type { PreviewCardPopupProps, PreviewCardPositionerProps } from '@base-ui/react/preview-card';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * HoverCard — a floating card that reveals extra content when its trigger is
 * hovered or focused. Built on Base UI's `PreviewCard`
 * (`@base-ui/react/preview-card`); the `HoverCard` name matches the Radix
 * component this replaced and the common term for the pattern.
 *
 * Compose it as `HoverCard` > (`HoverCardTrigger` + `HoverCardContent`).
 */
const HoverCard = PreviewCardPrimitive.Root;

export type HoverCardTriggerProps = Omit<PreviewCardPrimitive.Trigger.Props, 'className'> & {
  className?: string;
};

/**
 * The element that opens the card on hover/focus. Renders an `<a>` by default;
 * pass `render` to project the behavior onto an existing element.
 *
 * `delay` defaults to 250ms to preserve the previous Radix `openDelay`
 * behavior — Base UI's own default is 600ms.
 */
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
    /** Optional portal container, forwarded to `PreviewCard.Portal`. */
    container?: HTMLElement | null;
    /** Whether to render the small arrow pointing at the trigger. */
    showArrow?: boolean;
  };

/**
 * The floating card body. Wraps Base UI's `Portal` / `Positioner` / `Popup`
 * (and an optional `Arrow`) so consumers only deal with a single element.
 */
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
      positionMethod,
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
        <PreviewCardPrimitive.Positioner className="z-50" {...positionerProps}>
          <PreviewCardPrimitive.Popup
            ref={ref}
            className={cn(
              'max-w-100 w-auto origin-[var(--transform-origin)] rounded-md border border-border1 bg-surface5 p-2 px-4 text-ui-sm text-neutral5',
              'data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95',
              'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
              className,
            )}
            {...props}
          >
            {children}
            {showArrow && <PreviewCardPrimitive.Arrow className="fill-surface5" />}
          </PreviewCardPrimitive.Popup>
        </PreviewCardPrimitive.Positioner>
      </PreviewCardPrimitive.Portal>
    );
  },
);
HoverCardContent.displayName = 'HoverCardContent';

export { HoverCard, HoverCardTrigger, HoverCardContent };
