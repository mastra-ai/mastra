import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import React from 'react';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

type CollapsibleTriggerProps = Omit<CollapsiblePrimitive.Trigger.Props, 'className'> & {
  className?: string;
  asChild?: boolean;
};

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ className, asChild, children, ...props }, ref) => {
    const renderProps = asChild && React.isValidElement(children) ? { render: children as React.ReactElement } : {};

    return (
      <CollapsiblePrimitive.Trigger
        ref={ref}
        data-slot="collapsible-trigger"
        className={cn(
          '-outline-offset-2',
          transitions.colors,
          focusRing.visible,
          'hover:text-neutral5',
          '[&>svg]:transition-transform [&>svg]:duration-normal [&>svg]:ease-out-custom',
          '[&[data-panel-open]>svg]:rotate-90',
          className,
        )}
        {...renderProps}
        {...props}
      >
        {asChild ? undefined : children}
      </CollapsiblePrimitive.Trigger>
    );
  },
);
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

type CollapsibleContentProps = Omit<CollapsiblePrimitive.Panel.Props, 'className'> & {
  className?: string;
};

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, ...props }, ref) => (
    <CollapsiblePrimitive.Panel
      ref={ref}
      data-slot="collapsible-content"
      className={cn(
        'overflow-hidden',
        'h-[var(--collapsible-panel-height)] transition-[height] duration-normal ease-out-custom',
        'data-[starting-style]:h-0 data-[ending-style]:h-0',
        className,
      )}
      {...props}
    >
      {children}
    </CollapsiblePrimitive.Panel>
  ),
);
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
