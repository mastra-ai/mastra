import type { NavItem } from '@/lib/nav/nav-items';

export function getIsLinkActive(item: NavItem, pathname: string, siblings: NavItem[] = []): boolean {
  // Exact match or sub-path match (with / boundary so sibling routes don't match by prefix)
  const matches = (url: string) => pathname === url || pathname.startsWith(url + '/');
  // A sibling nested under this item's url (e.g. /experiments/review-queue under /experiments) wins.
  const hasMoreSpecificSibling = siblings.some(
    sibling => sibling !== item && sibling.url.startsWith(item.url + '/') && matches(sibling.url),
  );
  if (hasMoreSpecificSibling) return false;
  if (matches(item.url)) return true;
  return item.activePaths?.some(matches) ?? false;
}
