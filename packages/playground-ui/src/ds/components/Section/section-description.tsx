import type { ComponentProps } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

export type SectionDescriptionProps = ComponentProps<'p'>;

export function SectionDescription({ className, ...props }: SectionDescriptionProps) {
  return (
    <Txt
      variant="caption"
      tone="muted"
      data-slot="section-description"
      className={cn('max-w-[62ch] text-pretty', className)}
      {...props}
    />
  );
}
