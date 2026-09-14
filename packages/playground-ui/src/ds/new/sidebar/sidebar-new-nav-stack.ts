import { SidebarNewNavStackRoot } from './sidebar-new-nav-stack-root';
import { SidebarNewNavStackRootView } from './sidebar-new-nav-stack-root-view';
import { SidebarNewNavStackView } from './sidebar-new-nav-stack-view';

export type { SidebarNewNavStackProps } from './sidebar-new-nav-stack-root';
export type { SidebarNewNavStackRootViewProps } from './sidebar-new-nav-stack-root-view';
export type { SidebarNewNavStackViewProps } from './sidebar-new-nav-stack-view';

export const SidebarNewNavStack = Object.assign(SidebarNewNavStackRoot, {
  Root: SidebarNewNavStackRootView,
  View: SidebarNewNavStackView,
});
