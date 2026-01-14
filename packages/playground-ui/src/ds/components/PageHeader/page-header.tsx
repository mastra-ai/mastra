import clsx from 'clsx';
import React from 'react';

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
    <header className={clsx('grid gap-2 pt-8 pb-8', className)}>
      <h1
        className={clsx(
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
          className={clsx('text-neutral4 text-sm m-0', {
            'bg-surface4 w-[40rem] max-w-[80%] rounded-md animate-pulse': descriptionIsLoading,
          })}
        >
          {descriptionIsLoading ? <>&nbsp;</> : description}
        </p>
      )}
    </header>
  );
}
