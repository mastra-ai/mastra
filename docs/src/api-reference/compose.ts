import ts from 'typescript'
import { compileComment, safeCommentUrl } from './comments'
import { discriminatedUnion } from './discriminated-union'
import type { ApiContract, ApiDeclaration } from './model'
import { memberAnchor } from './presentation'
import type { ApiEntry, ApiItem, ApiSurface, CommentNode } from './presentation'
import { methodSections, requiresDescription, traverseSurface } from './traversal'
import { isObjectType, typeContent } from './type-content'
import type { ApiSection, SurfaceGraph } from './traversal'

interface CompositionOptions {
  sourceLinks?: ReadonlyMap<string, string>
  destinations?: ReadonlyMap<string, string>
}

export function composeSurfaces(
  selections: { contract: ApiContract; section: ApiSection }[],
  options: CompositionOptions = {},
): ApiSurface[] {
  if (selections.some(selection => selection.section === 'method')) {
    const expanded = selections.flatMap(selection =>
      selection.section === 'method'
        ? methodSections.map(section => ({ contract: selection.contract, section }))
        : [selection],
    )
    const composed = composeSurfaces(expanded, options)
    const parts = new Map(
      expanded.map((selection, index) => [`${selection.contract.root}:${selection.section}`, composed[index]!]),
    )
    function part(contract: ApiContract, section: (typeof methodSections)[number]): ApiSurface {
      const surface = parts.get(`${contract.root}:${section}`)
      if (!surface) throw new Error(`Missing ${section} surface for ${contract.root}`)
      return surface
    }
    return selections.map(selection => {
      const signatures = part(selection.contract, 'signatures')
      if (selection.section !== 'method') return signatures
      const parameters = part(selection.contract, 'parameters')
      const returns = part(selection.contract, 'returns')
      const named = (surface: ApiSurface) => new Map(surface.entries.map(entry => [entry.name, entry]))
      const parametersByName = named(parameters)
      const returnsByName = named(returns)
      return {
        section: 'method' as const,
        id: memberAnchor(`${selection.contract.root}:method`),
        title: 'Method',
        entries: signatures.entries.map(entry => {
          const parameter = parametersByName.get(entry.name)
          const result = returnsByName.get(entry.name)
          if (!parameter || !result)
            throw new Error(`Missing overload parts for ${selection.contract.root} ${entry.name}`)
          return {
            ...entry,
            nested: [...(entry.nested ?? []), { ...parameter, name: 'Parameters' }, { ...result, name: 'Returns' }],
          }
        }),
        definitions: [signatures, parameters, returns].flatMap(surface => surface.definitions ?? []),
      }
    })
  }
  const graphs = selections.map(({ contract, section }) => traverseSurface(contract, section))
  const surfaceKeys = graphs.map(graph => `${graph.root}:${graph.section}`)
  if (new Set(surfaceKeys).size !== surfaceKeys.length) throw new Error('Duplicate canonical API surface')
  const destinations = new Map(options.destinations)
  const roots = new Set(graphs.flatMap(graph => graph.groups.flatMap(group => group.entries)))
  for (const graph of graphs) for (const id of graph.nodes.keys()) destinations.set(id, `#${memberAnchor(id)}`)
  const emitted = new Set<string>()
  const namedKinds = new Set(['Interface', 'TypeAlias', 'Class', 'Enum'])
  const definitions = new Set<string>()
  const inlineBodies = new Set<string>()
  for (const graph of graphs)
    for (const { declaration } of graph.nodes.values()) {
      if (namedKinds.has(declaration.kind) && declaration.type?.kind === 'reflection' && declaration.type.declaration)
        inlineBodies.add(declaration.type.declaration)
    }
  for (const graph of graphs)
    for (const { declaration } of graph.nodes.values()) {
      if (
        (namedKinds.has(declaration.kind) && !declaration.name.startsWith('__')) ||
        (graph.section !== 'properties' && declaration.kind === 'TypeLiteral' && !inlineBodies.has(declaration.id))
      )
        definitions.add(declaration.id)
    }
  const unions = new Map<string, NonNullable<ReturnType<typeof discriminatedUnion>>>()
  const variantValues = new Map<string, string>()
  const variantDiscriminators = new Map<string, string>()
  for (const [index, graph] of graphs.entries())
    for (const { declaration } of graph.nodes.values()) {
      if (graph.section === 'properties') continue
      const union = discriminatedUnion(declaration.type, selections[index].contract)
      if (!union) continue
      unions.set(declaration.id, union)
      for (const variant of union.variants) {
        definitions.delete(variant.id)
        variantValues.set(variant.id, variant.value)
        variantDiscriminators.set(variant.id, memberAnchor(variant.discriminator))
      }
    }
  const structuralLabels = new Map<string, string>()
  const labeled = new Set<string>()
  function labelStructures(id: string, graph: SurfaceGraph, prefix: string) {
    if (labeled.has(id)) return
    labeled.add(id)
    const current = graph.nodes.get(id)
    if (!current) return
    const node = current.declaration
    const context = namedKinds.has(node.kind)
      ? node.name
      : node.name.startsWith('__')
        ? prefix
        : prefix
          ? `${prefix}.${node.name}`
          : node.name
    if (node.kind === 'TypeLiteral') {
      const onlyChild = node.children.length === 1 ? graph.nodes.get(node.children[0])?.declaration : undefined
      const suffix = onlyChild?.kind === 'Property' ? `.${onlyChild.name}` : ' object'
      structuralLabels.set(id, `${context || 'Anonymous'}${suffix}`)
    }
    for (const edge of current.edges) labelStructures(edge.target, graph, context)
  }
  for (const graph of graphs)
    for (const group of graph.groups)
      for (const id of group.entries) {
        labelStructures(id, graph, graph.section === 'parameters' ? group.label : '')
      }
  const labelGroups = new Map<string, string[]>()
  for (const [id, label] of structuralLabels) labelGroups.set(label, [...(labelGroups.get(label) ?? []), id])
  for (const [label, ids] of labelGroups)
    if (ids.length > 1) ids.forEach((id, index) => structuralLabels.set(id, `${label} (${index + 1})`))
  let activeDefinitions: ApiEntry[] = []

  function project(node: ApiDeclaration, graph: SurfaceGraph, prefix = ''): ApiEntry {
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
    const name =
      structuralLabels.get(node.id) ??
      (node.name.startsWith('__')
        ? node.kind === 'CallSignature'
          ? 'Callback'
          : prefix
            ? `${prefix} object`
            : 'Object'
        : prefix && (node.kind === 'Property' || node.kind === 'Parameter')
          ? `${prefix}.${node.name}`
          : node.name)
    const childPrefix = node.name.startsWith('__') ? prefix : name
    const union = unions.get(node.id)
    const variantValue = variantValues.get(node.id)
    const objectParameter =
      graph.section === 'parameters' &&
      node.kind === 'Parameter' &&
      node.sourceTypeBody === true &&
      isObjectType(node.type, selections[graphs.indexOf(graph)].contract.declarations)
    const parameterDefinition = objectParameter
      ? {
          id: memberAnchor(`${node.id}:definition`),
          context: graph.groups.find(group => group.entries.includes(node.id))?.label ?? '',
        }
      : undefined
    return {
      id: memberAnchor(node.id),
      kind: node.kind,
      defaultType: node.defaultType?.display,
      name,
      label: node.name.startsWith('__') ? name : node.name,
      ...(inlineBodies.has(node.id) ? { inlineObject: true } : {}),
      ...(graph.section === 'properties' && prefix ? { path: name } : {}),
      ...(graph.section !== 'properties' ? { table: 'Property' } : {}),
      type: union ? undefined : (node.sourceType ?? node.type?.display),
      parameterDefinition,
      typeContent: parameterDefinition
        ? [{ kind: 'link', href: `#${parameterDefinition.id}`, children: [{ kind: 'text', value: 'object' }] }]
        : union
          ? undefined
          : node.sourceType && node.type
            ? typeContent({ ...node.type, display: node.sourceType }, destinations)
            : typeContent(
                node.type,
                destinations,
                graph.section !== 'properties',
                structuralLabels,
                selections[graphs.indexOf(graph)].contract.declarations,
              ),
      ...(union ? { variantKey: union.key } : {}),
      ...(variantValue ? { variantValue, name: variantValue, label: variantValue } : {}),
      variantDiscriminator: variantDiscriminators.get(node.id),
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
      nested: targets.map(id => item(id, graph, false, childPrefix)),
    }
  }

  function item(id: string, graph: SurfaceGraph, topLevel: boolean, prefix = ''): ApiItem {
    const node = graph.nodes.get(id)?.declaration
    if (!node) throw new Error(`Missing rendered declaration: ${id}`)
    if (definitions.has(id)) {
      if (!emitted.has(id)) activeDefinitions.push(project(node, graph, node.name.startsWith('__') ? prefix : ''))
      return { target: `#${memberAnchor(id)}`, name: structuralLabels.get(id) ?? node.name }
    }
    if (emitted.has(id) || (!topLevel && roots.has(id))) return { target: `#${memberAnchor(id)}`, name: node.name }
    return project(node, graph, prefix)
  }

  return graphs.map((graph, index) => {
    activeDefinitions = []
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
          entry.label = undefined
          entry.signature = node.sourceSignature
          entry.callSummary = `${node.name}(${node.parameters
            .map(id => {
              const parameter = contract.declarations[id]
              return `${parameter.flags.includes('isRest') ? '...' : ''}${parameter.name}${parameter.flags.includes('isOptional') ? '?' : ''}`
            })
            .join(', ')})`
          const source = ts.createSourceFile(
            'signature.ts',
            `interface Signature { ${node.sourceSignature} }`,
            ts.ScriptTarget.Latest,
            true,
          )
          const declaration = source.statements.find(ts.isInterfaceDeclaration)?.members.find(ts.isMethodSignature)
          for (const generic of entry.nested ?? []) {
            if ('target' in generic || generic.kind !== 'TypeParameter') continue
            const authored = declaration?.typeParameters?.find(parameter => parameter.name.text === generic.name)
            if (!authored) throw new Error(`Missing source type parameter: ${generic.name}`)
            generic.type = authored.constraint?.getText(source)
            generic.typeContent = generic.type ? [{ kind: 'text', value: generic.type }] : undefined
            generic.defaultType = authored.default?.getText(source)
          }
          entry.table = undefined
          entry.type = undefined
        }
        return entry
      })
    } else {
      entries = graph.groups.map(group => {
        return {
          id: memberAnchor(`${group.owner}:${graph.section}`),
          name: group.label,
          ...(graph.section === 'parameters' ? { table: 'Parameter' as const } : {}),
          returnValue: graph.section === 'returns',
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
      title: {
        properties: 'Properties',
        signatures: 'Signatures',
        parameters: 'Parameters',
        returns: 'Returns',
        method: 'Method',
      }[graph.section],
      entries,
      definitions: activeDefinitions.sort((a, b) => a.name.localeCompare(b.name, 'en')),
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
