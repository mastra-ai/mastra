import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type SectionContentProps = ComponentProps<'div'>;

export function SectionContent({ className, ...props }: SectionContentProps) {
  return (
    <div
      data-slot="section-content"
      className={cn(
        'group-data-[variant=factory]/section:overflow-hidden group-data-[variant=factory]/section:rounded-xl',
        'group-data-[variant=factory]/section:bg-card group-data-[variant=factory]/section:shadow-raised',
        className,
      )}
      {...props}
    />
  );
}
