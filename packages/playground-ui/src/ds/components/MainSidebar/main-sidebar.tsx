import { MainSidebarBottom } from './main-sidebar-bottom';
import { MainSidebarNav } from './main-sidebar-nav';
import { MainSidebarNavHeader } from './main-sidebar-nav-header';
import { MainSidebarNavLink } from './main-sidebar-nav-link';
import { MainSidebarNavList } from './main-sidebar-nav-list';
import { MainSidebarNavSection } from './main-sidebar-nav-section';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
import { MainSidebarRoot } from './main-sidebar-root';
import { MainSidebarTrigger } from './main-sidebar-trigger';

export { MainSidebarProvider, type SidebarState } from './main-sidebar-context';
export { useMainSidebar, useMaybeSidebar } from './main-sidebar-context';
export { type NavLink } from './main-sidebar-nav-link';
export { type NavSection } from './main-sidebar-nav-section';
export { MainSidebarTrigger } from './main-sidebar-trigger';

export const MainSidebar = Object.assign(MainSidebarRoot, {
  Bottom: MainSidebarBottom,
  Nav: MainSidebarNav,
  NavSection: MainSidebarNavSection,
  NavLink: MainSidebarNavLink,
  NavHeader: MainSidebarNavHeader,
  NavList: MainSidebarNavList,
  NavSeparator: MainSidebarNavSeparator,
  Trigger: MainSidebarTrigger,
});
