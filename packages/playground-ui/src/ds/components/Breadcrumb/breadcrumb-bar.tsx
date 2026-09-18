import { Children, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { BreadcrumbItemContext } from './breadcrumb-context';
import type { BreadcrumbSeparator } from './breadcrumb-context';
import { BreadcrumbRoot } from './breadcrumb-root';
import { Header } from '@/ds/components/Header';

export interface BreadcrumbItemProps {
  children: ReactNode;
  pathname?: string;
}

export interface BreadcrumbBarProps {
  actions?: ReactNode;
  children?: ReactNode;
  separator?: BreadcrumbSeparator;
}

export function BreadcrumbItem({ children }: BreadcrumbItemProps) {
  return children;
}

function isBreadcrumbItem(child: ReactNode): child is ReactElement<BreadcrumbItemProps> {
  return isValidElement<BreadcrumbItemProps>(child) && child.type === BreadcrumbItem;
}

export function BreadcrumbBar({ actions, children, separator = 'slash' }: BreadcrumbBarProps) {
  const crumbs = Children.toArray(children).filter(isBreadcrumbItem);
  const leafIndex = crumbs.length - 1;

  return (
    <Header className="new-theme h-10 min-h-10 gap-2 overflow-hidden px-2">
      {crumbs.length > 0 && (
        <BreadcrumbRoot
          label="Breadcrumb"
          className="min-w-0 flex-1 overflow-hidden"
          listClassName="min-w-0"
          separator={separator}
        >
          {crumbs.map((crumb, index) => (
            <BreadcrumbItemContext.Provider
              key={crumb.key ?? index}
              value={{ isLeaf: index === leafIndex, pathname: crumb.props.pathname }}
            >
              {crumb}
            </BreadcrumbItemContext.Provider>
          ))}
        </BreadcrumbRoot>
      )}
      <div className="ml-auto flex shrink-0 items-center gap-2 overflow-hidden">{actions}</div>
    </Header>
  );
}
