import { Children, isValidElement } from 'react';
import type { ComponentPropsWithoutRef } from 'react';

import { PageHeaderAction } from './page-header-action';
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

  // Actions sit outside the title grid so their height never affects title/meta/description alignment.
  const items = Children.toArray(children);
  const actions = items.filter(child => isValidElement(child) && child.type === PageHeaderAction);
  const content = items.filter(child => !actions.includes(child));

  return (
    <header className={cn('relative flex w-full items-start gap-3', className)} {...props}>
      <div
        data-slot="page-header-grid"
        className={cn(
          'grid min-w-0 flex-1 grid-cols-[[title]_auto_[meta]_minmax(0,1fr)_[end]] gap-x-3 gap-y-1',
          'has-[>[data-slot=page-header-icon]]:grid-cols-[[icon]_auto_[title]_auto_[meta]_minmax(0,1fr)_[end]]',
        )}
      >
        {useLegacyApi ? (
          <>
            {!isLoading && icon !== undefined && <PageHeaderIcon>{icon}</PageHeaderIcon>}
            <PageHeaderTitle isLoading={isLoading}>{title}</PageHeaderTitle>
            {description !== undefined && (
              <PageHeaderDescription isLoading={isLoading}>{description}</PageHeaderDescription>
            )}
          </>
        ) : (
          content
        )}
      </div>
      {actions}
    </header>
  );
}
