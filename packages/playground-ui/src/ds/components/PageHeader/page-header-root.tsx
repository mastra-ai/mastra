import React from 'react';
import { PageHeaderDescription } from './page-header-description';
import { PageHeaderTitle } from './page-header-title';
import { cn } from '@/lib/utils';

export interface PageHeaderRootProps {
  children?: React.ReactNode;
  className?: string;
  /**
   * @deprecated Use the compound API with `<PageHeader.Title>` instead. This prop is kept for backward compatibility and will be removed in a future release.
   */
  title?: React.ReactNode;
  /**
   * @deprecated Use the compound API with `<PageHeader.Description>` instead. This prop is kept for backward compatibility and will be removed in a future release.
   */
  description?: React.ReactNode;
  /**
   * @deprecated Use the compound API and place the icon inside `<PageHeader.Title>` instead. This prop is kept for backward compatibility and will be removed in a future release.
   */
  icon?: React.ReactNode;
  /**
   * @deprecated Use the compound API and pass `isLoading` to `<PageHeader.Title>` / `<PageHeader.Description>` instead. This prop is kept for backward compatibility and will be removed in a future release.
   */
  isLoading?: boolean;
}

export function PageHeaderRoot({ children, className, title, description, icon, isLoading }: PageHeaderRootProps) {
  const useLegacyApi = children === undefined && title !== undefined;

  return (
    <header className={cn('w-full grid', className)}>
      {useLegacyApi ? (
        <>
          <PageHeaderTitle isLoading={isLoading}>
            {icon} {title}
          </PageHeaderTitle>
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
