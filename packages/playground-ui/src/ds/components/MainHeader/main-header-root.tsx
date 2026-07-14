import React from 'react';
import { cn } from '@/lib/utils';

export interface MainHeaderRootProps {
  children?: React.ReactNode;
  title?: string | 'loading';
  description?: string | 'loading';
  icon?: React.ReactNode;
  withMargins?: boolean;
  className?: string;
}

export function MainHeaderRoot({
  children,
  title,
  description,
  icon,
  className,
  withMargins = true,
}: MainHeaderRootProps) {
  const titleIsLoading = title === 'loading';
  const descriptionIsLoading = description === 'loading';

  return children ? (
    <header
      className={cn(
        'grid w-full grid-cols-[1fr_auto] gap-16 ',
        {
          'mt-[6vh] mb-[4vh]': withMargins,
        },
        className,
      )}
    >
      {children}
    </header>
  ) : (
    <header className={cn('grid gap-2 py-8 ', className)}>
      <h1
        className={cn(
          'flex items-center gap-2 text-xl font-normal text-neutral6',
          '[&>svg]:size-6 [&>svg]:text-neutral3',
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
          className={cn('m-0 text-sm text-neutral4', {
            'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': descriptionIsLoading,
          })}
        >
          {descriptionIsLoading ? <>&nbsp;</> : description}
        </p>
      )}
    </header>
  );
}
