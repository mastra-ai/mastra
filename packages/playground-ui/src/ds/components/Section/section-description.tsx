import type { ComponentProps } from 'react';
import { cn } from '../../../lib/utils';
import { Txt } from '../Txt';

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
