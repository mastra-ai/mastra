import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { controlSizeClasses } from '@/ds/primitives/control-size';
import type { ControlSize } from '@/ds/primitives/control-size';
import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';

const ButtonsGroupOrientationContext = React.createContext<Orientation>('horizontal');

const buttonsGroupVariants = cva(
  // Lift the hovered/focused segment so its full border paints over the collapsed seam (else a
  // neighbour clips a side / the seam ignores the active colour). Use `:focus-visible`, NOT
  // `:focus-within`: a mouse click leaves a plain `:focus` on a button, which would otherwise
  // keep its seam border highlighted until blur. `:has(:focus-visible)` covers a nested
  // focusable (the <input> inside an InputGroup); text inputs match :focus-visible on click too,
  // which is the wanted behaviour for a field.
  cn(
    'flex',
    '[&>*:hover]:relative [&>*:hover]:z-10',
    '[&>*:focus-visible]:relative [&>*:focus-visible]:z-10',
    '[&>*:has(:focus-visible)]:relative [&>*:has(:focus-visible)]:z-10',
  ),
  {
    variants: {
      orientation: {
        horizontal: 'flex-row items-center',
        vertical: 'flex-col items-stretch',
      },
      spacing: {
        default: 'gap-2',
        close: 'gap-0',
      },
    },
    compoundVariants: [
      {
        orientation: 'horizontal',
        spacing: 'close',
        // Flatten inner corners. A segment rounds its right edge off having a *real* segment
        // somewhere after it (general sibling `~`, not `:not(:last-child)` and not adjacent
        // `+`). This survives non-segment children that frameworks inject between/around the
        // real ones: Base UI's trailing `<input aria-hidden>` (Select), and the visually
        // -hidden focus guards (`[data-base-ui-focus-guard]`) + positioner anchor (`[aria-owns]`)
        // a Menu/Popover inserts while OPEN — without this a DropdownMenu split-button seam
        // breaks the moment the menu opens. The same ignore-list is applied to every seam rule.
        className: cn(
          '[&>*:has(~_*:not([aria-hidden=true]):not([data-base-ui-focus-guard]):not([aria-owns]))]:rounded-r-none',
          '[&>*:not(:first-child):not([aria-hidden=true]):not([data-base-ui-focus-guard]):not([aria-owns])]:rounded-l-none',
          // One-line seam: `-ml-px` overlaps adjacent borders onto the same pixel. Filled
          // segments (opaque bg: default/primary buttons, the text chip) keep their own
          // border — the bg hides the neighbour's. Transparent/outline segments null their
          // left border at rest (so the neighbour's shows without doubling) and reveal it on
          // hover / keyboard-focus, where the z-10 lift paints the complete border on top.
          '[&>*:not([data-slot=buttons-group-separator]):not([aria-hidden=true]):not([data-base-ui-focus-guard]):not([aria-owns]):not(:first-child)]:-ml-px',
          '[&>*:not([data-slot=buttons-group-separator]):not([data-slot=buttons-group-text]):not([data-variant=default]):not([data-variant=primary]):not([aria-hidden=true]):not([data-base-ui-focus-guard]):not([aria-owns]):not(:first-child):not(:hover):not(:focus-visible):not(:has(:focus-visible))]:border-l-transparent',
          // `primary` is filled but borderless — give it (only) an inset-shadow divider.
          '[&>[data-variant=primary]:not([aria-hidden=true]):not(:first-child)]:shadow-[inset_1px_0_0_0_var(--color-border1)]',
          // Animate only colour/bg so the seam + ring snap (no fade desynced from the z-10 drop).
          '[&>*:not([data-slot=buttons-group-separator]):not([aria-hidden=true])]:transition-[color,background-color]',
          // Group owns sizing (no consumer width classes): fill on flex/InputGroup/input,
          // content-width on a Select trigger (descendant rule beats the trigger's `w-full`).
          '[&>[data-slot=select-trigger]]:w-fit [&>[data-slot=select-trigger]]:flex-none',
          '[&>input]:flex-1',
        ),
      },
      {
        orientation: 'vertical',
        spacing: 'close',
        // Children are capsules (rounded-full); re-round the outer ends to rounded-xl and
        // flatten the touching ones. Unlike the horizontal block, these use plain structural
        // selectors (no aria-hidden / data-base-ui-focus-guard / aria-owns ignore-list): vertical
        // close-spacing is only used with plain buttons, so it never hosts a Select/DropdownMenu
        // that injects guard siblings. Mirror the horizontal ignore-list here if one ever does.
        className: cn(
          '[&>*:not(:last-child)]:rounded-b-none',
          '[&>*:not(:first-child)]:rounded-t-none',
          '[&>:first-child]:rounded-t-xl',
          '[&>:last-child]:rounded-b-xl',
          '[&>*:not([data-slot=buttons-group-separator]):not(:first-child)]:-mt-px',
          '[&>*:not([data-slot=buttons-group-separator]):not([data-slot=buttons-group-text]):not([data-variant=default]):not([data-variant=primary]):not(:first-child):not(:hover):not(:focus-visible):not(:has(:focus-visible))]:border-t-transparent',
          '[&>[data-variant=primary]:not(:first-child)]:shadow-[inset_0_1px_0_0_var(--color-border1)]',
          '[&>*:not([data-slot=buttons-group-separator])]:transition-[color,background-color]',
        ),
      },
    ],
    defaultVariants: {
      orientation: 'horizontal',
      spacing: 'default',
    },
  },
);

