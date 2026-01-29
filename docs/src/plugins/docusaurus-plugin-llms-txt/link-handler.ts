/**
 * Custom handler for links to convert internal links to llms.txt URLs
 */

import type { Element } from 'hast'
import type { Link, PhrasingContent } from 'mdast'
import type { State } from 'hast-util-to-mdast'

export interface LinkHandlerOptions {
  siteUrl: string
}

/**
 * Check if a URL is an internal link
 */
function isInternalLink(href: string | undefined): boolean {
  if (!href) return false

  // External links
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return false
  }

  // Anchor-only links
  if (href.startsWith('#')) {
    return false
  }

  // Protocol links (mailto:, tel:, etc.)
  if (href.includes(':')) {
    return false
  }

  return true
}

/**
 * Normalize a route path
 */
function normalizeRoute(href: string): string {
  // Remove leading ./ or ../
  let normalized = href.replace(/^\.\//, '/').replace(/^\.\.\//, '/')

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized
  }

  // Remove trailing slash
  if (normalized.endsWith('/') && normalized.length > 1) {
    normalized = normalized.slice(0, -1)
  }

  // Remove hash and query params
  normalized = normalized.split('#')[0].split('?')[0]

  return normalized
}

/**
 * Create a link handler with the given options
 */
export function createLinkHandler(options: LinkHandlerOptions) {
  return function handleLink(state: State, node: Element): Link {
    const href = node.properties?.href as string | undefined
    const title = node.properties?.title as string | undefined

    // Process children to get link text
    const children: PhrasingContent[] = []
    for (const child of node.children || []) {
      const result = state.one(child, node)
      if (result) {
        if (Array.isArray(result)) {
          children.push(...(result as PhrasingContent[]))
        } else {
          children.push(result as PhrasingContent)
        }
      }
    }

    // Convert internal links to llms.txt URLs
    let finalHref = href || ''
    if (isInternalLink(href)) {
      const route = normalizeRoute(href!)
      finalHref = `${options.siteUrl}${route}/llms.txt`
    }

    return {
      type: 'link',
      url: finalHref,
      title: title || null,
      children,
    }
  }
}
