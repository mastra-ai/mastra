import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import React from 'react';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

type CollapsibleTriggerProps = Omit<CollapsiblePrimitive.Trigger.Props, 'className'> & {
  className?: string;
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
  /**
   * `form`: for an optional section inside a form or dialog body (Advanced, Request Context): a chevron
   * that turns while open, then muted label text, flush with the fields around it.
   * `default`: headers, rows and cards; they lay themselves out.
   */
  variant?: 'default' | 'form';
};

// Control height, so the row lines up with buttons beside it (e.g. in a dialog footer).
const formTriggerClass = cn(
  // gap spaces the text from a trailing badge; the chevron's -mr-0.5 leaves ~9px from its ink to the text.
  'inline-flex h-control-md w-fit cursor-pointer items-center gap-1.5 text-label text-muted-foreground',
  // Flush with the content around it, so the focus ring sits outside the box instead of over the glyphs.
  'rounded-sm focus-visible:outline-offset-2',
);

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ className, asChild, variant = 'default', children, ...props }, ref) => {
    const renderProps = asChild && React.isValidElement(children) ? { render: children as React.ReactElement } : {};
    const form = variant === 'form' && !asChild;

    return (
      <CollapsiblePrimitive.Trigger
        ref={ref}
        data-slot="collapsible-trigger"
        data-variant={variant}
        className={cn(
          '-outline-offset-2',
          transitions.colors,
          focusRing,
          'hover:text-foreground',
          // A DisclosureChevron child takes the 16px icon size, like a Button's icons. `:where()` keeps it at
          // zero specificity, so a size class on the chevron still wins.
          '[:where(&_[data-slot=disclosure-chevron])]:size-icon-md',
          form && formTriggerClass,
          className,
        )}
        {...renderProps}
        {...props}
      >
        {/*
          Line the chevron's ink up with the glyphs of the labels around it, which start ~1px inside their box.
          Closed, the ink sits 5.3px inside the 16px icon box; turned 90° it is wider and sits 3.3px in, so
          the open chevron shifts 2px right to stay on the same edge.
        */}
        {form ? (
          <DisclosureChevron
            direction="right"
            className="-mr-0.5 -ml-[4.3px] size-icon-md in-aria-expanded:translate-x-[2px]"
          />
        ) : null}
        {asChild ? undefined : children}
      </CollapsiblePrimitive.Trigger>
    );
  },
);
CollapsibleTrigger.displayName = 'CollapsibleTrigger';

type CollapsibleContentProps = Omit<CollapsiblePrimitive.Panel.Props, 'className'> & {
  className?: string;
  /** Stretch the content to the space its parent leaves, so a scroll area inside can fill it. */
  fill?: boolean;
};

const panelClassNames = {
  measured:
    'duration-normal h-[var(--collapsible-panel-height)] transition-[height] ease-out-custom data-[ending-style]:h-0 data-[starting-style]:h-0',
  fill: 'duration-normal grid min-h-0 grid-rows-[1fr] transition-[grid-template-rows] ease-out-custom data-[ending-style]:grid-rows-[0fr] data-[starting-style]:grid-rows-[0fr]',
};

const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, children, fill = false, ...props }, ref) => (
    // Base UI animates the panel's `height` between 0 and `--collapsible-panel-height`.
    // Padding/margin/borders must live on an inner wrapper — if applied to the panel
    // itself they keep it from collapsing to 0, which makes the animation jump.
    <CollapsiblePrimitive.Panel
      ref={ref}
      data-slot="collapsible-content"
      className={cn('overflow-hidden', fill ? panelClassNames.fill : panelClassNames.measured)}
      {...props}
    >
      <div className={cn(fill && 'min-h-0 overflow-hidden', className)}>{children}</div>
    </CollapsiblePrimitive.Panel>
  ),
);
CollapsibleContent.displayName = 'CollapsibleContent';

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