// Derive variant types from cva (single source of truth) and strip `null` that cva injects.
type ButtonsGroupVariantsProps = VariantProps<typeof buttonsGroupVariants>;
export type ButtonsGroupSpacing = NonNullable<ButtonsGroupVariantsProps['spacing']>;

export type ButtonsGroupProps = React.ComponentPropsWithoutRef<'div'> & {
  orientation?: Orientation;
  spacing?: ButtonsGroupSpacing;
};

export const ButtonsGroup = React.forwardRef<HTMLDivElement, ButtonsGroupProps>(
  ({ children, className, orientation = 'horizontal', spacing = 'default', ...props }, ref) => {
    return (
      <ButtonsGroupOrientationContext.Provider value={orientation}>
        <div
          ref={ref}
          role="group"
          data-slot="buttons-group"
          data-orientation={orientation}
          className={cn(buttonsGroupVariants({ orientation, spacing }), className)}
          {...props}
        >
          {children}
        </div>
      </ButtonsGroupOrientationContext.Provider>
    );
  },
);
ButtonsGroup.displayName = 'ButtonsGroup';

export type ButtonsGroupSeparatorProps = React.ComponentPropsWithoutRef<'div'> & {
  orientation?: Orientation;
};

export const ButtonsGroupSeparator = React.forwardRef<HTMLDivElement, ButtonsGroupSeparatorProps>(
  ({ className, orientation, ...props }, ref) => {
    const parentOrientation = React.useContext(ButtonsGroupOrientationContext);
    // Separator runs perpendicular to the group flow by default.
    const resolved = orientation ?? (parentOrientation === 'vertical' ? 'horizontal' : 'vertical');
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={resolved}
        data-slot="buttons-group-separator"
        className={cn('self-stretch bg-border1', resolved === 'vertical' ? 'w-px' : 'h-px', className)}
        {...props}
      />
    );
  },
);
ButtonsGroupSeparator.displayName = 'ButtonsGroupSeparator';

const buttonsGroupTextVariants = cva(
  cn(
    'inline-flex items-center justify-center border border-border1 bg-surface3 text-neutral5 select-none',
    'shrink-0 gap-[.75em] rounded-full px-[1em] whitespace-nowrap',
    '[&>svg]:size-[1.1em] [&>svg]:opacity-50',
  ),
  {
    variants: {
      size: {
        xs: controlSizeClasses.xs,
        sm: controlSizeClasses.sm,
        md: controlSizeClasses.md,
        default: controlSizeClasses.default,
        lg: controlSizeClasses.lg,
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

export type ButtonsGroupTextProps = React.ComponentPropsWithoutRef<'div'> & {
  size?: ControlSize;
};

export const ButtonsGroupText = React.forwardRef<HTMLDivElement, ButtonsGroupTextProps>(
  ({ className, size = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="buttons-group-text"
        className={cn(buttonsGroupTextVariants({ size }), className)}
        {...props}
      />
    );
  },
);
ButtonsGroupText.displayName = 'ButtonsGroupText';

export { buttonsGroupVariants };
