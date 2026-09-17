import { ChevronDownIcon, MoreHorizontalIcon } from 'lucide-react';
import { useState } from 'react';
import { SidebarNewSectionLink } from './sidebar-new-section-link';
import { MainSidebarNavLabel } from '@/ds/components/MainSidebar/main-sidebar-nav-label';
import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { cn } from '@/lib/utils';

export type SidebarNewMoreLinksProps = {
  links: NavLink[];
  activeCandidates: NavLink[];
  isActive?: (link: NavLink, activeCandidates: NavLink[]) => boolean;
  recentLinks: Record<string, number>;
  recentCutoff: number;
  onSelect: (link: NavLink) => void;
};

export function SidebarNewMoreLinks({
  links,
  activeCandidates,
  isActive,
  recentLinks,
  recentCutoff,
  onSelect,
}: SidebarNewMoreLinksProps) {
  const [expanded, setExpanded] = useState(false);
  const linkIsActive = (link: NavLink) => isActive?.(link, activeCandidates) ?? link.isActive ?? false;
  const surfacedLinks =
    links.length < 2
      ? links
      : links.filter(link => linkIsActive(link) || (recentLinks[link.name] ?? 0) >= recentCutoff);
  const foldedLinks = links.filter(link => !surfacedLinks.includes(link));

  function renderLink(link: NavLink) {
    return (
      <SidebarNewSectionLink
        key={`${link.url}:${link.name}`}
        link={link}
        activeCandidates={activeCandidates}
        isActive={isActive}
        onSelect={onSelect}
      />
    );
  }

  return (
    <>
      {surfacedLinks.map(renderLink)}
      {foldedLinks.length > 0 ? (
        <MainSidebarNavLink
          link={{ name: 'More', url: '', icon: <MoreHorizontalIcon /> }}
          render={
            <button
              type="button"
              aria-label="More"
              aria-expanded={expanded}
              onClick={() => setExpanded(current => !current)}
            >
              <MoreHorizontalIcon aria-hidden="true" />
              <MainSidebarNavLabel>More</MainSidebarNavLabel>
            </button>
          }
          action={
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                'size-3.5 transition-transform duration-normal ease-out-custom motion-reduce:transition-none',
                expanded && 'rotate-180',
              )}
            />
          }
        />
      ) : null}
      {expanded ? foldedLinks.map(renderLink) : null}
    </>
  );
}
