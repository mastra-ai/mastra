import type { Element } from 'hast'
import { defaultHandlers } from 'hast-util-to-mdast'
import type { State } from 'hast-util-to-mdast'
import type { Html } from 'mdast'

export function handleApiSource(state: State, node: Element) {
  const source = node.properties.dataApiSource
  if (typeof source !== 'string') return state.all(node)
  const link = node.children.find(child => child.type === 'element' && child.tagName === 'a')
  return state.all({
    type: 'element',
    tagName: 'span',
    properties: {},
    children: [
      { type: 'text', value: 'Source: ' },
      link?.type === 'element'
        ? { ...link, properties: { ...link.properties, title: undefined }, children: [{ type: 'text', value: source }] }
        : { type: 'text', value: source },
    ],
  })
}

export function handleApiType(state: State, node: Element) {
  if (node.properties.dataApiType === undefined) return defaultHandlers.code(state, node)
  return state.all(node)
}

export function handleApiTable(state: State, node: Element) {
  if (node.properties.dataApiTable === undefined) return defaultHandlers.table(state, node)
  const bodies = node.children.filter(child => child.type === 'element' && child.tagName === 'tbody')
  const rows: Element[] = []
  for (const body of bodies) {
    if (body.type !== 'element') continue
    for (const row of body.children) {
      if (row.type !== 'element' || row.tagName !== 'tr') continue
      rows.push({
        ...row,
        tagName: 'article',
        children: row.children.map(cell =>
          cell.type === 'element'
            ? {
                ...cell,
                tagName: cell.tagName === 'th' ? 'h6' : 'div',
              }
            : cell,
        ),
      })
    }
  }
  return state.all({ type: 'element', tagName: 'div', properties: {}, children: rows })
}

export function handleApiReference(state: State, node: Element) {
  const id =
    node.properties.dataApiEntry ??
    node.properties.dataApiSurface ??
    (node.properties.dataApiDefinition ? node.properties.id : undefined)
  const children = state.all(node)
  if (typeof id !== 'string' || !/^api-[a-zA-Z0-9_-]+$/.test(id)) return children
  const anchor: Html = { type: 'html', value: `<a id="${id}"></a>` }
  return [anchor, ...children]
}
