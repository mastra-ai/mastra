import { readFileSync } from 'node:fs'
import type { ApiContract } from './model'
import type { ApiItem, ApiSurface, CommentNode } from './presentation'
import { parseContract } from './schema'

/** Test-only helpers shared by the api-reference specs. */

export function loadContract(name: string): ApiContract {
  return parseContract(JSON.parse(readFileSync(new URL(`../data/api-reference/${name}.json`, import.meta.url), 'utf8')))
}

export function surfaceItems(surface: ApiSurface): ApiItem[] {
  return [...surface.entries, ...(surface.definitions ?? [])]
}

export function renderedIds(items: ApiItem[]): string[] {
  return items.flatMap(item => ('target' in item ? [] : [item.id, ...renderedIds(item.nested ?? [])]))
}

export function referenceTargets(items: ApiItem[]): string[] {
  return items.flatMap(item => ('target' in item ? [item.target] : referenceTargets(item.nested ?? [])))
}

export function navigationIds(items: ApiItem[]): string[] {
  return items.flatMap(item =>
    'target' in item
      ? []
      : [...(item.parameterDefinition ? [item.parameterDefinition.id] : []), ...navigationIds(item.nested ?? [])],
  )
}

export function itemLinks(items: ApiItem[]): string[] {
  function comments(nodes: CommentNode[]): string[] {
    return nodes.flatMap(node => [
      ...(node.kind === 'link' ? [node.href] : []),
      ...('children' in node ? comments(node.children) : []),
      ...(node.kind === 'tabs' ? node.items.flatMap(tab => comments(tab.content)) : []),
    ])
  }
  return items.flatMap(item =>
    'target' in item
      ? [item.target]
      : [
          ...comments([
            ...(item.typeContent ?? []),
            ...item.description,
            ...item.deprecated,
            ...item.defaults,
            ...item.examples.flat(),
          ]),
          ...itemLinks(item.nested ?? []),
        ],
  )
}
