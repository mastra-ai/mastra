import { findNavItem } from './nav-items';
import type { NavItem } from './nav-items';
import type { CrumbDef, RouteHeaderHandle } from '@/lib/route-header';

export * from './nav-items';

/** Crumb derived from the nav registry — guarantees icon/label parity with the sidebar. */
export function navCrumb(url: string, overrides?: Partial<CrumbDef>): CrumbDef {
  const item = findNavItem(url);
  if (!item) throw new Error(`navCrumb: unknown nav url "${url}"`);
  return { node: item.name, icon: item.Icon, to: url, ...overrides };
}

/** Route handle for a leaf page whose breadcrumb is just its own nav entry. */
export function navHandle(url: string): RouteHeaderHandle {
  const item = findNavItem(url);
  if (!item) throw new Error(`navHandle: unknown nav url "${url}"`);
  return {
    crumbs: [{ node: item.name, icon: item.Icon }],
    docs: item.docs,
  };
}

/** Route handle for a child page: declares parent crumbs then leaves. */
export function navHandleWithChildren(parentUrl: string, leaves: CrumbDef[]): RouteHeaderHandle {
  const parent = findNavItem(parentUrl);
  if (!parent) throw new Error(`navHandleWithChildren: unknown nav url "${parentUrl}"`);
  return {
    crumbs: [{ node: parent.name, icon: parent.Icon, to: parentUrl }, ...leaves],
    docs: parent.docs,
  };
}

export type { NavItem };
