import type { PropSidebarItem, PropSidebarItemCategory, PropSidebarItemLink } from '@docusaurus/plugin-content-docs'

export type ContextualSidebarState = Readonly<{
  categoryHref: string
  categoryLabel: string
  destinationPathnames: readonly string[]
  entryPathname: string
  phase: 'pending' | 'active'
}>

export type SidebarClickEvent = Readonly<{
  altKey: boolean
  button: number
  ctrlKey: boolean
  defaultPrevented: boolean
  metaKey: boolean
  shiftKey: boolean
}>

export function isPlainPrimaryClick(event: SidebarClickEvent): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  )
}

function normalizePathname(pathname: string): string | undefined {
  if (!pathname.startsWith('/')) {
    return undefined
  }

  const withoutTrailingSlash = pathname.replace(/\/+$/, '')
  return withoutTrailingSlash || '/'
}

export function getLocalPathname(href: string, siteUrl: string): string | undefined {
  if (!href.startsWith('/') || href.startsWith('//')) {
    try {
      const siteOrigin = new URL(siteUrl).origin
      const url = new URL(href)
      if (url.origin !== siteOrigin) {
        return undefined
      }
      return normalizePathname(url.pathname)
    } catch {
      return undefined
    }
  }

  try {
    const url = new URL(href, new URL(siteUrl).origin)
    return normalizePathname(url.pathname)
  } catch {
    return undefined
  }
}

function isContextualCategory(item: PropSidebarItem): item is PropSidebarItemCategory & { href: string } {
  return item.type === 'category' && item.customProps?.contextualSidebar === true && typeof item.href === 'string'
}

export function findContextualSidebarCategory(
  items: readonly PropSidebarItem[],
  href: string,
): (PropSidebarItemCategory & { href: string }) | undefined {
  for (const item of items) {
    if (isContextualCategory(item) && item.href === href) {
      return item
    }

    if (item.type === 'category') {
      const match = findContextualSidebarCategory(item.items, href)
      if (match) {
        return match
      }
    }
  }

  return undefined
}

export function findInitialContextualSidebarCategory(
  items: readonly PropSidebarItem[],
  pathname: string,
  siteUrl: string,
): (PropSidebarItemCategory & { href: string }) | undefined {
  const normalizedPathname = normalizePathname(pathname)
  if (!normalizedPathname) {
    return undefined
  }

  for (const item of items) {
    if (isContextualCategory(item) && collectContextualSidebarPathnames(item, siteUrl).includes(normalizedPathname)) {
      return item
    }

    if (item.type === 'category') {
      const match = findInitialContextualSidebarCategory(item.items, normalizedPathname, siteUrl)
      if (match) {
        return match
      }
    }
  }

  return undefined
}

function collectItemPathnames(items: readonly PropSidebarItem[], siteUrl: string, pathnames: Set<string>): void {
  for (const item of items) {
    if (item.type === 'link') {
      const pathname = getLocalPathname(item.href, siteUrl)
      if (pathname) {
        pathnames.add(pathname)
      }
    } else if (item.type === 'category') {
      if (item.href) {
        const pathname = getLocalPathname(item.href, siteUrl)
        if (pathname) {
          pathnames.add(pathname)
        }
      }
      collectItemPathnames(item.items, siteUrl, pathnames)
    }
  }
}

export function collectContextualSidebarPathnames(
  category: PropSidebarItemCategory & { href: string },
  siteUrl: string,
): readonly string[] {
  const pathnames = new Set<string>()
  const categoryPathname = getLocalPathname(category.href, siteUrl)
  if (categoryPathname) {
    pathnames.add(categoryPathname)
  }
  collectItemPathnames(category.items, siteUrl, pathnames)
  return [...pathnames]
}

export function createContextualSidebarItems(
  category: PropSidebarItemCategory & { href: string },
): readonly PropSidebarItem[] {
  const overview: PropSidebarItemLink = {
    type: 'link',
    label: 'Overview',
    href: category.href,
  }
  return [overview, ...category.items]
}

export function enterContextualSidebar(
  category: PropSidebarItemCategory,
  entryPathname: string,
  siteUrl: string,
): ContextualSidebarState | undefined {
  if (!isContextualCategory(category)) {
    return undefined
  }

  const normalizedEntryPathname = normalizePathname(entryPathname)
  const destinationPathnames = collectContextualSidebarPathnames(category, siteUrl)
  if (!normalizedEntryPathname || destinationPathnames.length === 0) {
    return undefined
  }

  return {
    categoryHref: category.href,
    categoryLabel: category.label,
    destinationPathnames,
    entryPathname: normalizedEntryPathname,
    phase: destinationPathnames.includes(normalizedEntryPathname) ? 'active' : 'pending',
  }
}

export function observeContextualSidebarPathname(
  state: ContextualSidebarState | undefined,
  pathname: string,
): ContextualSidebarState | undefined {
  if (!state) {
    return undefined
  }

  const normalizedPathname = normalizePathname(pathname)
  if (!normalizedPathname) {
    return undefined
  }

  if (state.phase === 'pending') {
    if (normalizedPathname === state.entryPathname) {
      return state
    }
    if (state.destinationPathnames.includes(normalizedPathname)) {
      return { ...state, phase: 'active' }
    }
    return undefined
  }

  return state.destinationPathnames.includes(normalizedPathname) ? state : undefined
}

export function isContextualSidebarVisible(
  state: ContextualSidebarState | undefined,
  pathname: string,
): state is ContextualSidebarState {
  const normalizedPathname = normalizePathname(pathname)
  if (!state || !normalizedPathname) {
    return false
  }

  return state.phase === 'pending'
    ? normalizedPathname === state.entryPathname || state.destinationPathnames.includes(normalizedPathname)
    : state.destinationPathnames.includes(normalizedPathname)
}

export function getContextualSidebarItems(
  sidebar: readonly PropSidebarItem[],
  state: ContextualSidebarState | undefined,
): readonly PropSidebarItem[] | undefined {
  if (!state) {
    return undefined
  }

  const category = findContextualSidebarCategory(sidebar, state.categoryHref)
  return category ? createContextualSidebarItems(category) : undefined
}
