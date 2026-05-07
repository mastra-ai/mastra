/**
 * Custom handlers for Docusaurus components (tabs, details, etc.)
 */

import type { Element, ElementContent } from 'hast'
import type { BlockContent, DefinitionContent, Paragraph, Text, Strong } from 'mdast'
import type { State } from 'hast-util-to-mdast'

/**
 * Get text content from an element recursively
 */
function getTextContent(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') {
    return node.children.map(getTextContent).join('')
  }
  return ''
}

/**
 * Check if a class name matches a pattern (handles hashed class names)
 */
function classMatches(className: string, pattern: string): boolean {
  return className === pattern || className.startsWith(pattern + '_') || className.startsWith(pattern + '-')
}

/**
 * Check if an element has a class matching the pattern
 */
function hasClass(node: Element, pattern: string): boolean {
  const classNames = node.properties?.className as string[] | undefined
  if (!classNames) return false
  return classNames.some(cls => classMatches(cls, pattern))
}

// ============================================
// TABS HANDLER
// ============================================

/**
 * Check if an element is a tabs container
 * Structure:
 * <div class="theme-tabs-container">
 *   <ul role="tablist" class="tabs">
 *     <li role="tab" class="tabs__item">Tab 1</li>
 *     <li role="tab" class="tabs__item">Tab 2</li>
 *   </ul>
 *   <div>
 *     <div role="tabpanel">Content 1</div>
 *     <div role="tabpanel" hidden>Content 2</div>
 *   </div>
 * </div>
 */
export function isTabsContainer(node: Element): boolean {
  return hasClass(node, 'theme-tabs-container') || hasClass(node, 'tabs-container')
}

/**
 * Handle tabs container - convert to labeled sections
 */
export function handleTabsContainer(
  state: State,
  node: Element,
): BlockContent | Array<BlockContent | DefinitionContent> {
  const result: Array<BlockContent | DefinitionContent> = []

  // Find the tab list (ul with role="tablist")
  const tabList = findElementByRole(node, 'tablist')
  const tabLabels: string[] = []

  if (tabList) {
    // Extract tab labels from li elements
    for (const child of tabList.children) {
      if (child.type === 'element' && child.tagName === 'li') {
        tabLabels.push(getTextContent(child).trim())
      }
    }
  }

  // Find tab panels (divs with role="tabpanel")
  const tabPanels = findAllElementsByRole(node, 'tabpanel')

  // Generate output: pair labels with content
  for (let i = 0; i < tabPanels.length; i++) {
    const label = tabLabels[i] || `Tab ${i + 1}`
    const panel = tabPanels[i]

    // Add label as bold text
    const labelPara: Paragraph = {
      type: 'paragraph',
      children: [
        { type: 'strong', children: [{ type: 'text', value: label }] } as Strong,
        { type: 'text', value: ':' } as Text,
      ],
    }
    result.push(labelPara)

    // Process panel content
    for (const child of panel.children) {
      const processed = state.one(child, panel)
      if (processed) {
        if (Array.isArray(processed)) {
          result.push(...(processed as Array<BlockContent | DefinitionContent>))
        } else {
          result.push(processed as BlockContent | DefinitionContent)
        }
      }
    }
  }

  return result
}

// ============================================
// DETAILS HANDLER
// ============================================

/**
 * Check if an element is a details element
 */
export function isDetails(node: Element): boolean {
  return node.tagName === 'details'
}

/**
 * Handle details element - convert to collapsible format
 * Output format:
 * <details>
 * **Summary text**
 *
 * Content here...
 * </details>
 */
export function handleDetails(state: State, node: Element): BlockContent | Array<BlockContent | DefinitionContent> {
  const result: Array<BlockContent | DefinitionContent> = []

  // Find summary element
  let summaryText = 'Details'
  const summary = node.children.find(
    (child): child is Element => child.type === 'element' && child.tagName === 'summary',
  )
  if (summary) {
    summaryText = getTextContent(summary).trim()
  }

  // Add opening marker with summary as bold
  result.push({
    type: 'paragraph',
    children: [
      { type: 'html', value: '<details>' },
      { type: 'text', value: '\n' },
      { type: 'strong', children: [{ type: 'text', value: summaryText }] } as Strong,
    ],
  } as Paragraph)

  // Process content (skip the summary element)
  for (const child of node.children) {
    if (child.type === 'element' && child.tagName === 'summary') continue

    const processed = state.one(child, node)
    if (processed) {
      if (Array.isArray(processed)) {
        result.push(...(processed as Array<BlockContent | DefinitionContent>))
      } else {
        result.push(processed as BlockContent | DefinitionContent)
      }
    }
  }

  // Add closing marker
  result.push({
    type: 'paragraph',
    children: [{ type: 'html', value: '</details>' }],
  } as Paragraph)

  return result
}

// ============================================
// CARD GRID HANDLER (Reference Cards - card__grid class)
// ============================================

