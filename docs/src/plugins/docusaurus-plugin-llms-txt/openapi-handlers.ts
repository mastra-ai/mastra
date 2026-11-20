/**
 * Handlers for the markup that docusaurus-theme-openapi-docs renders on generated API pages
 * (schema properties, parameter lists, response/schema tabs and their collapsibles).
 */

import type { Element, ElementContent } from 'hast'
import type { BlockContent, DefinitionContent, ListItem, Paragraph, PhrasingContent } from 'mdast'
import type { State } from 'hast-util-to-mdast'

type Block = BlockContent | DefinitionContent

const BLOCK_TYPES = new Set([
  'blockquote',
  'code',
  'definition',
  'footnoteDefinition',
  'heading',
  'html',
  'list',
  'paragraph',
  'table',
  'thematicBreak',
])

const COMPOSITION_LABELS: Record<string, string> = {
  oneOf: 'One of:',
  anyOf: 'Any of:',
  allOf: 'All of:',
}

function classes(node: Element): string[] {
  return (node.properties?.className as string[] | undefined) ?? []
}

function hasClass(node: Element, name: string): boolean {
  return classes(node).includes(name)
}

function textOf(node: ElementContent): string {
  if (node.type === 'text') return node.value
  if (node.type === 'element') return node.children.map(textOf).join('')
  return ''
}

function isElement(node: ElementContent | undefined): node is Element {
  return node?.type === 'element'
}

function findDescendant(node: Element, match: (el: Element) => boolean): Element | undefined {
  for (const child of node.children) {
    if (!isElement(child)) continue
    if (match(child)) return child
    const found = findDescendant(child, match)
    if (found) return found
  }
  return undefined
}

/** A schema property or parameter row. */
export function isSchemaItem(node: ElementContent): node is Element {
  return isElement(node) && (hasClass(node, 'openapi-schema__list-item') || hasClass(node, 'openapi-params__list-item'))
}

/** The faint "Array [" and "]" lines the theme draws around array item schemas. */
function isArrayBracket(node: ElementContent): boolean {
  if (!isElement(node) || node.tagName !== 'li') return false
  const text = textOf(node).trim()
  return text === 'Array [' || text === ']'
}

/** The theme's tabs: response status codes, Schema/Example, and oneOf/anyOf variants. */
export function isOpenApiTabs(node: Element): boolean {
  return hasClass(node, 'openapi-tabs__container') || hasClass(node, 'openapi-tabs__schema-container')
}

export function isOpenApiDetails(node: Element): boolean {
  return node.tagName === 'details' && hasClass(node, 'openapi-markdown__details')
}

export function containsSchemaItems(node: Element): boolean {
  return node.children.some(child => isSchemaItem(child) || isArrayBracket(child))
}

function pushResult(out: Block[], result: ReturnType<State['one']>): void {
  if (!result) return
  if (Array.isArray(result)) out.push(...(result as Block[]))
  else out.push(result as Block)
}

/** Wrap stray phrasing nodes in paragraphs so they can live inside list items. */
function asBlocks(nodes: Array<Block | PhrasingContent>): Block[] {
  const blocks: Block[] = []
  let phrasing: PhrasingContent[] = []
  const flush = () => {
    const meaningful = phrasing.some(node => node.type !== 'text' || node.value.trim())
    if (meaningful) blocks.push({ type: 'paragraph', children: phrasing })
    phrasing = []
  }
  for (const node of nodes) {
    if (BLOCK_TYPES.has(node.type)) {
      flush()
      blocks.push(node as Block)
    } else {
      phrasing.push(node as PhrasingContent)
    }
  }
  flush()
  return blocks
}

/**
 * Convert an element's children, gathering consecutive schema rows into one list so
 * nested properties keep their hierarchy. Behaves like the default conversion when the
 * element holds no schema rows.
 */
export function convertChildren(state: State, parent: Element, children = parent.children): Block[] {
  const out: Block[] = []
  let items: ListItem[] | undefined

  for (const child of children) {
    if (isSchemaItem(child)) {
      ;(items ??= []).push(handleSchemaItem(state, child))
      continue
    }
    if (isArrayBracket(child)) continue
    if (items && child.type === 'text' && !child.value.trim()) continue
    if (items) {
      out.push({ type: 'list', ordered: false, spread: false, children: items })
      items = undefined
    }
    if (isElement(child) && child.tagName === 'span' && hasClass(child, 'badge')) {
      const label = COMPOSITION_LABELS[textOf(child).trim()]
      if (label) {
        out.push({ type: 'paragraph', children: [{ type: 'text', value: label }] })
        continue
      }
    }
    pushResult(out, state.one(child, parent))
  }
  if (items) out.push({ type: 'list', ordered: false, spread: false, children: items })
  return out
}

/**
 * One schema row: `- **name** (`type`, required): description`, followed by its
 * constraints and nested properties.
 */
