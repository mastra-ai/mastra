/**
 * Content extraction from HTML using CSS selectors
 */

import type { Root, Element, Text } from 'hast'
import { select, selectAll } from 'hast-util-select'

/**
 * Selectors for elements to remove before processing
 */
const SELECTORS_TO_REMOVE = [
  // Navigation and sidebars
  'nav',
  '.navbar',
  '.theme-doc-sidebar-container',
  '.theme-doc-sidebar-menu',

  // Table of contents
  '.theme-doc-toc-desktop',
  '.theme-doc-toc-mobile',
  '.table-of-contents',

  // Footer and pagination
  '.theme-doc-footer',
  '.footer',
  '.pagination-nav',

  // Breadcrumbs
  '.theme-doc-breadcrumbs',
  '[aria-label="breadcrumbs"]',

  // Skip links and accessibility helpers
  '.skipToContent_fXgn',
  '[class*="skipToContent"]',

  // Scripts and styles
  'script',
  'style',
  'noscript',

  // Edit page links
  '.theme-edit-this-page',

  // Version badges
  '.theme-doc-version-badge',

  // Code block copy buttons
  '.clean-btn',
  'button[class*="copyButton"]',

  // Heading anchor links (Direct link to...)
  '.hash-link',
  'a[aria-label^="Direct link to"]',
  '.sr-only',

  // Code block titles
  '[class*="codeBlockTitle"]',

  // Tab navigation (keep only active tab content)
  '[role="tablist"]',
  '.tabs',
  '[role="tab"]',
  '[class*="tabs__item"]',

  // Admonition type labels and icons
  '[class*="font-mono"][class*="font-bold"][class*="capitalize"]',
  'svg',

  // Video elements (fallback text appears as links)
  'video',
]

export interface PageMetadata {
  title: string
  description: string
}

/**
 * Extract title from the HTML document
 */
export function extractTitle(hast: Root): string {
  // Try <title> tag first
  const titleElement = select('title', hast)
  if (titleElement) {
    const textNode = titleElement.children.find((c): c is Text => c.type === 'text')
    if (textNode) {
      // Clean up title (remove " | Mastra Docs" or similar suffixes)
      let title = textNode.value
      title = title.replace(/\s*\|[^|]*$/, '')
      return title.trim()
    }
  }

  // Try <h1> in the content
  const h1 = select('h1', hast)
  if (h1) {
    return getTextContent(h1)
  }

  return 'Untitled'
}

/**
 * Extract description from meta tags
 */
export function extractDescription(hast: Root): string {
  const metaDesc = select('meta[name="description"]', hast) as Element | null
  if (metaDesc?.properties?.content) {
    return metaDesc.properties.content as string
  }

  const ogDesc = select('meta[property="og:description"]', hast) as Element | null
  if (ogDesc?.properties?.content) {
    return ogDesc.properties.content as string
  }

  return ''
}

/**
 * Extract metadata from the HTML document
 */
export function extractMetadata(hast: Root): PageMetadata {
  return {
    title: extractTitle(hast),
    description: extractDescription(hast),
  }
}

/**
 * Select the main content element from the HTML document
 */
export function selectContent(hast: Root, selectors: string[]): Element | null {
  for (const selector of selectors) {
    const element = select(selector, hast) as Element | null
    if (element) {
      return element
    }
  }

  // Fallback to body
  return select('body', hast) as Element | null
}

/**
 * Remove unwanted elements from the content
 */
export function removeUnwantedElements(node: Element | null): void {
  if (!node) return

  for (const selector of SELECTORS_TO_REMOVE) {
    const elements = selectAll(selector, node)
    for (const el of elements) {
      removeFromParent(el, node)
    }
  }

  // Remove HTML comment nodes
  removeCommentNodes(node)
}

/**
 * Recursively remove comment nodes from the tree
 */
function removeCommentNodes(node: Element): void {
  node.children = node.children.filter(child => child.type !== 'comment')

  for (const child of node.children) {
    if (child.type === 'element') {
      removeCommentNodes(child)
    }
  }
}

/**
 * Remove an element from its parent
 */
function removeFromParent(element: Element, root: Element): void {
  function traverse(parent: Element): boolean {
    const index = parent.children.indexOf(element)
    if (index !== -1) {
      parent.children.splice(index, 1)
      return true
    }

    for (const child of parent.children) {
      if (child.type === 'element') {
        if (traverse(child)) {
          return true
        }
      }
    }

    return false
  }

  traverse(root)
}

/**
 * Get text content from an element
 */
function getTextContent(element: Element): string {
  let text = ''

  for (const child of element.children) {
    if (child.type === 'text') {
      text += child.value
    } else if (child.type === 'element') {
      text += getTextContent(child)
    }
  }

  return text.trim()
}
