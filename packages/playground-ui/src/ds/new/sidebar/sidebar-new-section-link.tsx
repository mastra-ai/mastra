import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavList } from '@/ds/components/MainSidebar/main-sidebar-nav-list';

export type SidebarNewSectionLinkProps = {
  link: NavLink;
  activeCandidates: NavLink[];
  level?: number;
  isActive?: (link: NavLink, activeCandidates: NavLink[]) => boolean;
  onSelect?: (link: NavLink) => void;
};

function getSidebarNewLinkKey(link: NavLink) {
  return `${link.url}:${link.name}`;
}

export function SidebarNewSectionLink({
  link,
  activeCandidates,
  level = 0,
  isActive,
  onSelect,
}: SidebarNewSectionLinkProps) {
  const childLinks = link.children ?? [];

  return (
    <MainSidebarNavLink
      link={link}
      isActive={isActive?.(link, activeCandidates) ?? link.isActive}
      level={level}
      onClick={event => {
        if (event.target instanceof Element && event.target.closest('li') !== event.currentTarget) return;
        onSelect?.(link);
      }}
      subItems={
        childLinks.length > 0 ? (
          <MainSidebarNavList className="mt-0.5">
            {childLinks.map(child => (
              <SidebarNewSectionLink
                key={getSidebarNewLinkKey(child)}
                link={child}
                activeCandidates={activeCandidates}
                level={level + 1}
                isActive={isActive}
                onSelect={onSelect}
              />
            ))}
          </MainSidebarNavList>
        ) : null
      }
    />
  );
}
