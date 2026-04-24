import { useId } from 'react';
import { MainSidebarNavHeader } from './main-sidebar-nav-header';
import { MainSidebarNavLink } from './main-sidebar-nav-link';
import type { NavLink } from './main-sidebar-nav-link';
import { MainSidebarNavList } from './main-sidebar-nav-list';
import { MainSidebarNavSection } from './main-sidebar-nav-section';
import { MainSidebarNavSeparator } from './main-sidebar-nav-separator';
import type { NavSection } from './main-sidebar-nav-section';

export type MainSidebarSectionsProps = {
  sections: NavSection[];
  /** Called per link to decide the active state. Default: strict `url` match. */
  isActive?: (link: NavLink) => boolean;
  className?: string;
};

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
            {section.title ? (
              <MainSidebarNavHeader id={headerId} href={section.href} isActive={section.isHeaderActive}>
                {section.title}
              </MainSidebarNavHeader>
            ) : showSeparator ? (
              <MainSidebarNavSeparator />
            ) : null}
            <MainSidebarNavList>
              {section.links.map(link => (
                <MainSidebarNavLink key={link.name} link={link} isActive={isActive?.(link) ?? link.isActive} />
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
  if (!matches(link.url)) return false;
  return !siblings.some(other => other.url !== link.url && other.url.length > link.url.length && matches(other.url));
}
