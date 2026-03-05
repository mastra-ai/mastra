/**
 * Content extraction from HTML using CSS selectors
 */

import type { Root, Element, Text } from 'hast'
import { select } from 'hast-util-select'

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

// Pre-compiled set of tag names to remove (faster than selector matching)
const TAGS_TO_REMOVE = new Set(['nav', 'script', 'style', 'noscript', 'video', 'svg'])

// Pre-compiled class patterns to match for removal
// These are checked against individual class names AND the full className string
const CLASS_PATTERNS_TO_REMOVE = [
  /^navbar$/,
  /theme-doc-sidebar/,
  /theme-doc-toc/,
  /table-of-contents/,
  /theme-doc-footer/,
  /^footer$/,
  /pagination-nav/,
  /theme-doc-breadcrumbs/,
  /skipToContent/,
  /theme-edit-this-page/,
  /editMetaRow/,
  /theme-doc-version-badge/,
  /clean-btn/,
  /copyButton/,
  /copy-openin-button/,
  /hash-link/,
  /sr-only/,
  /codeBlockTitle/,
  // Note: tabs/tabs__item preserved for tab label extraction
  // Note: font-mono.*font-bold.*capitalize removed - was catching admonition titles
  /tocCollapsible/,
]

// Pre-compiled aria-label patterns
const ARIA_LABEL_PATTERNS_TO_REMOVE = [/^breadcrumbs$/, /^Direct link to/]

// Pre-compiled role patterns - tablist/tab preserved for tabs handling
const ROLES_TO_REMOVE = new Set<string>([])

/**
 * Check if an element should be removed based on its properties
 */
function shouldRemoveElement(el: Element): boolean {
  // Check tag name
  if (TAGS_TO_REMOVE.has(el.tagName)) {
    return true
  }

  const props = el.properties
  if (!props) return false

  // Check className - test each class individually AND the full string
  const className = props.className
  if (className) {
    const classes = Array.isArray(className) ? className : [String(className)]
    const classStr = classes.join(' ')

    // Test each individual class name
    for (const cls of classes) {
      const clsStr = String(cls)
      for (const pattern of CLASS_PATTERNS_TO_REMOVE) {
        if (pattern.test(clsStr)) {
          return true
        }
      }
    }

    // Also test the combined string for patterns that span multiple classes
    for (const pattern of CLASS_PATTERNS_TO_REMOVE) {
      if (pattern.test(classStr)) {
        return true
      }
    }
  }

  // Check aria-label
  const ariaLabel = props.ariaLabel || props['aria-label']
  if (ariaLabel) {
    const labelStr = String(ariaLabel)
    for (const pattern of ARIA_LABEL_PATTERNS_TO_REMOVE) {
      if (pattern.test(labelStr)) {
        return true
      }
    }
  }

  // Check role
  const role = props.role
  if (role && ROLES_TO_REMOVE.has(String(role))) {
    return true
  }

  return false
}

/**
 * Remove unwanted elements from the content in a single pass
 */
export function removeUnwantedElements(node: Element | null): void {
  if (!node) return

  // Single-pass recursive filter that removes unwanted elements and comments
  function filterChildren(el: Element): void {
    el.children = el.children.filter(child => {
      // Remove comments
      if (child.type === 'comment') {
        return false
      }

      // Check elements
      if (child.type === 'element') {
        if (shouldRemoveElement(child)) {
          return false
        }
        // Recursively filter children
        filterChildren(child)
      }

      return true
    })
  }

  filterChildren(node)
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
