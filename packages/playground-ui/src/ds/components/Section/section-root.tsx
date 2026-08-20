import type { ComponentPropsWithoutRef } from 'react';
import { SectionProvider, type SectionVariant } from './section-context';
import { cn } from '@/lib/utils';

export type SectionRootProps = ComponentPropsWithoutRef<'section'> & {
  variant?: SectionVariant;
};

export function SectionRoot({ variant = 'default', children, className, ...props }: SectionRootProps) {
  return (
    <SectionProvider value={variant}>
      <section
        data-slot="section"
        data-variant={variant}
        className={cn(
          variant === 'default' && 'grid gap-4',
          variant === 'flat' && 'min-w-0',
          variant === 'factory' && 'flex min-w-0 flex-col gap-2',
          className,
        )}
        {...props}
      >
        {children}
      </section>
    </SectionProvider>
  );
}

export function SubSectionRoot({ children, className, ...props }: ComponentPropsWithoutRef<'section'>) {
  return (
    <section className={cn('grid gap-2', className)} {...props}>
      {children}
    </section>
  );
}
