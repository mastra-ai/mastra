import type { SidebarLink } from './sidebar-nav-link';

/**
 * Strict active-path match with sibling-exclusion.
 * - `pathname === link.url` or starts with `link.url + '/'`
 * - Not active if any sibling link has a longer matching url (prevents `/a` lighting while `/a/b` matches).
 */
export function getIsLinkActive(link: SidebarLink, pathname: string, siblings: SidebarLink[] = []): boolean {
  const matches = (url: string) => pathname === url || pathname.startsWith(url + '/');
  const flattenLinks = (links: SidebarLink[]): SidebarLink[] =>
    links.flatMap(item => [item, ...flattenLinks(item.children ?? [])]);

  if (!matches(link.url)) return false;
  const competingLinks = [...flattenLinks(link.children ?? []), ...flattenLinks(siblings)];
  return !competingLinks.some(
    other => other.url !== link.url && other.url.length > link.url.length && matches(other.url),
  );
}
