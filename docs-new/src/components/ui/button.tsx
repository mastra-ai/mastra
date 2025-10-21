import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import React from 'react';

import { cn } from '@site/src/css/utils';

const buttonVariants = cva(
  'inline-flex font-sans rounded-md items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-(--mastra-green-accent) disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-white text-black hover:bg-primary/90',
        secondary:
          'bg-[rgba(255,255,255,0.06)]  border-[0.5px] border-[#393939] text-secondary-foreground shadow-sm hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        slim: 'h-6 pl-[0.38rem] pr-[0.44rem] text-xs [&_svg]:size-3',
        sm: 'h-8 px-3',
      },
      weight: {
        default: 'font-normal',
        medium: 'font-medium',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
      weight: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, popover, weight, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, weight, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
