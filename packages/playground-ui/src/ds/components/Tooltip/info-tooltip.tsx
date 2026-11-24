import * as React from 'react';

import { InfoTooltipPanel } from './info-tooltip-panel';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';
import type { TooltipContentProps } from './tooltip';
import { IconCircleInfo } from '@/ds/icons/central/IconCircleInfo';
import { Icon } from '@/ds/icons/Icon';
import { controlStateColorTransition, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

type InfoTooltipProps = {
  /** The explanation shown in the tooltip, and read to screen readers as the icon's description. */
  children: React.ReactNode;
  side?: TooltipContentProps['side'];
  align?: TooltipContentProps['align'];
  variant?: InfoTooltipVariant;
  /** Layout of the tooltip body, such as a wider `max-w-*` or `space-y-*` for rich content. */
  contentClassName?: string;
} &
  /** What the icon is about, e.g. "Version information": an icon-only button needs a name. */
  ({ 'aria-label': string; 'aria-labelledby'?: never } | { 'aria-label'?: never; 'aria-labelledby': string });

type InfoTooltipVariant = 'text' | 'illustrated';

const contentVariantClasses = {
  text: 'max-w-64',
  illustrated: 'w-80 max-w-(--available-width) p-3',
} satisfies Record<InfoTooltipVariant, string>;

/** A muted info icon that explains the thing next to it in a tooltip, on hover or keyboard focus. */
function InfoTooltipRoot({ children, side, align, variant = 'text', contentClassName, ...name }: InfoTooltipProps) {
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);
  const tap = React.useRef<{ wasOpen: boolean }>(undefined);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const alignToLabel = variant === 'illustrated' && align === undefined;

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        ref={triggerRef}
        onPointerDown={event => {
          tap.current = event.pointerType === 'touch' ? { wasOpen: open } : undefined;
          if (tap.current) event.preventBaseUIHandler();
        }}
        onClick={event => {
          const touch = tap.current;
          tap.current = undefined;
          if (!touch) return;
          event.preventBaseUIHandler();
          setOpen(!touch.wasOpen);
        }}
        render={
          <button
            type="button"
            {...name}
            // The popup stays mounted (hidden) while closed, so screen readers always get the text.
            aria-describedby={descriptionId}
            // A step quieter than the placeholder grey at rest, so it reads as a hint, not a control.
            className={cn(
              'relative flex shrink-0 cursor-default items-center rounded-full text-subtle-foreground hover:text-muted-foreground focus-visible:text-muted-foreground',
              "pointer-coarse:before:absolute pointer-coarse:before:-inset-1.5 pointer-coarse:before:content-['']",
              controlStateColorTransition,
              focusRing,
            )}
          />
        }
      >
        <Icon size="xs">
          <IconCircleInfo />
        </Icon>
      </TooltipTrigger>
      <TooltipContent
        id={descriptionId}
        keepMounted
        side={side ?? (variant === 'illustrated' ? 'bottom' : 'top')}
        align={alignToLabel ? 'start' : align}
        alignOffset={
          alignToLabel
            ? ({ side: placedSide, positioner }) => {
                const trigger = triggerRef.current;
                const label = trigger?.parentElement?.firstElementChild;
                if (!trigger || !label || placedSide === 'left' || placedSide === 'right') return 0;
                const toLabel = label.getBoundingClientRect().left - trigger.getBoundingClientRect().left;
                return Math.max(toLabel, 24 - positioner.width);
              }
            : undefined
        }
        className={cn(contentVariantClasses[variant], contentClassName)}
      >
        {variant === 'illustrated' ? (
          <div className="grid auto-cols-fr grid-flow-col gap-x-4 gap-y-1.5">{children}</div>
        ) : (
          children
        )}
      </TooltipContent>
    </Tooltip>
  );
}

const InfoTooltip = Object.assign(InfoTooltipRoot, { Panel: InfoTooltipPanel });

export { InfoTooltip };
export type { InfoTooltipProps, InfoTooltipVariant };
