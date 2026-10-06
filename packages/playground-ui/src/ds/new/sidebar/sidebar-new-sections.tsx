import { SidebarNewSectionsContent } from './sidebar-new-sections-content';
import { defaultVisibilityStorageKey } from './sidebar-new-visibility';
import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import type { NavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';

export type SidebarNewSection = NavSection & {
  moreLinks?: (NavLink & { defaultVisible?: boolean })[];
};

export type SidebarNewSectionsProps = {
  sections: SidebarNewSection[];
  isActive?: (link: NavLink, activeCandidates: NavLink[]) => boolean;
  className?: string;
  visibilityStorageKey?: string;
};

export function SidebarNewSections({
  visibilityStorageKey = defaultVisibilityStorageKey,
  ...props
}: SidebarNewSectionsProps) {
  return (
    <SidebarNewSectionsContent key={visibilityStorageKey} {...props} visibilityStorageKey={visibilityStorageKey} />
  );
}
