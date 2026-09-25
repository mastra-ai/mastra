import { Children, isValidElement } from 'react';
import type { ComponentPropsWithoutRef } from 'react';

import { PageHeaderAction } from './page-header-action';
import { PageHeaderDescription } from './page-header-description';
import { PageHeaderEyebrow } from './page-header-eyebrow';
import { PageHeaderIcon } from './page-header-icon';
import { PageHeaderMeta } from './page-header-meta';
import type { PageHeaderMetaProps } from './page-header-meta';
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
  const items = useLegacyApi
    ? [
        !isLoading && icon !== undefined && <PageHeaderIcon key="icon">{icon}</PageHeaderIcon>,
        <PageHeaderTitle key="title" isLoading={isLoading}>
          {title}
        </PageHeaderTitle>,
        description !== undefined && (
          <PageHeaderDescription key="description" isLoading={isLoading}>
            {description}
          </PageHeaderDescription>
        ),
      ]
    : Children.toArray(children);

  // Actions sit outside the title column so their height never affects title/meta/description alignment.
  const actions = items.filter(child => isValidElement(child) && child.type === PageHeaderAction);
  const eyebrows = items.filter(child => isValidElement(child) && child.type === PageHeaderEyebrow);
  const icons = items.filter(child => isValidElement(child) && child.type === PageHeaderIcon);
  const headline = items.filter(
    child =>
      isValidElement<PageHeaderMetaProps>(child) &&
      (child.type === PageHeaderTitle || (child.type === PageHeaderMeta && child.props.beside)),
  );
  const below = items.filter(
    child => child !== false && ![...actions, ...eyebrows, ...icons, ...headline].includes(child),
  );

  return (
    <header className={cn('relative flex w-full flex-col gap-2', className)} {...props}>
      {eyebrows}
      <div className="flex w-full items-start gap-3">
        {icons}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {headline.length > 0 && <div className="flex min-w-0 items-center gap-3">{headline}</div>}
          {below}
        </div>
        {actions}
      </div>
    </header>
  );
}
