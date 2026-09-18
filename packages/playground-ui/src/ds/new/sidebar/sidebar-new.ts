import { SidebarNewBrand } from './sidebar-new-brand';
import { SidebarNewCommandHeader } from './sidebar-new-command-header';
import { SidebarNewFooter } from './sidebar-new-footer';
import { SidebarNewFooterMeta } from './sidebar-new-footer-meta';
import { SidebarNewHeader } from './sidebar-new-header';
import { SidebarNewMeter } from './sidebar-new-meter';
import { SidebarNewNav } from './sidebar-new-nav';
import { SidebarNewNavHeader } from './sidebar-new-nav-header';
import { SidebarNewNavStack } from './sidebar-new-nav-stack';
import { SidebarNewRoot } from './sidebar-new-root';
import { SidebarNewSearchTrigger } from './sidebar-new-search-trigger';
import { SidebarNewSections } from './sidebar-new-sections';
import { SidebarNewTrigger } from './sidebar-new-trigger';
import { MainSidebarMobileTrigger } from '@/ds/components/MainSidebar/main-sidebar-mobile-trigger';
import { MainSidebarNavLabel } from '@/ds/components/MainSidebar/main-sidebar-nav-label';
import { MainSidebarNavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavList } from '@/ds/components/MainSidebar/main-sidebar-nav-list';
import { MainSidebarNavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';
import { MainSidebarNavSeparator } from '@/ds/components/MainSidebar/main-sidebar-nav-separator';
import { MainSidebarProvider } from '@/ds/components/MainSidebar/main-sidebar-provider';

export const SidebarNew = Object.assign(SidebarNewRoot, {
  Brand: SidebarNewBrand,
  CommandHeader: SidebarNewCommandHeader,
  Footer: SidebarNewFooter,
  FooterMeta: SidebarNewFooterMeta,
  Header: SidebarNewHeader,
  Meter: SidebarNewMeter,
  MobileTrigger: MainSidebarMobileTrigger,
  Nav: SidebarNewNav,
  NavHeader: SidebarNewNavHeader,
  NavLabel: MainSidebarNavLabel,
  NavLink: MainSidebarNavLink,
  NavList: MainSidebarNavList,
  NavSection: MainSidebarNavSection,
  NavSeparator: MainSidebarNavSeparator,
  NavStack: SidebarNewNavStack,
  Provider: MainSidebarProvider,
  SearchTrigger: SidebarNewSearchTrigger,
  Sections: SidebarNewSections,
  Trigger: SidebarNewTrigger,
});
