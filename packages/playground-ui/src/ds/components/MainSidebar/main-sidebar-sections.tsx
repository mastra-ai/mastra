import { useId } from 'react';
import { MainSidebarNavHeader } from './main-sidebar-nav-header';
import { MainSidebarNavLink } from './main-sidebar-nav-link';
import type { NavLink } from './main-sidebar-nav-link';
import { MainSidebarNavList } from './main-sidebar-nav-list';
import { MainSidebarNavSection } from './main-sidebar-nav-section';
import type { NavSection } from './main-sidebar-nav-section';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';

export type MainSidebarSectionsProps = {
  sections: NavSection[];
  /**
   * Called per link to decide the active state. Receives the section's links so
   * callers can use section-aware active logic without re-scanning `sections`
   * from the outside. Default: each link's `isActive`.
   */
  isActive?: (link: NavLink, activeCandidates: NavLink[]) => boolean;
  className?: string;
};

type MainSidebarSectionLinkProps = {
  link: NavLink;
  activeCandidates: NavLink[];
  level?: number;
  isActive?: MainSidebarSectionsProps['isActive'];
};

function getLinkKey(link: NavLink) {
  return `${link.url}:${link.name}`;
}

function MainSidebarSectionLink({ link, activeCandidates, level = 0, isActive }: MainSidebarSectionLinkProps) {
  const childLinks = link.children ?? [];

  return (
    <MainSidebarNavLink
      link={link}
      isActive={isActive?.(link, activeCandidates) ?? link.isActive}
      level={level}
      subItems={
        childLinks.length > 0 ? (
          <MainSidebarNavList className="mt-0.5">
            {childLinks.map(child => (
              <MainSidebarSectionLink
                key={getLinkKey(child)}
                link={child}
                activeCandidates={activeCandidates}
                level={level + 1}
                isActive={isActive}
              />
            ))}
          </MainSidebarNavList>
        ) : null
      }
    />
  );
}

export function MainSidebarSections({ sections, isActive, className }: MainSidebarSectionsProps) {
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
            {/* Render separator and header independently — a section can have
                both (titled group preceded by a divider). */}
            {showSeparator ? <MainSidebarNavSeparator /> : null}
            {section.title ? (
              <MainSidebarNavHeader id={headerId} href={section.href} isActive={section.isHeaderActive}>
                {section.title}
              </MainSidebarNavHeader>
            ) : null}
            <MainSidebarNavList>
              {section.links.map(link => (
                <MainSidebarSectionLink
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
