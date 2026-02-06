import React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/ds/components/Skeleton';

export type MainHeaderProps = {
  children: React.ReactNode;
  className?: string;
  withMargins?: boolean;
};

function MainHeaderRoot({ children, className, withMargins = true }: MainHeaderProps) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-4',
        {
          'py-6': withMargins,
        },
        className,
      )}
    >
      {children}
    </header>
  );
}

export type MainHeaderColumnProps = {
  children: React.ReactNode;
  className?: string;
};

function MainHeaderColumn({ children, className }: MainHeaderColumnProps) {
  return <div className={cn('flex flex-col gap-1', className)}>{children}</div>;
}

export type MainHeaderTitleProps = {
  children: React.ReactNode;
  isLoading?: boolean;
  size?: 'default' | 'smaller';
};

function MainHeaderTitle({ children, isLoading, size = 'default' }: MainHeaderTitleProps) {
  if (isLoading) {
    return <Skeleton className="h-6 w-48" />;
  }

  return (
    <h1
      className={cn('text-neutral6 font-normal flex items-center gap-2 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:text-neutral3', {
        'text-xl': size === 'default',
        'text-base': size === 'smaller',
      })}
    >
      {children}
    </h1>
  );
}

export type MainHeaderDescriptionProps = {
  children: React.ReactNode;
  isLoading?: boolean;
};

function MainHeaderDescription({ children, isLoading }: MainHeaderDescriptionProps) {
  if (isLoading) {
    return <Skeleton className="h-4 w-64" />;
  }

  return <div className="text-neutral3 text-ui-sm flex items-center gap-4 flex-wrap">{children}</div>;
}

export const MainHeader = Object.assign(MainHeaderRoot, {
  Column: MainHeaderColumn,
  Title: MainHeaderTitle,
  Description: MainHeaderDescription,
});
