import { compileComment, safeCommentUrl } from './comments'
import type { ApiContract, ApiDeclaration } from './model'
import { memberAnchor } from './presentation'
import type { ApiEntry, ApiItem, ApiSurface, CommentNode } from './presentation'
import { requiresDescription, traverseSurface } from './traversal'
import { typeContent } from './type-content'
import type { ApiSection, SurfaceGraph } from './traversal'

interface CompositionOptions {
  sourceLinks?: ReadonlyMap<string, string>
  destinations?: ReadonlyMap<string, string>
}

export function composeSurfaces(
  selections: { contract: ApiContract; section: ApiSection }[],
  options: CompositionOptions = {},
): ApiSurface[] {
  const graphs = selections.map(({ contract, section }) => traverseSurface(contract, section))
  const surfaceKeys = graphs.map(graph => `${graph.root}:${graph.section}`)
  if (new Set(surfaceKeys).size !== surfaceKeys.length) throw new Error('Duplicate canonical API surface')
  const destinations = new Map(options.destinations)
  const roots = new Set(graphs.flatMap(graph => graph.groups.flatMap(group => group.entries)))
  for (const graph of graphs) for (const id of graph.nodes.keys()) destinations.set(id, `#${memberAnchor(id)}`)
  const emitted = new Set<string>()

  function project(node: ApiDeclaration, graph: SurfaceGraph): ApiEntry {
    emitted.add(node.id)
    const tags = node.comment?.tags ?? []
    const tagContent = (name: string) =>
      tags.filter(tag => tag.name === name).flatMap(tag => compileComment(tag.content, destinations))
    const defaults = [...tagContent('@default'), ...tagContent('@defaultValue')].map(
      (part): CommentNode =>
        part.kind === 'code' ? { kind: 'element', tag: 'code', children: [{ kind: 'text', value: part.value }] } : part,
    )
    const source = node.source ? `${node.source.path}:${node.source.line}` : undefined
    const sourceUrl = source ? options.sourceLinks?.get(source) : undefined
    const edges = graph.nodes.get(node.id)?.edges ?? []
    const targets = [...new Set(edges.map(edge => edge.target))]
    return {
      id: memberAnchor(node.id),
      name: node.name.startsWith('__') ? (node.kind === 'CallSignature' ? 'Callback' : 'Object') : node.name,
      type: node.type?.display,
      typeContent: typeContent(node.type, destinations),
      optional: node.flags.includes('isOptional'),
      description: [
        ...compileComment(node.comment?.summary ?? [], destinations),
        ...tagContent('@remarks'),
        ...tagContent('@see'),
      ],
      descriptionRequired: requiresDescription(node),
      deprecated: tagContent('@deprecated'),
      defaults,
      examples: tags.filter(tag => tag.name === '@example').map(tag => compileComment(tag.content, destinations)),
      ...(source ? { source } : {}),
      ...(sourceUrl ? { sourceUrl: safeCommentUrl(sourceUrl) } : {}),
      nested: targets.map(id => item(id, graph, false)),
    }
  }

  function item(id: string, graph: SurfaceGraph, topLevel: boolean): ApiItem {
    const node = graph.nodes.get(id)?.declaration
    if (!node) throw new Error(`Missing rendered declaration: ${id}`)
    if (emitted.has(id) || (!topLevel && roots.has(id))) return { target: `#${memberAnchor(id)}`, name: node.name }
    return project(node, graph)
  }

  return graphs.map((graph, index) => {
    const contract = selections[index].contract
    let entries: ApiEntry[]
    if (graph.section === 'properties' || graph.section === 'signatures') {
      entries = graph.groups[0].entries.map((id, ordinal) => {
        if (emitted.has(id)) throw new Error(`Duplicate canonical API owner: ${id}`)
        const node = contract.declarations[id]
        const entry = project(node, graph)
        if (graph.section === 'signatures') {
          if (!node.sourceSignature) throw new Error(`Missing source signature: ${id}`)
          entry.name = `Overload ${ordinal + 1}`
          entry.signature = node.sourceSignature
          entry.type = undefined
        }
        return entry
      })
    } else {
      entries = graph.groups.map(group => {
        return {
          id: memberAnchor(`${group.owner}:${graph.section}`),
          name: group.label,
          type: group.type?.display,
          typeContent: typeContent(group.type, destinations),
          optional: false,
          description: compileComment(group.description ?? [], destinations),
          descriptionRequired: graph.section === 'returns',
          deprecated: [],
          defaults: [],
          examples: [],
          nested: group.entries.map(id => item(id, graph, true)),
        }
      })
    }
    return {
      section: graph.section,
      id: memberAnchor(surfaceKeys[index]),
      title: { properties: 'Properties', signatures: 'Signatures', parameters: 'Parameters', returns: 'Returns' }[
        graph.section
      ],
      entries,
    }
  })
}

export function composeSurface(
  contract: ApiContract,
  section: ApiSection,
  options: CompositionOptions = {},
): ApiSurface {
  return composeSurfaces([{ contract, section }], options)[0]
}
