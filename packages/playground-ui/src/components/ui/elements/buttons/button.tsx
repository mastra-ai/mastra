import { cn } from '@/lib/utils';
import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  as?: React.ElementType;
  className?: string;
  href?: string;
  to?: string;
  prefetch?: boolean | null;
  children: React.ReactNode;
  variant?: 'primary' | 'outline' | 'ghost';
  target?: string;
}

export const Button = ({ className, as, variant = 'outline', ...props }: ButtonProps) => {
  const Component = as || 'button';

  return (
    <Component
      className={cn(
        'text-[.875rem] inline-flex items-center justify-center rounded-lg px-[1rem] gap-[.75rem] leading-0 border bg-transparent text-[rgba(255,255,255,0.7)]',
        '[&:not(:disabled):hover]:border-[rgba(255,255,255,0.25)] [&:not(:disabled):hover]:text-[rgba(255,255,255,0.9)]',
        '[&>svg]:w-[1em] [&>svg]:h-[1em] [&>svg]:mx-[-0.3em] [&>svg]:opacity-70',
        className,
        {
          'cursor-not-allowed opacity-50': props.disabled,
          'bg-ui-primaryBtnBg text-ui-primaryBtnText hover:bg-surface6 leading-[0] font-semibold':
            variant === 'primary',
          'min-h-[2rem]': variant === 'ghost',
          'min-h-[2.5rem]': variant !== 'ghost',
          'border-[rgba(255,255,255,0.15)]': variant === 'outline',
        },
      )}
      {...props}
    />
  );
};
