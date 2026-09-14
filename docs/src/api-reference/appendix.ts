import type { ApiItem, ApiSurface, CommentNode } from './presentation'

export function partitionMethod(surface: ApiSurface, methodPath: string, companions: ApiSurface[] = []) {
  if (surface.section !== 'method') throw new Error('Only complete methods have a type appendix')
  const appendixPath = `${methodPath.replace(/\/$/, '')}/types`
  const direct = new Set<string>()
  function references(items: ApiItem[]) {
    for (const item of items) {
      if ('target' in item) direct.add(item.target.slice(1))
      else references(item.nested ?? [])
    }
  }
  references(surface.entries)
  const method = structuredClone(surface)
  const definitions = method.definitions ?? []
  method.definitions = definitions.filter(entry => direct.has(entry.id))
  const appendix: ApiSurface = {
    section: 'properties',
    id: `${surface.id}-types`,
    title: 'Supporting types',
    entries: definitions.filter(entry => !direct.has(entry.id)).sort((a, b) => a.name.localeCompare(b.name, 'en')),
  }
  const related = structuredClone(companions)
  const owners = new Map<string, string>()
  const navigation = new Map<string, string>()
  function own(items: ApiItem[], page: string) {
    for (const item of items) {
      if ('target' in item) continue
      if (owners.has(item.id)) throw new Error(`Duplicate canonical API owner: ${item.id}`)
      owners.set(item.id, page)
      if (item.parameterDefinition) navigation.set(item.parameterDefinition.id, page)
      own(item.nested ?? [], page)
    }
  }
  own([...method.entries, ...(method.definitions ?? [])], methodPath)
  own(appendix.entries, appendixPath)
  for (const other of related) own([...other.entries, ...(other.definitions ?? [])], methodPath)
  function destination(href: string, page: string) {
    if (!href.startsWith('#')) return href
    const owner = owners.get(href.slice(1)) ?? navigation.get(href.slice(1))
    if (!owner && href.startsWith('#api-')) throw new Error(`Missing appendix target: ${href}`)
    return owner && owner !== page ? `${owner}${href}` : href
  }
  function comments(nodes: CommentNode[], page: string) {
    for (const node of nodes) {
      if (node.kind === 'link') node.href = destination(node.href, page)
      if ('children' in node) comments(node.children, page)
      if (node.kind === 'tabs') for (const tab of node.items) comments(tab.content, page)
    }
  }
  function rewrite(items: ApiItem[], page: string) {
    for (const item of items) {
      if ('target' in item) {
        item.target = destination(item.target, page)
        continue
      }
      for (const content of [
        item.typeContent ?? [],
        item.description,
        item.deprecated,
        item.defaults,
        ...item.examples,
      ])
        comments(content, page)
      rewrite(item.nested ?? [], page)
    }
  }
  rewrite([...method.entries, ...(method.definitions ?? [])], methodPath)
  rewrite(appendix.entries, appendixPath)
  for (const other of related) rewrite([...other.entries, ...(other.definitions ?? [])], methodPath)
  return { method, appendix, methodPath, appendixPath, companions: related }
}
