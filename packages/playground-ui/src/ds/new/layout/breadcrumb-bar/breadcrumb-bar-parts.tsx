import type { ReactNode } from 'react';

import { useBreadcrumbBarCrumb } from './breadcrumb-bar-context';
import { BreadcrumbBarCrumb } from './breadcrumb-bar-crumb';

export interface BreadcrumbBarItemProps {
  children: ReactNode;
  pathname?: string;
}

export interface BreadcrumbBarSwitcherCrumbProps {
  children: ReactNode;
  className?: string;
}

export function BreadcrumbBarItem({ children }: BreadcrumbBarItemProps) {
  return children;
}

export function BreadcrumbBarSwitcherCrumb({ children, className }: BreadcrumbBarSwitcherCrumbProps) {
  const crumb = useBreadcrumbBarCrumb();

  return (
    <BreadcrumbBarCrumb as="span" isCurrent={crumb?.isLeaf} className={className}>
      {children}
    </BreadcrumbBarCrumb>
  );
}