/**
 * Check if an element is a card grid (Reference Cards component with card__grid class)
 */
export function isCardGrid(node: Element): boolean {
  return hasClass(node, 'card__grid')
}

/**
 * Handle card grid - format links on separate lines
 * The card__grid contains:
 * - Filter buttons (skip these)
 * - Grid of links (format as bullet list)
 */
export function handleCardGrid(_state: State, node: Element): BlockContent | Array<BlockContent | DefinitionContent> {
  const result: Array<BlockContent | DefinitionContent> = []

  // Find all links in the card grid
  const links = findAllElementsByTag(node, 'a')

  if (links.length > 0) {
    // Create a list of links
    const listItems = links.map(link => {
      const href = link.properties?.href as string | undefined
      const text = getTextContent(link).trim()

      // Skip empty links
      if (!text || !href) return null

      return {
        type: 'listItem' as const,
        spread: false,
        children: [
          {
            type: 'paragraph' as const,
            children: [
              {
                type: 'link' as const,
                url: href.startsWith('/') ? `https://mastra.ai${href}` : href,
                children: [{ type: 'text' as const, value: text }],
              },
            ],
          },
        ],
      }
    })

    const validItems = listItems.filter(item => item !== null)

    if (validItems.length > 0) {
      result.push({
        type: 'list',
        ordered: false,
        spread: false,
        children: validItems,
      })
    }
  }

  return result
}

// ============================================
// CARD GRID ITEMS HANDLER (CardGrid component - grid layout with data-slot=card)
// ============================================

/**
 * Check if an element is a CardGrid items container (grid with card items)
 * Structure: <div class="grid grid-cols-1 ..."><a><div data-slot="card">...</div></a>...</div>
 */
