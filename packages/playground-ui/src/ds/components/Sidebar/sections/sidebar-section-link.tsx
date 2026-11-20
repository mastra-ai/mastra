import type { ComponentProps } from 'react';
import type { SidebarLink } from '../nav/sidebar-nav-link';
import { SidebarNavLink } from '../nav/sidebar-nav-link';
import { SidebarNavList } from '../nav/sidebar-nav-list';
import { getSidebarLinkKey } from './sidebar-visibility';

export type SidebarSectionLinkProps = Omit<ComponentProps<'li'>, 'children'> & {
  link: SidebarLink;
  activeCandidates: SidebarLink[];
  level?: number;
  isActive?: (link: SidebarLink, activeCandidates: SidebarLink[]) => boolean;
};

export function SidebarSectionLink({ link, activeCandidates, level = 0, isActive, ...props }: SidebarSectionLinkProps) {
  const childLinks = link.children ?? [];

  return (
    <SidebarNavLink
      {...props}
      link={link}
      isActive={isActive?.(link, activeCandidates) ?? link.isActive}
      level={level}
      subItems={
        childLinks.length > 0 ? (
          <SidebarNavList className="mt-0.5">
            {childLinks.map(child => (
              <SidebarSectionLink
                key={getSidebarLinkKey(child)}
                link={child}
                activeCandidates={activeCandidates}
                level={level + 1}
                isActive={isActive}
              />
            ))}
          </SidebarNavList>
        ) : null
      }
    />
  );
}
