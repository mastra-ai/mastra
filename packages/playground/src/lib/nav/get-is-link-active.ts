import type { NavItem } from '@/lib/nav/nav-items';

export function getIsLinkActive(item: NavItem, pathname: string, siblings: NavItem[] = []): boolean {
  const specificity = (candidate: NavItem) =>
    Math.max(
      0,
      ...[candidate.url, ...(candidate.activePaths ?? [])]
        .filter(url => pathname === url || pathname.startsWith(url + '/'))
        .map(url => url.length),
    );
  const own = specificity(item);
  return own > 0 && !siblings.some(sibling => sibling !== item && specificity(sibling) > own);
}
