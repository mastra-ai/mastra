import { BreadcrumbBar, BreadcrumbItem } from './breadcrumb-bar';
import type { BreadcrumbBarProps, BreadcrumbItemProps } from './breadcrumb-bar';
import { BreadcrumbRoot } from './breadcrumb-root';
import type { BreadcrumbRootProps } from './breadcrumb-root';

export const Breadcrumb = Object.assign(BreadcrumbRoot, {
  Bar: BreadcrumbBar,
  Item: BreadcrumbItem,
});

export type { BreadcrumbSeparator } from './breadcrumb-context';
export type { BreadcrumbBarProps, BreadcrumbItemProps, BreadcrumbRootProps };
