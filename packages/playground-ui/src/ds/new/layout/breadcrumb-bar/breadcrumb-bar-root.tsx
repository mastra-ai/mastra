import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { BreadcrumbBarCrumbContext } from './breadcrumb-bar-context';
import type { BreadcrumbBarSeparator } from './breadcrumb-bar-context';
import { BreadcrumbBarItem } from './breadcrumb-bar-parts';
import type { BreadcrumbBarItemProps } from './breadcrumb-bar-parts';
import { Breadcrumb } from '@/ds/components/Breadcrumb';
import { Header } from '@/ds/components/Header';
import { Icon } from '@/ds/icons/Icon';

export interface BreadcrumbBarRootProps {
  actions?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  separator?: BreadcrumbBarSeparator;
}

function isBreadcrumbBarItem(child: ReactNode): child is ReactElement<BreadcrumbBarItemProps> {
  return isValidElement<BreadcrumbBarItemProps>(child) && child.type === BreadcrumbBarItem;
}

export function BreadcrumbBarRoot({ actions, children, icon, separator = 'slash' }: BreadcrumbBarRootProps) {
  const crumbs = Children.toArray(children).filter(isBreadcrumbBarItem);
  const leafIndex = crumbs.length - 1;

  return (
    <Header className="h-10 min-h-10 gap-2 overflow-hidden px-2">
      {icon && <Icon className="text-neutral3 shrink-0">{icon}</Icon>}
      {crumbs.length > 0 && (
        <Breadcrumb label="Breadcrumb" className="min-w-0 flex-1 overflow-hidden" listClassName="min-w-0">
          {crumbs.map((crumb, index) => (
            <BreadcrumbBarCrumbContext.Provider
              key={crumb.key ?? index}
              value={{ isLeaf: index === leafIndex, pathname: crumb.props.pathname, separator }}
            >
              {crumb}
            </BreadcrumbBarCrumbContext.Provider>
          ))}
        </Breadcrumb>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{actions}</div>
    </Header>
  );
}
