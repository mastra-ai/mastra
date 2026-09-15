import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type SectionDescriptionProps = ComponentProps<'p'>;

export function SectionDescription({ className, ...props }: SectionDescriptionProps) {
  return (
    <p
      data-slot="section-description"
      className={cn('max-w-[62ch] text-ui-sm leading-ui-sm text-pretty text-neutral3', className)}
      {...props}
    />
  );
}
