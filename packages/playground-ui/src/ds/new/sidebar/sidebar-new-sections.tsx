import { useId } from 'react';
import { SidebarNewNavHeader } from './sidebar-new-nav-header';
import { SidebarNewSectionLink } from './sidebar-new-section-link';
import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';
import { MainSidebarNavList } from '@/ds/components/MainSidebar/main-sidebar-nav-list';
import type { NavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';
import { MainSidebarNavSection } from '@/ds/components/MainSidebar/main-sidebar-nav-section';
import { MainSidebarNavSeparator } from '@/ds/components/MainSidebar/main-sidebar-nav-separator';

export type SidebarNewSectionsProps = {
  sections: NavSection[];
  isActive?: (link: NavLink, activeCandidates: NavLink[]) => boolean;
  className?: string;
};

function getLinkKey(link: NavLink) {
  return `${link.url}:${link.name}`;
}

export function SidebarNewSections({ sections, isActive, className }: SidebarNewSectionsProps) {
  const baseId = useId();

  return (
    <>
      {sections.map(section => {
        const showSeparator = section.links.length > 0 && section.separator;
        const headerId = section.title ? `${baseId}-${section.key}` : undefined;

        return (
          <MainSidebarNavSection
            key={section.key}
            className={className}
            aria-labelledby={headerId}
            aria-label={!headerId ? section.key : undefined}
          >
            {showSeparator ? <MainSidebarNavSeparator /> : null}
            {section.title ? (
              <SidebarNewNavHeader id={headerId} href={section.href} isActive={section.isHeaderActive}>
                {section.title}
              </SidebarNewNavHeader>
            ) : null}
            <MainSidebarNavList>
              {section.links.map(link => (
                <SidebarNewSectionLink
                  key={getLinkKey(link)}
                  link={link}
                  activeCandidates={section.links}
                  isActive={isActive}
                />
              ))}
            </MainSidebarNavList>
          </MainSidebarNavSection>
        );
      })}
    </>
  );
}
