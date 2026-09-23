import type { ComponentProps, ElementType } from 'react';
import { cn } from '@/lib/utils';

export type SectionHeadingProps = ComponentProps<'h2'> & {
  headingLevel?: 'h2' | 'h3' | 'h4';
};

export function SectionHeading({ headingLevel = 'h2', children, className, ...props }: SectionHeadingProps) {
  const HeadingTag: ElementType = headingLevel;

  return (
    <HeadingTag
      data-slot="section-heading"
      className={cn(
        'group-data-[variant=default]/section:flex group-data-[variant=default]/section:items-center group-data-[variant=default]/section:gap-2 group-data-[variant=default]/section:text-subheading group-data-[variant=default]/section:text-muted-foreground group-data-[variant=default]/section:[&>svg]:size-[1.2em] group-data-[variant=default]/section:[&>svg]:opacity-50',
        'group-data-[variant=flat]/section:text-subheading group-data-[variant=flat]/section:text-balance group-data-[variant=flat]/section:text-foreground',
        'group-data-[variant=factory]/section:text-subheading group-data-[variant=factory]/section:text-balance group-data-[variant=factory]/section:text-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </HeadingTag>
  );
}
