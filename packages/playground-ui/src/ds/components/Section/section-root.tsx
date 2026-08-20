import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type SectionVariant = 'default' | 'flat' | 'factory';

export type SectionRootProps = ComponentProps<'section'> & {
  variant?: SectionVariant;
};

export function SectionRoot({ variant = 'default', children, className, ...props }: SectionRootProps) {
  return (
    <section
      data-slot="section"
      data-variant={variant}
      className={cn(
        'group/section',
        variant === 'default' && 'grid gap-4',
        variant === 'flat' && 'w-full min-w-0',
        variant === 'factory' && 'flex w-full min-w-0 flex-col gap-2',
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function SubSectionRoot({ children, className, ...props }: ComponentProps<'section'>) {
  return (
    <section className={cn('grid gap-2', className)} {...props}>
      {children}
    </section>
  );
}
