import type { Element } from 'hast'
import type { State } from 'hast-util-to-mdast'
import type { Html } from 'mdast'

export function handleApiReference(state: State, node: Element) {
  const id = node.properties.dataApiEntry ?? node.properties.dataApiSurface
  const children = state.all(node)
  if (typeof id !== 'string' || !/^api-[a-zA-Z0-9_-]+$/.test(id)) return children
  const anchor: Html = { type: 'html', value: `<a id="${id}"></a>` }
  return [anchor, ...children]
}
