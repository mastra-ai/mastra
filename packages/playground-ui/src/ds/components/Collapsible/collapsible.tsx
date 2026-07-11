import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import React from 'react';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

type CollapsibleTriggerProps = Omit<CollapsiblePrimitive.Trigger.Props, 'className'> & {
  className?: string;
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
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
    // Base UI animates the panel's `height` between 0 and `--collapsible-panel-height`.
    // Padding/margin/borders must live on an inner wrapper — if applied to the panel
    // itself they keep it from collapsing to 0, which makes the animation jump.
    <CollapsiblePrimitive.Panel
      ref={ref}
      data-slot="collapsible-content"
      className={cn(
        'overflow-hidden',
        'h-[var(--collapsible-panel-height)] transition-[height] duration-normal ease-out-custom',
        'data-[starting-style]:h-0 data-[ending-style]:h-0',
      )}
      {...props}
    >
      <div className={className}>{children}</div>
    </CollapsiblePrimitive.Panel>
  ),
);
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
