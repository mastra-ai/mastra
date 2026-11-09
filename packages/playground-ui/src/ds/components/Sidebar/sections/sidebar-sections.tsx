import type { SidebarLink } from '../nav/sidebar-nav-link';
import { SidebarSectionsContent } from './sidebar-sections-content';
import { defaultVisibilityStorageKey } from './sidebar-visibility';
import type { OptionalSidebarLink } from './sidebar-visibility';

export type SidebarSection = {
  key: string;
  title?: string;
  href?: string;
  links: SidebarLink[];
  moreLinks?: OptionalSidebarLink[];
  separator?: boolean;
  isHeaderActive?: boolean;
};

export type SidebarSectionsProps = {
  sections: SidebarSection[];
  isActive?: (link: SidebarLink, activeCandidates: SidebarLink[]) => boolean;
  className?: string;
  visibilityStorageKey?: string;
};

export function SidebarSections({
  visibilityStorageKey = defaultVisibilityStorageKey,
  ...props
}: SidebarSectionsProps) {
  return <SidebarSectionsContent key={visibilityStorageKey} {...props} visibilityStorageKey={visibilityStorageKey} />;
}
