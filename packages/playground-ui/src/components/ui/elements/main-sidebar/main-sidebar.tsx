import { MainSidebarRoot } from './main-sidebar-root';
import { MainSidebarBottom } from './main-sidebar-bottom';
import { MainSidebarNav } from './main-sidebar-nav';
import { MainSidebarNavSection } from './main-sidebar-nav-section';
import { MainSidebarNavLink } from './main-sidebar-nav-link';
import { MainSidebarNavHeader } from './main-sidebar-nav-header';
import { MainSidebarNavList } from './main-sidebar-nav-list';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';

export { MainSidebarProvider } from './main-sidebar-context';
export { useMainSidebar } from './main-sidebar-context';
export { type NavLink } from './main-sidebar-nav-link';
export { type NavSection } from './main-sidebar-nav-section';

export const MainSidebar = Object.assign(MainSidebarRoot, {
  Bottom: MainSidebarBottom,
  Nav: MainSidebarNav,
  NavSection: MainSidebarNavSection,
  NavLink: MainSidebarNavLink,
  NavHeader: MainSidebarNavHeader,
  NavList: MainSidebarNavList,
  NavSeparator: MainSidebarNavSeparator,
});
