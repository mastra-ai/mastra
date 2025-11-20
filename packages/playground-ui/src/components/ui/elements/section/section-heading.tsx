import { cn } from '@/lib/utils';
import React from 'react';

type SectionHeadingProps = {
  headingLevel?: 'h2' | 'h3' | 'h4';
  children: React.ReactNode;
  className?: string;
};

export function SectionHeading({ headingLevel = 'h2', children, className }: SectionHeadingProps) {
  const HeadingTag = headingLevel;

  return (
    <HeadingTag
      className={cn(
        'flex items-center gap-[0.5em] text-[0.9375rem] font-bold text-icon4',
        '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-50',
        className,
      )}
    >
      {children}
    </HeadingTag>
  );
}
