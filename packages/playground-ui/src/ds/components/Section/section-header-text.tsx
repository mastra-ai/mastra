import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type SectionHeaderTextProps = ComponentProps<'div'>;

export function SectionHeaderText({ className, ...props }: SectionHeaderTextProps) {
  return <div data-slot="section-header-text" className={cn('flex min-w-0 flex-col gap-1.5', className)} {...props} />;
}
