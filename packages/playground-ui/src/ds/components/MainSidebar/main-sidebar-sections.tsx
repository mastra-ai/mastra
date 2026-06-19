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
   * Called per link to decide the active state. Receives sibling links so
   * callers can use `getIsLinkActive` (or any sibling-aware logic) without
   * re-scanning `sections` from the outside. Default: each link's `isActive`.
   */
  isActive?: (link: NavLink, siblings: NavLink[]) => boolean;
  className?: string;
};

type MainSidebarSectionLinkProps = {
  link: NavLink;
  siblings: NavLink[];
  level?: number;
  isActive?: MainSidebarSectionsProps['isActive'];
};

function getLinkKey(link: NavLink) {
  return `${link.url}:${link.name}`;
}

function MainSidebarSectionLink({ link, siblings, level = 0, isActive }: MainSidebarSectionLinkProps) {
  const childLinks = link.children ?? [];

  return (
    <MainSidebarNavLink
      link={link}
      isActive={isActive?.(link, siblings) ?? link.isActive}
      level={level}
      subItems={
        childLinks.length > 0 ? (
          <MainSidebarNavList className="mt-0.5">
            {childLinks.map(child => (
              <MainSidebarSectionLink
                key={getLinkKey(child)}
                link={child}
                siblings={childLinks}
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
                  siblings={section.links}
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

/**
 * Strict active-path match with sibling-exclusion.
 * - `pathname === link.url` or starts with `link.url + '/'`
 * - Not active if any sibling link has a longer matching url (prevents `/a` lighting while `/a/b` matches).
 */
export function getIsLinkActive(link: NavLink, pathname: string, siblings: NavLink[] = []): boolean {
  const matches = (url: string) => pathname === url || pathname.startsWith(url + '/');
  const flattenLinks = (links: NavLink[]): NavLink[] =>
    links.flatMap(item => [item, ...flattenLinks(item.children ?? [])]);

  if (!matches(link.url)) return false;
  const competingLinks = [...flattenLinks(link.children ?? []), ...flattenLinks(siblings)];
  return !competingLinks.some(
    other => other.url !== link.url && other.url.length > link.url.length && matches(other.url),
  );
}
