import * as React from 'react';
import { Button } from '@/ds/components/Button';
import type { ButtonProps } from '@/ds/components/Button';

export type MetricsCardActionProps = Omit<ButtonProps, 'variant' | 'size' | 'tooltip' | 'aria-label'> & {
  /** Names the button, for its tooltip and screen readers ("View in traces", "Pin Agent runs"). */
  label: string;
  /** The button's icon. */
  children: React.ReactNode;
};

/**
 * An icon button in a card's `MetricsCard.Actions`. The card is a `group/metrics-card`, so a button
 * that should wait for the card's hover or focus says so with its classes: `className={onCardHover}`.
 * Without them it stays in view, e.g. a pinned widget's unpin button.
 */
export const MetricsCardAction = React.forwardRef<HTMLElement, MetricsCardActionProps>(
  ({ label, children, ...props }, ref) => (
    <Button ref={ref} variant="ghost" size="icon-sm" tooltip={label} aria-label={label} {...props}>
      {children}
    </Button>
  ),
);
MetricsCardAction.displayName = 'MetricsCardAction';
