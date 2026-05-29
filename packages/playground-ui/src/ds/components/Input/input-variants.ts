import { cva } from 'class-variance-authority';

import {
  formElementSizes,
  inputOutlineAndFocusStyle,
  inputSurfaceAndFocusStyle,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export const inputVariants = cva(
  cn(
    'flex w-full text-neutral6 border bg-transparent',
    'transition-all duration-normal ease-out-custom',
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
    // type="number": hide native browser spinner arrows (they clip the pill).
    // For incrementable numeric inputs, compose <InputGroup> with +/- buttons
    // instead — see the NumberWithStepper story. WebKit uses the spin-button
    // pseudo-elements; Firefox needs `appearance: textfield` on the input.
    '[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0',
    '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0',
    '[&[type=number]]:[appearance:textfield]',
    // type="search": drop WebKit's native clear button so it doesn't double up with a
    // custom trailingIcon clear control (keeps type="search" semantics intact).
    '[&::-webkit-search-cancel-button]:appearance-none',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusStyle, 'rounded-full', sharedFormElementDisabledStyle),
        filled: cn(inputSurfaceAndFocusStyle, 'rounded-full', sharedFormElementDisabledStyle),
        outline: cn(inputOutlineAndFocusStyle, 'rounded-full', sharedFormElementDisabledStyle),
        unstyled: unstyledFormElementStyle,
      },
      size: {
        sm: `${formElementSizes.sm} text-ui-sm px-[.75em]`,
        md: `${formElementSizes.md} text-ui-md px-[.75em]`,
        default: `${formElementSizes.default} text-ui-md px-[.85em]`,
        lg: `${formElementSizes.lg} text-ui-lg px-[.85em]`,
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
