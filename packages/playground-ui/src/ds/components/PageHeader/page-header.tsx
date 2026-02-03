import React from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title?: string | 'loading';
  description?: string | 'loading';
  icon?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, className }: PageHeaderProps) {
  const titleIsLoading = title === 'loading';
  const descriptionIsLoading = description === 'loading';

  return (
    <header className={cn('grid gap-2 pt-8 pb-8', className)}>
      <h1
        className={cn(
          'text-neutral6 text-xl font-normal flex items-center gap-2',
          '[&>svg]:w-6 [&>svg]:h-6 [&>svg]:text-neutral3',
          {
            'bg-surface4 w-60 max-w-[50%] rounded-md animate-pulse': titleIsLoading,
          },
        )}
      >
        {titleIsLoading ? (
          <>&nbsp;</>
        ) : (
          <>
            {icon && icon} {title}
          </>
        )}
      </h1>
      {description && (
        <p
          className={cn('text-neutral4 text-sm m-0', {
            'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': descriptionIsLoading,
          })}
        >
          {descriptionIsLoading ? <>&nbsp;</> : description}
        </p>
      )}
    </header>
  );
}