export function isCardGridItems(node: Element): boolean {
  const classNames = node.properties?.className as string[] | undefined
  if (!classNames) return false

  // Check for grid layout class
  const hasGridClass = classNames.some(cls => cls.startsWith('grid') && cls !== 'card__grid')
  if (!hasGridClass) return false

  // Check if it contains card items (a > div[data-slot=card])
  for (const child of node.children) {
    if (child.type === 'element' && child.tagName === 'a') {
      for (const grandchild of child.children) {
        if (grandchild.type === 'element' && grandchild.properties?.dataSlot === 'card') {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Handle CardGrid items - extract card titles and links
 */
export function handleCardGridItems(
  _state: State,
  node: Element,
): BlockContent | Array<BlockContent | DefinitionContent> {
  const result: Array<BlockContent | DefinitionContent> = []
  const listItems: Array<{
    type: 'listItem'
    spread: boolean
    children: Array<{
      type: 'paragraph'
      children: Array<{ type: 'link'; url: string; children: Array<{ type: 'text'; value: string }> }>
    }>
  }> = []

  // Find all card links
  for (const child of node.children) {
    if (child.type === 'element' && child.tagName === 'a') {
      const href = child.properties?.href as string | undefined
      if (!href) continue

      // Find the card title
      const cardTitle = findElementByDataSlot(child, 'card-title')
      const title = cardTitle ? getTextContent(cardTitle).trim() : ''

      if (title) {
        listItems.push({
          type: 'listItem',
          spread: false,
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: href.startsWith('/') ? `https://mastra.ai${href}` : href,
                  children: [{ type: 'text', value: title }],
                },
              ],
            },
          ],
        })
      }
    }
  }

  if (listItems.length > 0) {
    result.push({
      type: 'list',
      ordered: false,
      spread: false,
      children: listItems,
    })
  }

  return result
}

// ============================================
// PROPERTIES TABLE HANDLER
// ============================================

/**
 * Check if an element is a PropertiesTable container
 */
export function isPropertiesTable(node: Element): boolean {
  return node.properties?.dataTestid === 'properties-table'
}

/**
 * Find all descendant elements with a specific data-testid, stopping at boundary nodes.
 * Does not recurse into elements with data-testid matching the target (avoids double-collecting)
 * or into property-nested boundaries (those are handled by recursive extractPropertyRows calls).
 */
function findAllByTestId(node: Element, testId: string): Element[] {
  const results: Element[] = []
  function search(el: Element) {
    for (const child of el.children) {
      if (child.type === 'element') {
        if (child.properties?.dataTestid === testId) {
          results.push(child)
          // Don't recurse into matched elements — their children belong to them
          continue
        }
        // Don't cross into nested property containers — they're handled recursively
        if (child.properties?.dataTestid === 'property-nested') continue
        search(child)
      }
    }
  }
  search(node)
  return results
}

/**
 * Find the first descendant element with a specific data-testid.
 * Stops recursion at property-row and property-nested boundaries to avoid
 * picking up values from nested property rows. Still returns those boundary
 * elements if they match the requested testId.
 */
function findByTestId(node: Element, testId: string): Element | null {
  for (const child of node.children) {
    if (child.type === 'element') {
      if (child.properties?.dataTestid === testId) return child
      // Don't recurse into nested property rows or nested containers
      // to avoid picking up wrong values (e.g. child's type for parent)
      const childTestId = child.properties?.dataTestid as string | undefined
      if (childTestId === 'property-row' || childTestId === 'property-nested') continue
      const found = findByTestId(child, testId)
      if (found) return found
    }
  }
  return null
}

/**
 * Extract property rows from a container, supporting nested properties with a parent prefix.
 * Each row is formatted as: **name** (`type`): description (Default: value)
 * Nested properties are prefixed: **parent.child** (`type`): description
 */
function extractPropertyRows(node: Element, prefix: string): Array<BlockContent | DefinitionContent> {
  const result: Array<BlockContent | DefinitionContent> = []
  const rows = findAllByTestId(node, 'property-row')

  for (const row of rows) {
    // Extract name from data-testid="property-name"
    const nameEl = findByTestId(row, 'property-name')
    const rawName = nameEl ? getTextContent(nameEl).trim() : ''
    // The name text includes the "?:" or ":" suffix from the <span> — strip it
    const propName = rawName.replace(/\??:$/, '')
    const fullName = prefix ? `${prefix}.${propName}` : propName

    // Extract type from data-testid="property-type"
    const typeEl = findByTestId(row, 'property-type')
    const propType = typeEl ? getTextContent(typeEl).trim() : ''

    // Extract default value from data-testid="property-default"
    const defaultEl = findByTestId(row, 'property-default')
    let defaultValue = ''
    if (defaultEl) {
      const defaultText = getTextContent(defaultEl).trim()
      defaultValue = defaultText.startsWith('=') ? defaultText.slice(1).trim() : defaultText
    }

    // Extract description from data-testid="property-description"
    const descEl = findByTestId(row, 'property-description')
    const description = descEl ? getTextContent(descEl).trim() : ''

    // Format as: **fullName** (`type`): description (Default: value)
    const children: Array<{ type: string; value?: string; children?: Array<{ type: string; value: string }> }> = []

    children.push({
      type: 'strong',
      children: [{ type: 'text', value: fullName }],
    })

    if (propType) {
      children.push({ type: 'text', value: ' (' })
      children.push({ type: 'inlineCode', value: propType })
      children.push({ type: 'text', value: ')' })
    }

    if (description) {
      children.push({ type: 'text', value: ': ' + description })
    }

    if (defaultValue) {
      children.push({ type: 'text', value: ' (Default: ' })
      children.push({ type: 'inlineCode', value: defaultValue })
      children.push({ type: 'text', value: ')' })
    }

    result.push({
      type: 'paragraph',
      children: children as Paragraph['children'],
    })

    // Recursively process nested properties (data-testid="property-nested")
    const nestedContainer = findByTestId(row, 'property-nested')
    if (nestedContainer) {
      result.push(...extractPropertyRows(nestedContainer, fullName))
    }
  }

  return result
}

/**
 * Handle PropertiesTable - format as definition-style list with nested property prefixes
 */
export function handlePropertiesTable(
  _state: State,
  node: Element,
): BlockContent | Array<BlockContent | DefinitionContent> {
  return extractPropertyRows(node, '')
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Find an element by role attribute recursively
 */
function findElementByRole(node: Element, role: string): Element | null {
  for (const child of node.children) {
    if (child.type === 'element') {
      if (child.properties?.role === role) {
        return child
      }
      const found = findElementByRole(child, role)
      if (found) return found
    }
  }
  return null
}

/**
 * Find all elements by role attribute recursively
 */
function findAllElementsByRole(node: Element, role: string): Element[] {
  const results: Element[] = []

  function search(el: Element) {
    for (const child of el.children) {
      if (child.type === 'element') {
        if (child.properties?.role === role) {
          results.push(child)
        }
        search(child)
      }
    }
  }

  search(node)
  return results
}

/**
 * Find all elements by tag name recursively
 */
function findAllElementsByTag(node: Element, tagName: string): Element[] {
  const results: Element[] = []

  function search(el: Element) {
    for (const child of el.children) {
      if (child.type === 'element') {
        if (child.tagName === tagName) {
          results.push(child)
        }
        search(child)
      }
    }
  }

  search(node)
  return results
}

/**
 * Find an element by tag name recursively (first match)
 */
function findElementByTag(node: Element, tagName: string): Element | null {
  for (const child of node.children) {
    if (child.type === 'element') {
      if (child.tagName === tagName) {
        return child
      }
      const found = findElementByTag(child, tagName)
      if (found) return found
    }
  }
  return null
}

/**
 * Find an element by data-slot attribute recursively
 */
function findElementByDataSlot(node: Element, slotName: string): Element | null {
  for (const child of node.children) {
    if (child.type === 'element') {
      if (child.properties?.dataSlot === slotName) {
        return child
      }
      const found = findElementByDataSlot(child, slotName)
      if (found) return found
    }
  }
  return null
}
