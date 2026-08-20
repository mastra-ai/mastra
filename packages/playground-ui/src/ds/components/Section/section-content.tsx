import type { ComponentPropsWithoutRef } from 'react';
import { useSectionVariant } from './section-context';
import { cn } from '@/lib/utils';

export type SectionContentProps = ComponentPropsWithoutRef<'div'>;

export function SectionContent({ className, ...props }: SectionContentProps) {
  const variant = useSectionVariant();

  return (
    <div
      data-slot="section-content"
      className={cn(variant === 'factory' && 'overflow-hidden rounded-xl border border-border1 bg-surface3', className)}
      {...props}
    />
  );
}
