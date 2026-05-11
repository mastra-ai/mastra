import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { formElementSizes } from '@/ds/primitives/form-element';
import type { FormElementSize } from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

type Orientation = 'horizontal' | 'vertical';

const ButtonsGroupOrientationContext = React.createContext<Orientation>('horizontal');

const buttonsGroupVariants = cva(
  // Elevate the focused child's border above its siblings so it isn't clipped in close-spacing.
  cn('flex', '[&>*:focus-visible]:relative [&>*:focus-visible]:z-10'),
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
        // Skip separators when collapsing borders so they stay visible.
        className: cn(
          '[&>*:not(:last-child)]:rounded-r-none',
          '[&>*:not(:first-child)]:rounded-l-none',
          '[&>*:not([data-slot=buttons-group-separator]):not(:first-child)]:-ml-px',
        ),
      },
      {
        orientation: 'vertical',
        spacing: 'close',
        // Children carry `rounded-full` (capsule) which looks awkward when stacked vertically.
        // Replace the outer corners with a regular `rounded-xl` and flatten the inner ones.
        className: cn(
          '[&>*:not(:last-child)]:rounded-b-none',
          '[&>*:not(:first-child)]:rounded-t-none',
          '[&>:first-child]:rounded-t-xl',
          '[&>:last-child]:rounded-b-xl',
          '[&>*:not([data-slot=buttons-group-separator]):not(:first-child)]:-mt-px',
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
    'inline-flex items-center justify-center bg-surface3 border border-border1 text-neutral5 select-none',
    'rounded-full gap-[.75em] px-[1em]',
    '[&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:opacity-50',
  ),
  {
    variants: {
      size: {
        sm: `${formElementSizes.sm} text-ui-sm`,
        md: `${formElementSizes.md} text-ui-md`,
        default: `${formElementSizes.default} text-ui-md`,
        lg: `${formElementSizes.lg} text-ui-lg`,
      },
    },
    defaultVariants: {
      size: 'default',
    },
  },
);

export type ButtonsGroupTextProps = React.ComponentPropsWithoutRef<'div'> & {
  size?: FormElementSize;
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
