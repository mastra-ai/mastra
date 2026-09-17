import { describe, expect, it } from 'vitest'
import type { ApiContract, ApiDeclaration, ApiType } from './model'
import { loadContract as load } from './test-support'
import { descriptionGaps, traverseSurface, validateDescriptions } from './traversal'

function declaration(id: string, values: Partial<ApiDeclaration> = {}): ApiDeclaration {
  return {
    id,
    name: id,
    kind: 'Property',
    flags: [],
    children: [],
    signatures: [],
    parameters: [],
    typeParameters: [],
    indexSignatures: [],
    comment: { summary: [{ kind: 'text', text: `Description for ${id}` }], tags: [], modifiers: [] },
    ...values,
  }
}
function reference(id: string, boundary: 'data' | 'service' | 'external' = 'data'): ApiType {
  return { kind: 'reference', display: id, attributes: {}, operands: [], target: { id, name: id, boundary } }
}
function fixture(): ApiContract {
  return {
    version: 1,
    root: 'Config',
    diagnostics: [],
    declarations: {
      Config: declaration('Config', { kind: 'Interface', children: ['option', 'service'] }),
      option: declaration('option', {
        type: {
          kind: 'union',
          display: 'Payload | undefined',
          attributes: {},
          operands: [
            { role: '0', type: reference('Payload') },
            { role: '1', type: { kind: 'intrinsic', display: 'undefined', operands: [], attributes: {} } },
          ],
        },
      }),
      Payload: declaration('Payload', { kind: 'Interface', children: ['nested', 'callback', 'recursive'] }),
      nested: declaration('nested', {
        comment: undefined,
        source: { path: 'packages/core/src/data.ts', line: 42, character: 0 },
      }),
      callback: declaration('callback', { signatures: ['signature'] }),
      signature: declaration('signature', { name: '__type', kind: 'CallSignature', parameters: ['arg'] }),
      arg: declaration('arg', { kind: 'Parameter', type: reference('Result') }),
      Result: declaration('Result', { kind: 'Interface', children: ['value'] }),
      value: declaration('value'),
      recursive: declaration('recursive', { type: reference('Payload') }),
      service: declaration('service', { type: reference('Service', 'service') }),
      Service: declaration('Service', { kind: 'Interface', comment: undefined, children: ['unused'] }),
      unused: declaration('unused', { comment: undefined }),
    },
  }
}

function independentlyReachable(contract: ApiContract, seeds: unknown[]): Set<string> {
  const found = new Set<string>()
  const queue = [...seeds]
  const childRoles = new Set(['children', 'signatures', 'parameters', 'typeParameters', 'indexSignatures'])
  function enqueue(id: string) {
    if (found.has(id)) return
    found.add(id)
    const node = contract.declarations[id]
    expect(node, `owned declaration ${id}`).toBeDefined()
    queue.push(node)
  }
  while (queue.length) {
    const value = queue.shift()
    if (!value || typeof value !== 'object') continue
    for (const [key, child] of Object.entries(value)) {
      if (childRoles.has(key) && Array.isArray(child)) for (const id of child) enqueue(id)
      else if (key === 'declaration' && typeof child === 'string') enqueue(child)
      else if (key === 'target' && child?.boundary === 'data') enqueue(child.id)
      else if (Array.isArray(child)) queue.push(...child)
      else if (child && typeof child === 'object') queue.push(child)
    }
  }
  return found
}

describe('complete page-scoped traversal', () => {
  it('includes unions, callback parameters, and recursive data exactly once', () => {
    const contract = fixture()
    const graph = traverseSurface(contract, 'properties')
    expect([...graph.nodes.keys()]).toEqual([
      'option',
      'Payload',
      'nested',
      'callback',
      'signature',
      'arg',
      'Result',
      'value',
      'recursive',
      'service',
    ])
    expect(graph.nodes.get('recursive')?.edges).toContainEqual({ role: 'type', target: 'Payload' })
    expect(graph.nodes.has('Service')).toBe(false)
    expect(graph.nodes.has('unused')).toBe(false)
  })

  it('blocks undocumented nested union members and reports page, path, and source', () => {
    const graph = traverseSurface(fixture(), 'properties')
    expect(descriptionGaps(graph, '/reference/test')).toHaveLength(1)
    expect(() => validateDescriptions(graph, '/reference/test')).toThrow(
      '/reference/test: Missing description for Config.option.Payload.nested (packages/core/src/data.ts:42)',
    )
  })

  it('does not validate unused records or linked service descriptions', () => {
    const contract = fixture()
    contract.declarations.nested = declaration('nested')
    expect(() => validateDescriptions(traverseSurface(contract, 'properties'), '/reference/test')).not.toThrow()
  })

  it('includes newly generated fields without a member selection change', () => {
    const contract = fixture()
    contract.declarations.Payload.children.push('added')
    contract.declarations.added = declaration('added', { comment: undefined })
    expect(descriptionGaps(traverseSurface(contract, 'properties'), '/reference/test').map(gap => gap.owner)).toContain(
      'added',
    )
  })

  it('fails closed for missing owned declarations and incompatible sections', () => {
    const contract = fixture()
    delete contract.declarations.Payload
    expect(() => traverseSurface(contract, 'properties')).toThrow('Missing owned declaration Payload')
    expect(() => traverseSurface(contract, 'returns')).toThrow('Unsupported section returns')
  })

  it('matches an independent closure walk of the real configuration graph', () => {
    const contract = load('configuration')
    const children = contract.declarations[contract.root].children
    const expected = independentlyReachable(contract, [{ children }])
    expect(new Set(traverseSurface(contract, 'properties').nodes.keys())).toEqual(expected)
  })

  it('validates each selected overload return description, including primitive return surfaces', () => {
    const contract = load('agent-generate')
    const id = contract.declarations[contract.root].signatures[0]
    const signature = contract.declarations[id]
    if (!signature.comment) throw new Error('Missing real signature comment')
    signature.comment.tags = signature.comment.tags.filter(tag => tag.name !== '@returns')
    signature.type = { kind: 'intrinsic', display: 'string', operands: [], attributes: {} }
    expect(
      descriptionGaps(traverseSurface(contract, 'returns'), '/reference/generate').map(gap => gap.owner),
    ).toContain(id)
    expect(descriptionGaps(traverseSurface(contract, 'signatures'), '/reference/generate')).toEqual([])
  })

  it('preserves all overload parameter and return closures independently', () => {
    const contract = load('agent-generate')
    const signatures = contract.declarations[contract.root].signatures.map(id => contract.declarations[id])
    const parameters = traverseSurface(contract, 'parameters')
    const returns = traverseSurface(contract, 'returns')
    expect(parameters.groups.map(group => group.entries.length)).toEqual([2, 2, 2, 1])
    expect(returns.groups).toHaveLength(4)
    expect(new Set(parameters.nodes.keys())).toEqual(
      independentlyReachable(
        contract,
        signatures.map(node => ({ parameters: node.parameters })),
      ),
    )
    expect(new Set(returns.nodes.keys())).toEqual(
      independentlyReachable(
        contract,
        signatures.map(node => node.type),
      ),
    )
    expect(
      [...returns.nodes.values()].find(node => node.declaration.name === 'FullOutput')?.declaration.children,
    ).toHaveLength(26)
    const signatureGraph = traverseSurface(contract, 'signatures')
    expect(new Set(signatureGraph.nodes.keys())).toEqual(
      new Set(signatures.flatMap(signature => [signature.id, ...signature.typeParameters])),
    )
    expect(descriptionGaps(signatureGraph, '/reference/generate')).toEqual([])
  })
})
