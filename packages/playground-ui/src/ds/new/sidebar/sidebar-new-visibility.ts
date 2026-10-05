import { z } from 'zod/v4';
import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';

const recentLinkRetentionMs = 7 * 24 * 60 * 60 * 1000;
export const visibilitySchema = z.record(z.string(), z.union([z.boolean(), z.number()])).transform(entries =>
  Object.entries(entries).reduce<Record<string, boolean>>((visibility, [key, value]) => {
    if (typeof value === 'boolean') visibility[key] = value;
    else if (value >= Date.now() - recentLinkRetentionMs) visibility[key] = true;
    return visibility;
  }, {}),
);
export const defaultRecentItemsStorageKey = 'mastra:sidebar-new:recent-more-items';

export function getSidebarLinkKey(link: NavLink) {
  return `${link.url}:${link.name}`;
}
