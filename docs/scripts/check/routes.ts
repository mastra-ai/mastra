import fs from 'fs/promises'
import path from 'path'
import { CONTENT_ROOT, CONTENT_SECTIONS, isPartial } from './content'
import type { ContentFile } from './types'

export interface Redirect {
  source: string
  destination: string
  permanent?: boolean
}

const SECTION_ROUTES = new Map<string, string>(CONTENT_SECTIONS.map(s => [s.name, s.route]))

export function normalizeRoute(route: string): string {
  const trimmed = route.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/** The URL path Docusaurus serves a content file at, or null for partials and files outside the content sections. */
export function routeForFile(file: Pick<ContentFile, 'path' | 'section' | 'frontmatter'>): string | null {
  const base = SECTION_ROUTES.get(file.section)
  if (!base || isPartial(file)) return null

  const withinSection = file.path.slice(`${CONTENT_ROOT}/${file.section}/`.length).replace(/\.mdx$/, '')
  const segments = withinSection.split('/')
  const dir = segments.slice(0, -1).join('/')

  const slug = file.frontmatter?.slug
  if (typeof slug === 'string' && slug.trim() !== '') {
    const resolved = slug.startsWith('/') ? slug : `/${dir ? `${dir}/` : ''}${slug}`
    return normalizeRoute(`${base}${resolved}`)
  }

  const name = segments[segments.length - 1]
  const parent = segments[segments.length - 2]
  // Docusaurus treats index.mdx, README.mdx, and a file named after its folder as the folder's index page.
  if (name.toLowerCase() === 'index' || name.toLowerCase() === 'readme' || name === parent) {
    return normalizeRoute(`${base}/${dir}`)
  }
  return normalizeRoute(`${base}/${withinSection}`)
}

export interface RouteIndex {
  routes: Set<string>
  /** Exact redirect sources (without hash) → destination. */
  redirects: Map<string, string>
  /** Redirects with a `:path*` wildcard: source prefix → destination prefix. */
  wildcardRedirects: { sourcePrefix: string; destinationPrefix: string }[]
}

export function buildRouteIndex(files: ContentFile[], redirects: Redirect[]): RouteIndex {
  const routes = new Set<string>()
  for (const file of files) {
    const route = routeForFile(file)
    if (route) routes.add(route)
  }
  const exact = new Map<string, string>()
  const wildcardRedirects: RouteIndex['wildcardRedirects'] = []
  for (const redirect of redirects) {
    if (redirect.source.includes(':path*')) {
      wildcardRedirects.push({
        sourcePrefix: redirect.source.split(':path*')[0],
        destinationPrefix: redirect.destination.split(':path*')[0],
      })
    } else if (!redirect.source.includes('*') && !redirect.source.includes(':')) {
      exact.set(normalizeRoute(redirect.source.split('#', 1)[0]), redirect.destination)
    }
  }
  return { routes, redirects: exact, wildcardRedirects }
}

export async function loadRedirects(rootDir: string): Promise<Redirect[]> {
  const raw = await fs.readFile(path.join(rootDir, 'vercel.redirects.json'), 'utf-8')
  const config = JSON.parse(raw) as { redirects?: Redirect[] }
  return Array.isArray(config.redirects) ? config.redirects : []
}

/** True when a path falls under one of the content section routes. */
export function isSectionPath(pathname: string): boolean {
  return CONTENT_SECTIONS.some(s => pathname === s.route || pathname.startsWith(`${s.route}/`))
}

/** Resolves a redirect for `pathname`, or undefined when no redirect matches. */
export function findRedirect(index: RouteIndex, pathname: string): string | undefined {
  const exact = index.redirects.get(normalizeRoute(pathname))
  if (exact) return exact
  for (const { sourcePrefix, destinationPrefix } of index.wildcardRedirects) {
    if (pathname.startsWith(sourcePrefix)) return destinationPrefix + pathname.slice(sourcePrefix.length)
  }
  return undefined
}

function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1))
      diagonal = temp
    }
  }
  return prev[b.length]
}

/** The closest existing route, preferring routes that end in the same page name. */
export function suggestRoute(index: RouteIndex, pathname: string): string | undefined {
  const lastSegment = pathname.split('/').pop()
  const sameName = [...index.routes].filter(route => route.split('/').pop() === lastSegment)
  if (sameName.length === 1) return sameName[0]

  const candidates = sameName.length > 1 ? sameName : [...index.routes]
  let best: string | undefined
  let bestDistance = Infinity
  for (const route of candidates) {
    const distance = levenshtein(pathname, route)
    if (distance < bestDistance) {
      best = route
      bestDistance = distance
    }
  }
  const threshold = sameName.length > 1 ? Infinity : Math.max(3, Math.floor(pathname.length * 0.3))
  return bestDistance <= threshold ? best : undefined
}
