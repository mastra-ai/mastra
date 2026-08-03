import { MainSidebarBottom } from './main-sidebar-bottom';
import { MainSidebarMobileTrigger } from './main-sidebar-mobile-trigger';
import { MainSidebarNav } from './main-sidebar-nav';
import { MainSidebarNavHeader } from './main-sidebar-nav-header';
import { MainSidebarNavLabel } from './main-sidebar-nav-label';
import { MainSidebarNavLink } from './main-sidebar-nav-link';
import { MainSidebarNavList } from './main-sidebar-nav-list';
import { MainSidebarNavSection } from './main-sidebar-nav-section';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
import { MainSidebarRoot } from './main-sidebar-root';
import { MainSidebarSections } from './main-sidebar-sections';
import { MainSidebarTrigger } from './main-sidebar-trigger';

export type { MainSidebarStateContextValue, MobileDrawerContextValue, SidebarState } from './main-sidebar-context';
export { useMainSidebar, useMaybeSidebar, useMaybeSidebarState, useMobileDrawer } from './main-sidebar-context';
export { MainSidebarProvider, type MainSidebarProviderProps } from './main-sidebar-provider';
export { navItemClasses } from './main-sidebar-nav-item-classes';
export { type MainSidebarNavItemSize } from './main-sidebar-nav-item-classes';
export { type NavLink } from './main-sidebar-nav-link';
export { type NavSection } from './main-sidebar-nav-section';
export { MainSidebarTrigger } from './main-sidebar-trigger';
export { MainSidebarMobileTrigger } from './main-sidebar-mobile-trigger';
export { getIsLinkActive } from './main-sidebar-link-active';

export const MainSidebar = Object.assign(MainSidebarRoot, {
  Bottom: MainSidebarBottom,
  Nav: MainSidebarNav,
  NavSection: MainSidebarNavSection,
  NavLink: MainSidebarNavLink,
  NavLabel: MainSidebarNavLabel,
  NavHeader: MainSidebarNavHeader,
  NavList: MainSidebarNavList,
  NavSeparator: MainSidebarNavSeparator,
  Sections: MainSidebarSections,
  Trigger: MainSidebarTrigger,
  MobileTrigger: MainSidebarMobileTrigger,
});
