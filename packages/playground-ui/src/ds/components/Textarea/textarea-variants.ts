import { cva } from 'class-variance-authority';

import {
  inputOutlineAndFocusStyle,
  inputSurfaceAndFocusStyle,
  sharedFormElementDisabledStyle,
  unstyledFormElementStyle,
} from '@/ds/primitives/form-element';
import { cn } from '@/lib/utils';

export const textareaVariants = cva(
  cn(
    // Base styles with enhanced transitions
    'flex w-full text-neutral6 border bg-transparent',
    'transition-all duration-normal ease-out-custom',
    // Better placeholder styling
    'placeholder:text-neutral2 placeholder:transition-opacity placeholder:duration-normal',
    'focus:placeholder:opacity-70',
    // Textarea specific
    'min-h-[80px] resize-y',
  ),
  {
    variants: {
      variant: {
        default: cn(inputSurfaceAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        filled: cn(inputSurfaceAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        outline: cn(inputOutlineAndFocusStyle, 'rounded-xl', sharedFormElementDisabledStyle),
        unstyled: unstyledFormElementStyle,
      },
      // Text tokens mirror the Input size scale (sm→ui-sm, md/default→ui-md, lg→ui-lg)
      // so a Textarea reads at the same size as a sibling Input.
      size: {
        sm: 'px-2 py-1.5 text-ui-sm',
        md: 'px-3 py-2 text-ui-md',
        default: 'px-3 py-2 text-ui-md',
        lg: 'px-4 py-3 text-ui-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);
