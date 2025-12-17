import { cn } from '@/lib/utils';
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost';
  isFaded?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'outline', isFaded, ...props }: ButtonProps, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'text-[.875rem] inline-flex items-center justify-center rounded-lg px-[1rem] gap-[.75rem] leading-0 border bg-transparent text-[rgba(255,255,255,0.7)] whitespace-nowrap',
          '[&:not(:disabled):hover]:border-[rgba(255,255,255,0.25)] [&:not(:disabled):hover]:text-[rgba(255,255,255,0.9)]',
          '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:mx-[-0.3em] [&>svg]:opacity-70 [&>svg]:shrink-0',
          'focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(24,251,111,0.75)]',
          className,
          {
            'cursor-not-allowed opacity-50': props.disabled,
            'bg-ui-primaryBtnBg text-ui-primaryBtnText hover:bg-surface6 leading-[0] font-semibold':
              variant === 'primary',
            'min-h-[2rem]': variant === 'ghost',
            'min-h-[2.5rem]': variant !== 'ghost',
            'border-[rgba(255,255,255,0.15)]': variant === 'outline',
            'opacity-40': isFaded,
          },
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
