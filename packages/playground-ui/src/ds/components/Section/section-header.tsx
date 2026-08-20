import type { ComponentPropsWithoutRef } from 'react';
import { useSectionVariant } from './section-context';
import { cn } from '@/lib/utils';

export type SectionHeaderProps = ComponentPropsWithoutRef<'header'>;

export function SectionHeader({ children, className, ...props }: SectionHeaderProps) {
  const variant = useSectionVariant();

  return (
    <header
      data-slot="section-header"
      className={cn(
        variant === 'default' && 'grid grid-cols-[1fr_auto] items-center',
        variant === 'flat' &&
          'flex min-w-0 flex-col gap-4 px-1 pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
        variant === 'factory' && 'flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}
