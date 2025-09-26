import { cn } from '@/lib/utils';
import React from 'react';

type CodeSectionHeaderProps = {
  title?: string;
  headingLevel?: 'h2' | 'h3';
  children: React.ReactNode;
  className?: string;
};

export function CodeSectionHeader({ title, headingLevel = 'h2', children, className }: CodeSectionHeaderProps) {
  return (
    <div
      className={cn(
        'p-[1rem] px-[1.5rem] border-b border-border1 grid items-center',
        {
          ' grid-cols-[1fr_auto]': title && React.Children.count(children) > 0,
        },
        className,
      )}
    >
      {title ? (
        <>
          {title}
          <div>{children}</div>
        </>
      ) : (
        children
      )}
    </div>
  );
}
