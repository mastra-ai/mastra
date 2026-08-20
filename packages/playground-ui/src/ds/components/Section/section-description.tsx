import type { ComponentPropsWithoutRef } from 'react';
import { useSectionVariant } from './section-context';
import { cn } from '@/lib/utils';

export type SectionDescriptionProps = ComponentPropsWithoutRef<'p'>;

export function SectionDescription({ className, ...props }: SectionDescriptionProps) {
  const variant = useSectionVariant();

  return (
    <p
      data-slot="section-description"
      className={cn(
        'max-w-[62ch] text-pretty text-neutral3',
        variant === 'default' && 'text-ui-md leading-ui-md',
        variant === 'flat' && 'mt-1.5 text-ui-md leading-ui-md',
        variant === 'factory' && 'mt-1.5 text-ui-md leading-ui-md',
        className,
      )}
      {...props}
    />
  );
}
