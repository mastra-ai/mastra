import { Accordion as BaseAccordion } from '@base-ui/react/accordion';
import React from 'react';

import { focusRing, transitions } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

export type AccordionProps<Value = string> = Omit<BaseAccordion.Root.Props<Value>, 'render'>;

function AccordionRoot<Value = string>({ className, children, ...props }: AccordionProps<Value>) {
  return (
    <BaseAccordion.Root
      className={cn('flex flex-col rounded-xl border border-border1 bg-surface3 overflow-hidden', className)}
      {...(props as BaseAccordion.Root.Props<Value>)}
    >
      {children}
    </BaseAccordion.Root>
  );
}

export type AccordionItemProps = Omit<BaseAccordion.Item.Props, 'render'>;

const AccordionItem = React.forwardRef<HTMLDivElement, AccordionItemProps>(
  ({ className, children, ...props }, ref) => (
    <BaseAccordion.Item ref={ref} className={cn('flex flex-col', className)} {...props}>
      {children}
    </BaseAccordion.Item>
  ),
);
AccordionItem.displayName = 'AccordionItem';

export type AccordionSummaryProps = Omit<BaseAccordion.Trigger.Props, 'render'>;

const AccordionSummary = React.forwardRef<HTMLButtonElement, AccordionSummaryProps>(
  ({ className, children, ...props }, ref) => (
    <BaseAccordion.Header className="flex shrink-0">
      <BaseAccordion.Trigger
        ref={ref}
        className={cn(
          'group/accordion-summary flex w-full items-center justify-between gap-2 px-5 py-3',
          'cursor-pointer select-none text-left',
          'text-ui-sm font-medium text-neutral6',
          'bg-surface3 data-[panel-open]:bg-surface4',
          transitions.colors,
          focusRing.visible,
          className,
        )}
        {...props}
      >
        {children}
      </BaseAccordion.Trigger>
    </BaseAccordion.Header>
  ),
);
AccordionSummary.displayName = 'AccordionSummary';

export type AccordionContentProps = Omit<BaseAccordion.Panel.Props, 'render'>;

const AccordionContent = React.forwardRef<HTMLDivElement, AccordionContentProps>(
  ({ className, children, ...props }, ref) => (
    <BaseAccordion.Panel
      ref={ref}
      className={cn(
        'border-t border-border1 bg-surface4 text-ui-sm text-neutral5',
        'not-data-open:h-[var(--accordion-panel-height)] not-data-open:overflow-hidden',
        'transition-[height] duration-(--duration-normal) ease-out-custom',
        'data-[starting-style]:h-0 data-[ending-style]:h-0',
        className,
      )}
      {...props}
    >
      {children}
    </BaseAccordion.Panel>
  ),
);
AccordionContent.displayName = 'AccordionContent';

export { AccordionRoot as Accordion, AccordionItem, AccordionSummary, AccordionContent };
