import type { ComponentPropsWithoutRef } from 'react';

import { PageHeaderDescription } from './page-header-description';
import { PageHeaderIcon } from './page-header-icon';
import { PageHeaderTitle } from './page-header-title';
import { cn } from '@/lib/utils';

export interface PageHeaderRootProps extends Omit<ComponentPropsWithoutRef<'header'>, 'title'> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export function PageHeaderRoot({
  children,
  className,
  title,
  description,
  icon,
  isLoading,
  ...props
}: PageHeaderRootProps) {
  const useLegacyApi = children === undefined && title !== undefined;

  return (
    <header
      className={cn('relative grid w-full grid-cols-[auto_minmax(0,1fr)_auto] gap-x-3 gap-y-1', className)}
      {...props}
    >
      {useLegacyApi ? (
        <>
          {icon !== undefined && <PageHeaderIcon>{icon}</PageHeaderIcon>}
          <PageHeaderTitle isLoading={isLoading}>{title}</PageHeaderTitle>
          {description !== undefined && (
            <PageHeaderDescription isLoading={isLoading}>{description}</PageHeaderDescription>
          )}
        </>
      ) : (
        children
      )}
    </header>
  );
}
