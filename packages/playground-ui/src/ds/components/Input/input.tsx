import { Input as InputPrimitive } from '@base-ui/react/input';
import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { keepOwnAccessibleName } from '@/ds/components/Field/field-control-aria';
import { controlSizeClasses } from '@/ds/primitives/control-size';
import {
  deprecatedErrorAria,
  fieldErrorRim,
  inputSurfaceAndFocusStyle,
  resolveFieldVariant,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import type { DeprecatedFilledVariant } from '@/ds/primitives/form-element';
import { textStyle } from '@/ds/primitives/text';
import type { TextStyleProps } from '@/ds/primitives/text';
import { controlStateColorTransition } from '@/ds/primitives/transitions';
import { cn } from '@/lib/utils';

const inputVariants = cva(
  cn(
    // A text field is a block control: it fills its field. Content-sized controls (a
    // Select or Combobox trigger, a Button) do the opposite and let the call site grow them.
    'flex w-full text-ellipsis text-foreground',
    controlStateColorTransition,
    'placeholder:text-muted-foreground placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70 motion-reduce:placeholder:transition-none',
    // Native number spinners clip the pill; WebKit and Firefox need different selectors.
    '[&::-webkit-outer-spin-button]:m-0 [&::-webkit-outer-spin-button]:appearance-none',
    '[&::-webkit-inner-spin-button]:m-0 [&::-webkit-inner-spin-button]:appearance-none',
    '[&[type=number]]:[appearance:textfield]',
    // type="search": drop WebKit's native clear button so the DS owns the search chrome.
    // Compose an <InputGroup> with an InputGroupButton to add a clear control.
    '[&::-webkit-search-cancel-button]:appearance-none',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusStyle, 'rounded-full', sharedFormElementDisabledStyle),
        unstyled: unstyledFormElementStyle,
      },
      size: {
        sm: cn(controlSizeClasses.sm, 'px-[.75em]'),
        md: cn(controlSizeClasses.md, 'px-[.75em]'),
        lg: cn(controlSizeClasses.lg, 'px-[.85em]'),
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  },
);

export type InputProps = Omit<React.ComponentProps<'input'>, 'size'> &
  Omit<VariantProps<typeof inputVariants>, 'variant'> & {
    /** `filled` is a deprecated alias for `default`; both render the filled surface. */
    variant?: VariantProps<typeof inputVariants>['variant'] | DeprecatedFilledVariant;
    testId?: string;
    textVariant?: TextStyleProps['variant'];
    font?: TextStyleProps['font'];
    /** @deprecated Wrap the control in `<Field invalid>`, or set `aria-invalid` on a control outside a `Field`. */
    error?: boolean;
  };

function Input({ className, size, testId, variant, textVariant, font, error, ...props }: InputProps) {
  return (
    <InputPrimitive
      className={cn(
        inputVariants({ variant: resolveFieldVariant(variant), size }),
        fieldErrorRim,
        textStyle({ variant: textVariant, font }),
        className,
      )}
      data-testid={testId}
      {...deprecatedErrorAria(error)}
      {...props}
      {...keepOwnAccessibleName(props)}
    />
  );
}

export { Input };
