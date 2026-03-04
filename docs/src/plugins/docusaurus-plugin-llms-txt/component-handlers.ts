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
 * Structure: <div class="flex flex-col"><div id="propName" class="... border-b ...">...</div>...</div>
 */
export function isPropertiesTable(node: Element): boolean {
  // Check if this is a flex flex-col container
  const classNames = node.properties?.className as string[] | undefined
  if (!classNames) return false

  const hasFlexCol =
    classNames.includes('flex') && classNames.some(cls => cls === 'flex-col' || cls.startsWith('flex-col'))

  if (!hasFlexCol) return false

  // Check if children have id attributes and border-b class (property rows)
  let propertyRowCount = 0
  for (const child of node.children) {
    if (child.type === 'element' && child.properties?.id && hasClass(child, 'border-b')) {
      propertyRowCount++
    }
  }

  return propertyRowCount >= 1
}

/**
 * Handle PropertiesTable - format as definition-style list
 */
export function handlePropertiesTable(
  _state: State,
  node: Element,
): BlockContent | Array<BlockContent | DefinitionContent> {
  const result: Array<BlockContent | DefinitionContent> = []

  for (const child of node.children) {
    if (child.type !== 'element') continue

    const propId = child.properties?.id as string | undefined
    if (!propId) continue

    // Find the h3 with property name
    const h3 = findElementByTag(child, 'h3')
    const propName = h3 ? getTextContent(h3).trim() : propId

    // Find type and default value in the first row div
    let propType = ''
    let defaultValue = ''
    let description = ''

    // Structure: div > (div.group[h3, div(type), div(default)], div(description))
    const divChildren = child.children.filter((c): c is Element => c.type === 'element' && c.tagName === 'div')

    if (divChildren.length >= 1) {
      // First div contains h3, type, and default
      const headerDiv = divChildren[0]
      const headerDivChildren = headerDiv.children.filter(
        (c): c is Element => c.type === 'element' && c.tagName === 'div',
      )

      // Extract type (first div after h3)
      if (headerDivChildren.length >= 1) {
        propType = getTextContent(headerDivChildren[0]).trim()
      }

      // Extract default value (second div after h3, starts with "=")
      if (headerDivChildren.length >= 2) {
        const defaultText = getTextContent(headerDivChildren[1]).trim()
        if (defaultText.startsWith('=')) {
          defaultValue = defaultText.slice(1).trim()
        }
      }
    }

    // Last div is the description
    if (divChildren.length >= 2) {
      description = getTextContent(divChildren[divChildren.length - 1]).trim()
    }

    // Format as: **propName** (`type`): description (Default: value)
    const children: Array<{ type: string; value?: string; children?: Array<{ type: string; value: string }> }> = []

    // Property name in bold
    children.push({
      type: 'strong',
      children: [{ type: 'text', value: propName }],
    })

    // Type in code
    if (propType) {
      children.push({ type: 'text', value: ' (' })
      children.push({ type: 'inlineCode', value: propType })
      children.push({ type: 'text', value: ')' })
    }

    // Description
    if (description) {
      children.push({ type: 'text', value: ': ' + description })
    }

    // Default value
    if (defaultValue) {
      children.push({ type: 'text', value: ' (Default: ' })
      children.push({ type: 'inlineCode', value: defaultValue })
      children.push({ type: 'text', value: ')' })
    }

    result.push({
      type: 'paragraph',
      children: children as Paragraph['children'],
    })
  }

  return result
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
