import { SidebarNavStackRoot } from './sidebar-nav-stack-root';
import { SidebarNavStackRootView } from './sidebar-nav-stack-root-view';
import { SidebarNavStackView } from './sidebar-nav-stack-view';

export type { SidebarNavStackProps } from './sidebar-nav-stack-root';
export type { SidebarNavStackRootViewProps } from './sidebar-nav-stack-root-view';
export type { SidebarNavStackViewProps } from './sidebar-nav-stack-view';

export const SidebarNavStack = Object.assign(SidebarNavStackRoot, {
  Root: SidebarNavStackRootView,
  View: SidebarNavStackView,
});
