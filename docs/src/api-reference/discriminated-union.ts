import type { ApiContract, ApiType } from './model'

export interface DiscriminatedUnion {
  key: string
  common: ApiType[]
  variants: { id: string; value: string; discriminator: string }[]
}

/** Recognize only lossless object unions with the same shared intersection members. */
export function discriminatedUnion(type: ApiType | undefined, contract: ApiContract): DiscriminatedUnion | undefined {
  if (type?.kind !== 'union' || type.operands.length < 2) return
  const branches = type.operands.map(({ type }) => {
    const members = type.kind === 'intersection' ? type.operands.map(operand => operand.type) : [type]
    const bodies = members.filter(member => member.kind === 'reflection' && member.declaration)
    if (bodies.length !== 1) return
    const body = bodies[0].declaration
    if (!body) return
    const node = contract.declarations[body]
    if (!node || node.signatures.length || node.indexSignatures.length) return
    const common = members.filter(member => member !== bodies[0])
    if (common.some(member => member.kind !== 'reference')) return
    const literals = node.children.flatMap(id => {
      const child = contract.declarations[id]
      if (child?.kind !== 'Property' || child.flags.includes('isOptional') || child.type?.kind !== 'literal') return []
      return [{ id: child.id, name: child.name, value: child.type.display }]
    })
    return { id: body, common, literals }
  })
  if (branches.some(branch => !branch)) return
  const complete = branches.filter(branch => branch !== undefined)
  const first = complete[0]
  if (!first || complete.some(branch => JSON.stringify(branch.common) !== JSON.stringify(first.common))) return
  const priority = (name: string) => (name === 'type' ? 0 : name === 'kind' ? 1 : 2)
  for (const candidate of [...first.literals].sort((a, b) => priority(a.name) - priority(b.name))) {
    const values = complete.map(branch => branch.literals.find(literal => literal.name === candidate.name)?.value)
    if (values.some(value => value === undefined) || new Set(values).size !== complete.length) continue
    return {
      key: candidate.name,
      common: first.common,
      variants: complete.map((branch, index) => ({
        id: branch.id,
        value: values[index]!,
        discriminator: branch.literals.find(literal => literal.name === candidate.name)!.id,
      })),
    }
  }
}
