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

export function ButtonsGroup({ children, className, spacing = 'default' }: ButtonsGroupProps) {
  return (
    <div
      className={cn(
        `flex gap-2 items-center`,
        {
          'gap-0 [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:-ml-px':
            spacing === 'close',
        },
        className,
      )}
    >
      {children}
    </div>
  );
}
