import { SidebarNewBrand } from './sidebar-new-brand';
import { SidebarNewFooter } from './sidebar-new-footer';
import { SidebarNewHeader } from './sidebar-new-header';
import { SidebarNewNavHeader } from './sidebar-new-nav-header';
import { SidebarNewNavStack } from './sidebar-new-nav-stack';
import { SidebarNewRoot } from './sidebar-new-root';
import { SidebarNewSections } from './sidebar-new-sections';
import { MainSidebarMobileTrigger } from '@/ds/components/MainSidebar/main-sidebar-mobile-trigger';
import { MainSidebarNav } from '@/ds/components/MainSidebar/main-sidebar-nav';
import { MainSidebarNavLabel } from '@/ds/components/MainSidebar/main-sidebar-nav-label';
import { MainSidebarNavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavList } from '@/ds/components/MainSidebar/main-sidebar-nav-list';
import { MainSidebarNavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';
import { MainSidebarNavSeparator } from '@/ds/components/MainSidebar/main-sidebar-nav-separator';
import { MainSidebarProvider } from '@/ds/components/MainSidebar/main-sidebar-provider';
import { MainSidebarTrigger } from '@/ds/components/MainSidebar/main-sidebar-trigger';

export const SidebarNew = Object.assign(SidebarNewRoot, {
  Brand: SidebarNewBrand,
  Footer: SidebarNewFooter,
  Header: SidebarNewHeader,
  MobileTrigger: MainSidebarMobileTrigger,
  Nav: MainSidebarNav,
  NavHeader: SidebarNewNavHeader,
  NavLabel: MainSidebarNavLabel,
  NavLink: MainSidebarNavLink,
  NavList: MainSidebarNavList,
  NavSection: MainSidebarNavSection,
  NavSeparator: MainSidebarNavSeparator,
  NavStack: SidebarNewNavStack,
  Provider: MainSidebarProvider,
  Sections: SidebarNewSections,
  Trigger: MainSidebarTrigger,
});
