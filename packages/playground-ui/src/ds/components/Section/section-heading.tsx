import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { useSectionVariant } from './section-context';
import { cn } from '@/lib/utils';

export type SectionHeadingProps = ComponentPropsWithoutRef<'h2'> & {
  headingLevel?: 'h2' | 'h3' | 'h4';
};

export function SectionHeading({ headingLevel = 'h2', children, className, ...props }: SectionHeadingProps) {
  const variant = useSectionVariant();
  const HeadingTag: ElementType = headingLevel;

  return (
    <HeadingTag
      data-slot="section-heading"
      className={cn(
        variant === 'default' && [
          'flex items-center gap-2 text-ui-lg font-bold text-neutral4',
          '[&>svg]:size-[1.2em] [&>svg]:opacity-50',
        ],
        variant === 'flat' && 'text-ui-lg leading-ui-lg font-medium text-balance text-neutral5',
        variant === 'factory' && 'text-ui-lg leading-ui-lg font-semibold text-balance text-neutral5',
        className,
      )}
      {...props}
    >
      {children}
    </HeadingTag>
  );
}
