import React from 'react';
import { focusRing, transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export interface AccordionProps extends React.DetailsHTMLAttributes<HTMLDetailsElement> {
  /**
   * Optional shared name. Multiple `<Accordion>`s with the same `name`
   * behave as an exclusive accordion group per the HTML spec — opening
   * one collapses the others. Falls back to independent toggling in
   * browsers without `<details name>` support.
   */
  name?: string;
}

const Accordion = React.forwardRef<HTMLDetailsElement, AccordionProps>(({ className, children, ...props }, ref) => (
  <details
    ref={ref}
    className={cn('group rounded-xl border border-border1 bg-surface3 overflow-hidden', className)}
    {...props}
  >
    {children}
  </details>
));
Accordion.displayName = 'Accordion';

export type AccordionSummaryProps = React.HTMLAttributes<HTMLElement>;

const AccordionSummary = React.forwardRef<HTMLElement, AccordionSummaryProps>(
  ({ className, children, ...props }, ref) => (
    <summary
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-2 px-5 py-3',
        'cursor-pointer select-none',
        'text-ui-sm font-medium text-neutral6',
        'bg-surface3 group-open:bg-surface4',
        '[&::-webkit-details-marker]:hidden marker:hidden list-none',
        transitions.colors,
        focusRing.visible,
        className,
      )}
      {...props}
    >
      {children}
    </summary>
  ),
);
AccordionSummary.displayName = 'AccordionSummary';

export type AccordionContentProps = React.HTMLAttributes<HTMLDivElement>;

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('px-5 py-3 border-t border-border1 bg-surface4 text-ui-sm text-neutral5', className)}
      {...props}
    >
      {children}
    </div>
  ),
);
AccordionContent.displayName = 'AccordionContent';

export { Accordion, AccordionSummary, AccordionContent };
