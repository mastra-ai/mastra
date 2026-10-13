import { SidebarFooter } from './footer/sidebar-footer';
import { SidebarFooterMeta } from './footer/sidebar-footer-meta';
import { SidebarMeter } from './footer/sidebar-meter';
import { SidebarBrand } from './header/sidebar-brand';
import { SidebarCommandHeader } from './header/sidebar-command-header';
import { SidebarHeader } from './header/sidebar-header';
import { SidebarSearchTrigger } from './header/sidebar-search-trigger';
import { SidebarNav } from './nav/sidebar-nav';
import { SidebarNavHeader } from './nav/sidebar-nav-header';
import { SidebarNavLabel } from './nav/sidebar-nav-label';
import { SidebarNavLink } from './nav/sidebar-nav-link';
import { SidebarNavList } from './nav/sidebar-nav-list';
import { SidebarNavSection } from './nav/sidebar-nav-section';
import { SidebarNavSeparator } from './nav/sidebar-nav-separator';
import { SidebarNavStack } from './nav-stack/sidebar-nav-stack';
import { SidebarMobileTrigger } from './root/sidebar-mobile-trigger';
import { SidebarProvider } from './root/sidebar-provider';
import { SidebarRoot } from './root/sidebar-root';
import { SidebarTrigger } from './root/sidebar-trigger';
import { SidebarSections } from './sections/sidebar-sections';

export const Sidebar = Object.assign(SidebarRoot, {
  Brand: SidebarBrand,
  CommandHeader: SidebarCommandHeader,
  Footer: SidebarFooter,
  FooterMeta: SidebarFooterMeta,
  Header: SidebarHeader,
  Meter: SidebarMeter,
  MobileTrigger: SidebarMobileTrigger,
  Nav: SidebarNav,
  NavHeader: SidebarNavHeader,
  NavLabel: SidebarNavLabel,
  NavLink: SidebarNavLink,
  NavList: SidebarNavList,
  NavSection: SidebarNavSection,
  NavSeparator: SidebarNavSeparator,
  NavStack: SidebarNavStack,
  Provider: SidebarProvider,
  SearchTrigger: SidebarSearchTrigger,
  Sections: SidebarSections,
  Trigger: SidebarTrigger,
});
