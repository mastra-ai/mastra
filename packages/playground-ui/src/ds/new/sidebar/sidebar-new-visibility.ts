import { z } from 'zod/v4';
import type { NavLink } from '@/ds/components/MainSidebar/main-sidebar-nav-link';

export const visibilitySchema = z.record(z.string(), z.boolean());
export const defaultVisibilityStorageKey = 'mastra:sidebar-new:link-visibility';

export function getSidebarLinkKey(link: NavLink) {
  return `${link.url}:${link.name}`;
}

export function getSidebarVisibilityKey(sectionKey: string, link: NavLink) {
  return `${sectionKey}:${link.name}`;
}
