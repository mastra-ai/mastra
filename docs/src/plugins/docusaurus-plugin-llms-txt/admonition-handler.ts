/**
 * Custom handler for admonitions to preserve type/title information
 *
 * Admonitions render as divs with the `admonition-container` class:
 * <div class="... admonition-container ...">
 *   <div class="...">
 *     <span class="..."><svg>icon</svg></span>
 *     <span data-testid="admonition-title">note</span>
 *   </div>
 *   <div class="...">content</div>
 * </div>
 */

import type { Element, ElementContent } from 'hast'
import type { BlockContent, DefinitionContent } from 'mdast'
import type { State } from 'hast-util-to-mdast'

function hasClass(node: Element, className: string): boolean {
  const classes = node.properties?.className
  if (Array.isArray(classes)) {
    return classes.includes(className)
  }
  if (typeof classes === 'string') {
    return classes.split(/\s+/).includes(className)
  }
  return false
}

/**
 * Get text content from an element recursively
 */
function getTextContent(node: ElementContent): string {
  if (node.type === 'text') {
    return node.value
  }

  if (node.type === 'element') {
    return node.children.map(getTextContent).join('')
  }

  return ''
}

/**
 * Find the admonition title from the data-testid="admonition-title" span
 */
function findTitle(node: Element): string | null {
  for (const child of node.children) {
    if (child.type !== 'element') continue

    const props = child.properties
    const dataTestId = props?.dataTestid ?? props?.['data-testid'] ?? props?.['dataTestId']
    if (dataTestId === 'admonition-title') {
      return getTextContent(child).trim()
    }

    const found = findTitle(child)
    if (found) return found
  }

  return null
}

/**
 * Find the content div in an admonition (the last child div)
 */
function findContentDiv(node: Element): Element | null {
  const divChildren = node.children.filter(
    (child): child is Element => child.type === 'element' && child.tagName === 'div',
  )

  if (divChildren.length >= 2) {
    return divChildren[divChildren.length - 1]
  }

  return null
}

/**
 * Check if an element is an admonition by looking for the `admonition-container` class
 */
export function isAdmonition(node: Element): boolean {
  return hasClass(node, 'admonition-container')
}

/**
 * Handle admonition elements
 * Converts to blockquote format: > **Note:** content
 */
export function handleAdmonition(state: State, node: Element): BlockContent | Array<BlockContent | DefinitionContent> {
  const title = findTitle(node) ?? 'Note'
  const displayTitle = title.charAt(0).toUpperCase() + title.slice(1)

  const contentDiv = findContentDiv(node)

  const contentChildren: Array<BlockContent | DefinitionContent> = []

  if (contentDiv) {
    for (const child of contentDiv.children) {
      const result = state.one(child, contentDiv)
      if (result) {
        if (Array.isArray(result)) {
          contentChildren.push(...(result as Array<BlockContent | DefinitionContent>))
        } else {
          contentChildren.push(result as BlockContent | DefinitionContent)
        }
      }
    }
  }

  // Prepend the title to the first paragraph, or create a title paragraph
  if (contentChildren.length > 0 && contentChildren[0].type === 'paragraph') {
    const firstPara = contentChildren[0]
    firstPara.children = [
      { type: 'strong', children: [{ type: 'text', value: `${displayTitle}:` }] },
      { type: 'text', value: ' ' },
      ...firstPara.children,
    ]
  } else {
    contentChildren.unshift({
      type: 'paragraph',
      children: [{ type: 'strong', children: [{ type: 'text', value: `${displayTitle}:` }] }],
    })
  }

  return {
    type: 'blockquote',
    children: contentChildren,
  }
}
