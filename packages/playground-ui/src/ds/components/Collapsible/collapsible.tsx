import { Collapsible as CollapsiblePrimitive } from '@base-ui/react/collapsible';
import React from 'react';
import { DisclosureChevron } from '@/ds/components/DisclosureChevron';
import { transitions, focusRing } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const Collapsible = CollapsiblePrimitive.Root;

type CollapsibleChevronSize = 'xs' | 'sm' | 'md';

type CollapsibleTriggerProps = Omit<CollapsiblePrimitive.Trigger.Props, 'className'> & {
  className?: string;
  /** @deprecated Use Base UI's native `render` prop instead for stronger composition typing. */
  asChild?: boolean;
} & (
    | {
        /** Default: unstyled, the caller lays it out. */
        variant?: 'default';
        /**
         * Adds the built-in chevron (points right, turns 90° while open) before or after the children.
         * It takes the trigger's text color; the caller's className sets the gap and typography.
         */
        chevron?: 'start' | 'end';
        /** Icon size token for the chevron: 12, 14 or 16px (default `md`). */
        chevronSize?: CollapsibleChevronSize;
      }
    | {
        /**
         * `disclosure`: a ready-made toggle row: a chevron that turns while open, then muted label text,
         * flush with the content around it. While open it stretches into a section divider: a hairline
         * fills the rest of the row.
         */
        variant: 'disclosure';
        chevron?: never;
        chevronSize?: never;
      }
  );

const chevronSizeClass: Record<CollapsibleChevronSize, string> = {
  xs: 'size-icon-xs',
  sm: 'size-icon-sm',
  md: 'size-icon-md',
};

// Control height, so the row lines up with buttons beside it (e.g. in a dialog footer). Open, it
// takes the full width and draws the divider hairline after its content.
const disclosureTriggerClass = cn(
  // gap spaces the text from a trailing badge; the chevron's -mr-1 leaves ~7px from its ink to the text.
  'inline-flex h-control-md w-fit cursor-pointer items-center gap-1.5 text-label text-muted-foreground',
  // Flush with the content around it, so the focus ring sits outside the box instead of over the glyphs.
  'rounded-sm focus-visible:outline-offset-2',
  'aria-expanded:w-full aria-expanded:after:ml-2 aria-expanded:after:h-px aria-expanded:after:flex-1 aria-expanded:after:bg-border',
);

const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ className, asChild, variant = 'default', chevron, chevronSize = 'md', children, ...props }, ref) => {
    const renderProps = asChild && React.isValidElement(children) ? { render: children as React.ReactElement } : {};
    const disclosure = variant === 'disclosure' && !asChild;
    const plainChevron =
      chevron && !asChild ? <DisclosureChevron direction="right" className={chevronSizeClass[chevronSize]} /> : null;

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
          disclosure && disclosureTriggerClass,
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
        {disclosure ? (
          <DisclosureChevron
            direction="right"
            className="-mr-1 -ml-[4.3px] size-icon-md in-aria-expanded:translate-x-[2px]"
          />
        ) : null}
        {chevron === 'start' ? plainChevron : null}
        {asChild ? undefined : children}
        {chevron === 'end' ? plainChevron : null}
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
