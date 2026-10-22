import { z } from 'zod/v4';
import type { SidebarLink } from '../nav/sidebar-nav-link';

export const sidebarLinkPlacements = ['sidebar', 'more', 'hidden'] as const;
export type SidebarLinkPlacement = (typeof sidebarLinkPlacements)[number];

export const sidebarLinkPlacementLabels: Record<SidebarLinkPlacement, string> = {
  sidebar: 'Always show',
  more: 'Hide in More menu',
  hidden: 'Never show',
};

export const placementsSchema = z.record(z.string(), z.enum(sidebarLinkPlacements));
export type SidebarLinkPlacements = z.infer<typeof placementsSchema>;

export const defaultVisibilityStorageKey = 'mastra:sidebar:link-visibility';

export type OptionalSidebarLink = SidebarLink & { defaultVisible?: boolean };

export function getSidebarLinkKey(link: SidebarLink) {
  return `${link.url}:${link.name}`;
}

export function getSidebarVisibilityKey(sectionKey: string, link: SidebarLink) {
  return `${sectionKey}:${link.name}`;
}

export function getDefaultPlacement(link: OptionalSidebarLink, optionalLinkCount: number): SidebarLinkPlacement {
  const visible = link.defaultVisible ?? optionalLinkCount < 2;
  return visible ? 'sidebar' : 'more';
}

export function isSidebarLinkPlacement(value: unknown): value is SidebarLinkPlacement {
  return sidebarLinkPlacements.some(placement => placement === value);
}
