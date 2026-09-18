import { BreadcrumbBarCrumb } from './breadcrumb-bar-crumb';
import { BreadcrumbBarItem, BreadcrumbBarSwitcherCrumb } from './breadcrumb-bar-parts';
import { BreadcrumbBarRoot } from './breadcrumb-bar-root';

export type { BreadcrumbBarItemProps, BreadcrumbBarSwitcherCrumbProps } from './breadcrumb-bar-parts';
export type { BreadcrumbBarRootProps } from './breadcrumb-bar-root';

export const BreadcrumbBar = Object.assign(BreadcrumbBarRoot, {
  Crumb: BreadcrumbBarCrumb,
  Item: BreadcrumbBarItem,
  SwitcherCrumb: BreadcrumbBarSwitcherCrumb,
});
