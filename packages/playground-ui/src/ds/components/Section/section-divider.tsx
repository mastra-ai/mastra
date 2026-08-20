import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

export type SectionDividerProps = ComponentPropsWithoutRef<'div'>;

export function SectionDivider({ className, ...props }: SectionDividerProps) {
  return <div role="separator" aria-orientation="horizontal" className={cn('h-px bg-border1', className)} {...props} />;
}
