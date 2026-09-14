export { SidebarNew } from './sidebar-new';
export { SidebarNewBrand, type SidebarNewBrandProps } from './sidebar-new-brand';
export { SidebarNewFooter, type SidebarNewFooterProps } from './sidebar-new-footer';
export { SidebarNewHeader, type SidebarNewHeaderProps } from './sidebar-new-header';
export { SidebarNewNavHeader, type SidebarNewNavHeaderProps } from './sidebar-new-nav-header';
export {
  SidebarNewNavStack,
  type SidebarNewNavStackProps,
  type SidebarNewNavStackRootViewProps,
  type SidebarNewNavStackViewProps,
} from './sidebar-new-nav-stack';
export { SidebarNewRoot, type SidebarNewRootProps } from './sidebar-new-root';
export { SidebarNewSections, type SidebarNewSectionsProps } from './sidebar-new-sections';
export {
  getIsLinkActive,
  MainSidebarProvider as SidebarNewProvider,
  type MainSidebarProviderProps as SidebarNewProviderProps,
  navItemClasses,
  type MainSidebarNavItemSize as SidebarNewNavItemSize,
  type NavLink as SidebarNewLink,
  type NavSection as SidebarNewSection,
  useMainSidebar as useSidebarNew,
} from '@/ds/components/MainSidebar/main-sidebar';
