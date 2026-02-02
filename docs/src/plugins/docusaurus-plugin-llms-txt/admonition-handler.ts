/**
 * Custom handler for admonitions to preserve type/title information
 *
 * Admonitions in Docusaurus render as divs with a specific structure:
 * <div class="...">
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

/**
 * Find an element with a specific data-testid attribute within a limited depth
 * This prevents false positives when ancestor divs contain deeply nested admonitions
 * The admonition structure has data-testid="admonition-title" at depth 2 from the container:
 *   admonition div (0) > title row div (1) > span[data-testid] (2)
 */
const MAX_ADMONITION_SEARCH_DEPTH = 2

function findByTestId(node: ElementContent, testId: string, depth = 0): Element | null {
  if (node.type !== 'element') return null

  // Check various property name formats
  const props = node.properties
  const dataTestId = props?.dataTestid ?? props?.['data-testid'] ?? props?.['dataTestId']

  if (dataTestId === testId) {
    return node
  }

  // Limit search depth to avoid matching ancestor divs that contain admonitions
  if (depth >= MAX_ADMONITION_SEARCH_DEPTH) {
    return null
  }

  for (const child of node.children || []) {
    const found = findByTestId(child, testId, depth + 1)
    if (found) return found
  }

  return null
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
 * Find the content div in an admonition (the div after the title row)
 */
function findAdmonitionContent(node: Element): Element | null {
  // The content is typically in the last child div
  const divChildren = node.children.filter(
    (child): child is Element => child.type === 'element' && child.tagName === 'div',
  )

  // Return the last div which should contain the content
  if (divChildren.length >= 2) {
    return divChildren[divChildren.length - 1]
  }

  return null
}

/**
 * Check if an element is an admonition by looking for data-testid="admonition-title"
 */
export function isAdmonition(node: Element): boolean {
  return findByTestId(node, 'admonition-title') !== null
}

/**
 * Handle admonition elements
 * Converts to blockquote format: > **Note:** content
 */
export function handleAdmonition(state: State, node: Element): BlockContent | Array<BlockContent | DefinitionContent> {
  // Find the title element
  const titleElement = findByTestId(node, 'admonition-title')
  const title = titleElement ? getTextContent(titleElement).trim() : 'Note'

  // Capitalize first letter for display
  const displayTitle = title.charAt(0).toUpperCase() + title.slice(1)

  // Find the content div
  const contentDiv = findAdmonitionContent(node)

  // Process content children
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

  // If we have paragraph content, prepend the title to the first paragraph
  if (contentChildren.length > 0 && contentChildren[0].type === 'paragraph') {
    const firstPara = contentChildren[0]
    firstPara.children = [
      { type: 'strong', children: [{ type: 'text', value: `${displayTitle}:` }] },
      { type: 'text', value: ' ' },
      ...firstPara.children,
    ]
  } else {
    // Add a title paragraph if no content or first child isn't a paragraph
    contentChildren.unshift({
      type: 'paragraph',
      children: [{ type: 'strong', children: [{ type: 'text', value: `${displayTitle}:` }] }],
    })
  }

  // Return as blockquote
  return {
    type: 'blockquote',
    children: contentChildren,
  }
}
