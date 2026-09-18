import { BreadcrumbBarCrumb } from './breadcrumb-bar-crumb';
import {
  BreadcrumbBarItem,
  BreadcrumbBarSwitcherAction,
  BreadcrumbBarSwitcherCrumb,
  BreadcrumbBarSwitcherIndicator,
  BreadcrumbBarSwitcherTrigger,
} from './breadcrumb-bar-parts';
import { BreadcrumbBarRoot } from './breadcrumb-bar-root';

export type {
  BreadcrumbBarItemProps,
  BreadcrumbBarSwitcherCrumbProps,
  BreadcrumbBarSwitcherPartProps,
} from './breadcrumb-bar-parts';
export type { BreadcrumbBarRootProps } from './breadcrumb-bar-root';

export const BreadcrumbBar = Object.assign(BreadcrumbBarRoot, {
  Crumb: BreadcrumbBarCrumb,
  Item: BreadcrumbBarItem,
  SwitcherAction: BreadcrumbBarSwitcherAction,
  SwitcherCrumb: BreadcrumbBarSwitcherCrumb,
  SwitcherIndicator: BreadcrumbBarSwitcherIndicator,
  SwitcherTrigger: BreadcrumbBarSwitcherTrigger,
});
