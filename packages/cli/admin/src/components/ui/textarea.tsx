import { VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

// remove null values from the cva variants
type NoUndefinedField<T> = { [P in keyof T]-?: NoUndefinedField<NonNullable<T[P]>> };

export const textareaVariants = cva(
  'bg-transparent ring-offset-background text-text-dim placeholder:text-text-dim rounded-md focus-visible:ring-ring focus-visible:ring-1 flex min-h-[80px] w-full text-sm focus-visible:outline-none  disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border border-thin-gray placeholder-gray focus-visible:ring-1 focus-visible:ring-offset-2',
        noBorderAndFocus:
          'ring-offset-none rounded-none border-none bg-transparent focus-visible:border-0 focus-visible:ring-0 focus-visible:ring-offset-0',
        minimal:
          'border border-[#353535] placeholder-[#353535] bg-[#252525] text-text focus:border-primary/10 ring-offset-0 ring-offset-transparent ring-transparent focus-visible:ring-0 focus:visible:ring-ring-transparent',
        ghost: '',
      },
      size: {
        sm: 'px-3 py-2',
        lg: 'px-5 pl-2 py-6 pt-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'sm',
    },
  },
);
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    NoUndefinedField<VariantProps<typeof textareaVariants>> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, variant, size, ...props }, ref) => {
  return <textarea className={cn(textareaVariants({ variant, size }), className)} ref={ref} {...props} />;
});
Textarea.displayName = 'Textarea';

export { Textarea };
