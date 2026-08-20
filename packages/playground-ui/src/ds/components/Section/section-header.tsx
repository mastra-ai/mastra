import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type SectionHeaderProps = ComponentProps<'header'>;

export function SectionHeader({ children, className, ...props }: SectionHeaderProps) {
  return (
    <header
      data-slot="section-header"
      className={cn(
        'group-data-[variant=default]/section:grid group-data-[variant=default]/section:grid-cols-[1fr_auto] group-data-[variant=default]/section:items-center',
        'group-data-[variant=flat]/section:flex group-data-[variant=flat]/section:min-w-0 group-data-[variant=flat]/section:flex-col group-data-[variant=flat]/section:gap-4 group-data-[variant=flat]/section:px-4 group-data-[variant=flat]/section:pb-4 sm:group-data-[variant=flat]/section:flex-row sm:group-data-[variant=flat]/section:items-start sm:group-data-[variant=flat]/section:justify-between sm:group-data-[variant=flat]/section:gap-6',
        'group-data-[variant=factory]/section:flex group-data-[variant=factory]/section:min-w-0 group-data-[variant=factory]/section:flex-col group-data-[variant=factory]/section:gap-2 group-data-[variant=factory]/section:px-4 sm:group-data-[variant=factory]/section:flex-row sm:group-data-[variant=factory]/section:items-start sm:group-data-[variant=factory]/section:justify-between sm:group-data-[variant=factory]/section:gap-4',
        className,
      )}
      {...props}
    >
      {children}
    </header>
  );
}