function handleSchemaItem(state: State, node: Element): ListItem {
  const details = node.children.find((child): child is Element => isElement(child) && child.tagName === 'details')
  let header: Element | undefined
  let body: ElementContent[] = []
  let bodyParent: Element = node

  if (details) {
    const summary = details.children.find((child): child is Element => isElement(child) && child.tagName === 'summary')
    header = summary && findDescendant(summary, el => hasClass(el, 'openapi-schema__container'))
    body = details.children.filter(child => child !== summary)
    bodyParent = details
  } else {
    // <div class="list-item"><div><span class="container">…</span><p>…</p></div></div>, or the container directly.
    const inner = node.children.find(isElement)
    const holder = inner && !hasClass(inner, 'openapi-schema__container') ? inner : node
    header = holder.children.find(
      (child): child is Element => isElement(child) && hasClass(child, 'openapi-schema__container'),
    )
    body = holder.children.filter(child => child !== header)
    bodyParent = holder
  }

  const headerChildren: PhrasingContent[] = []
  if (header) {
    const part = (name: string) => {
      const el = findDescendant(header, child => hasClass(child, name))
      return el ? textOf(el).trim() : ''
    }
    const name = part('openapi-schema__property')
    const type = part('openapi-schema__name') || part('openapi-schema__type')
    const flags = ['openapi-schema__required', 'openapi-schema__nullable', 'openapi-schema__deprecated']
      .map(part)
      .filter(Boolean)

    // Variants of a oneOf/anyOf of primitives have no property name.
    if (name) headerChildren.push({ type: 'strong', children: [{ type: 'text', value: name }] })
    const meta: PhrasingContent[] = []
    if (type) meta.push({ type: 'inlineCode', value: type })
    if (flags.length > 0) meta.push({ type: 'text', value: `${type ? ', ' : ''}${flags.join(', ')}` })
    if (meta.length > 0) {
      if (name) headerChildren.push({ type: 'text', value: ' (' }, ...meta, { type: 'text', value: ')' })
      else headerChildren.push(...meta)
    }
  }

  const blocks = asBlocks(convertChildren(state, bodyParent, body))
  const first = blocks[0]
  if (first?.type === 'paragraph') {
    const only = first.children.length === 1 ? first.children[0] : undefined
    const composition = only?.type === 'text' ? COMPOSITION_LABELS[only.value.trim()] : undefined
    if (composition) {
      // A bare "anyOf"/"oneOf" badge introduces the variant tabs that follow.
      first.children = [{ type: 'text', value: composition }]
    } else if (headerChildren.length > 0 && first.children[0]?.type !== 'strong') {
      // Fold the description into the header line.
      headerChildren.push({ type: 'text', value: ': ' }, ...first.children)
      blocks.shift()
    }
  }

  const children: Block[] = headerChildren.length > 0 ? [{ type: 'paragraph', children: headerChildren }] : []
  children.push(...blocks)
  return { type: 'listItem', spread: false, children: children as ListItem['children'] }
}

/**
 * A top-level collapsible such as "Header Parameters", "Body" or "Response Headers":
 * a bold label followed by its content, without <details> markup.
 */
export function handleOpenApiDetails(state: State, node: Element): Block[] {
  const summary = node.children.find((child): child is Element => isElement(child) && child.tagName === 'summary')
  const out: Block[] = []

  if (summary) {
    const required = findDescendant(summary, el => hasClass(el, 'openapi-schema__required'))
    const textWithout = (el: ElementContent): string =>
      el === required ? ' ' : isElement(el) ? el.children.map(textWithout).join('') : textOf(el)
    const label = textWithout(summary).replace(/\s+/g, ' ').trim()
    if (label) {
      const children: PhrasingContent[] = [{ type: 'strong', children: [{ type: 'text', value: label }] }]
      if (required) children.push({ type: 'text', value: ' (required)' })
      out.push({ type: 'paragraph', children })
    }
  }

  out.push(
    ...convertChildren(
      state,
      node,
      node.children.filter(child => child !== summary),
    ),
  )
  return out
}

/**
 * Response status, Schema/Example and oneOf/anyOf tabs: each panel under a bold label.
 * Headings beside the tab list (the "Responses" heading) are kept.
 */
export function handleOpenApiTabs(state: State, node: Element): Block[] {
  const tabList = findDescendant(node, el => el.properties?.role === 'tablist')
  const labels = tabList ? tabList.children.filter(isElement).map(tab => textOf(tab).replace(/\s+/g, ' ').trim()) : []
  const panelWrapper = node.children.find(
    (child): child is Element =>
      isElement(child) && child.children.some(grand => isElement(grand) && grand.properties?.role === 'tabpanel'),
  )
  const panels = panelWrapper
    ? panelWrapper.children.filter(
        (child): child is Element => isElement(child) && child.properties?.role === 'tabpanel',
      )
    : []

  const out: Block[] = []
  for (const child of node.children) {
    if (child === panelWrapper || !isElement(child)) continue
    const heading = findDescendant(child, el => /^h[1-6]$/.test(el.tagName))
    if (heading) pushResult(out, state.one(heading, child))
  }

  panels.forEach((panel, index) => {
    const label = labels[index] || `Tab ${index + 1}`
    const content = convertChildren(state, panel)
    // The Body/Schema tabs wrap a collapsible that already starts with the same label.
    const first = content[0]
    const repeatsLabel =
      first?.type === 'paragraph' &&
      first.children[0]?.type === 'strong' &&
      first.children[0].children.map(child => (child.type === 'text' ? child.value : '')).join('') === label
    if (!repeatsLabel) {
      out.push({
        type: 'paragraph',
        children: [
          { type: 'strong', children: [{ type: 'text', value: label }] },
          { type: 'text', value: ':' },
        ],
      })
    }
    out.push(...content)
  })
  return out
}
