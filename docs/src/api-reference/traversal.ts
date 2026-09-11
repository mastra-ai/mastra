import type { ApiCommentPart, ApiContract, ApiDeclaration, ApiSource, ApiType } from './model'

export type ApiSection = 'properties' | 'signatures' | 'parameters' | 'returns'

export interface SurfaceEdge {
  role: string
  target: string
}

export interface SurfaceNode {
  declaration: ApiDeclaration
  path: string[]
  edges: SurfaceEdge[]
}

export interface SurfaceGroup {
  owner: string
  label: string
  type?: ApiType
  description?: ApiCommentPart[]
  source?: ApiSource
  entries: string[]
}

export interface SurfaceGraph {
  root: string
  section: ApiSection
  groups: SurfaceGroup[]
  nodes: Map<string, SurfaceNode>
}

export function traverseSurface(contract: ApiContract, section: ApiSection): SurfaceGraph {
  const root = contract.declarations[contract.root]
  if (!root) throw new Error(`Missing API root: ${contract.root}`)
  if (section === 'properties' ? root.kind !== 'Interface' : root.kind !== 'Method') {
    throw new Error(`Unsupported section ${section} for ${root.name}`)
  }
  const nodes = new Map<string, SurfaceNode>()

  function visitType(type: ApiType | undefined, path: string[], edges: SurfaceEdge[], role: string) {
    if (!type) return
    if (type.declaration) {
      edges.push({ role, target: type.declaration })
      visit(type.declaration, path)
    }
    if (type.target?.boundary === 'data') {
      edges.push({ role, target: type.target.id })
      visit(type.target.id, path)
    }
    for (const operand of type.operands) visitType(operand.type, path, edges, `${role}.${operand.role}`)
  }

  function visit(id: string, parentPath: string[]) {
    if (nodes.has(id)) return
    const declaration = contract.declarations[id]
    if (!declaration) throw new Error(`Missing owned declaration ${id} at ${parentPath.join('.')}`)
    const path = [...parentPath, declaration.name]
    const node: SurfaceNode = { declaration, path, edges: [] }
    nodes.set(id, node)
    if (section === 'signatures') return
    for (const role of ['children', 'signatures', 'parameters', 'typeParameters', 'indexSignatures'] as const) {
      for (const target of declaration[role]) {
        node.edges.push({ role, target })
        visit(target, path)
      }
    }
    visitType(declaration.type, path, node.edges, 'type')
    visitType(declaration.defaultType, path, node.edges, 'defaultType')
  }

  let groups: SurfaceGroup[]
  if (section === 'properties' || section === 'signatures') {
    const entries = section === 'properties' ? root.children : root.signatures
    for (const id of entries) visit(id, [root.name])
    groups = [{ owner: root.id, label: root.name, entries }]
  } else {
    groups = root.signatures.map((id, index) => {
      const signature = contract.declarations[id]
      if (!signature) throw new Error(`Missing signature: ${id}`)
      const path = [root.name, `Overload ${index + 1}`, section]
      let entries: string[]
      if (section === 'parameters') {
        entries = signature.parameters
        for (const parameter of entries) visit(parameter, path)
      } else {
        if (!signature.type) throw new Error(`Missing return type: ${id}`)
        const edges: SurfaceEdge[] = []
        visitType(signature.type, path, edges, 'return')
        entries = [...new Set(edges.map(edge => edge.target))]
      }
      return {
        owner: id,
        label: `Overload ${index + 1}`,
        entries,
        ...(section === 'returns'
          ? {
              type: signature.type,
              source: signature.source,
              description: (signature.comment?.tags ?? [])
                .filter(tag => tag.name === '@returns')
                .flatMap(tag => tag.content),
            }
          : {}),
      }
    })
  }
  return { root: root.id, section, groups, nodes }
}

export interface DescriptionGap {
  page: string
  owner: string
  path: string
  source?: ApiDeclaration['source']
}

const describedKinds = new Set([
  'Property',
  'Parameter',
  'Method',
  'Function',
  'Interface',
  'TypeAlias',
  'CallSignature',
  'Accessor',
  'Enum',
  'EnumMember',
])

export function requiresDescription(declaration: ApiDeclaration): boolean {
  return describedKinds.has(declaration.kind) && !declaration.name.startsWith('__')
}

export function descriptionGaps(graph: SurfaceGraph, page: string): DescriptionGap[] {
  const gaps: DescriptionGap[] = [...graph.nodes.values()]
    .filter(({ declaration }) => {
      if (!requiresDescription(declaration)) return false
      return !declaration.comment?.summary.some(part => part.text.trim().length > 0)
    })
    .map(({ declaration, path }) => ({ page, owner: declaration.id, path: path.join('.'), source: declaration.source }))
  if (graph.section === 'returns') {
    for (const group of graph.groups) {
      if (!group.description?.some(part => part.text.trim()))
        gaps.push({ page, owner: group.owner, path: `${graph.root}.${group.label}.returns`, source: group.source })
    }
  }
  return gaps
}

export function validateDescriptions(graph: SurfaceGraph, page: string) {
  const gaps = descriptionGaps(graph, page)
  if (gaps.length) {
    throw new Error(
      gaps
        .map(
          gap =>
            `${gap.page}: Missing description for ${gap.path} (${gap.source ? `${gap.source.path}:${gap.source.line}` : gap.owner})`,
        )
        .join('\n'),
    )
  }
}
