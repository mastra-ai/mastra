import { describe, expect, it } from 'vitest'
import type { ApiContract, ApiDeclaration } from '../../src/api-reference/model'
import { inventory } from './inventory'

function declaration(overrides: Partial<ApiDeclaration> & { id: string; name: string }): ApiDeclaration {
  return {
    kind: 'Property',
    flags: [],
    children: [],
    signatures: [],
    parameters: [],
    typeParameters: [],
    indexSignatures: [],
    ...overrides,
  }
}

function contract(root: string, declarations: ApiDeclaration[]): ApiContract {
  return {
    version: 1,
    root,
    declarations: Object.fromEntries(declarations.map(declaration => [declaration.id, declaration])),
    diagnostics: [],
  }
}

describe('API extraction inventory', () => {
  it('groups undocumented owners by source location and lists every occurrence', () => {
    const source = { path: 'packages/core/src/mastra/index.ts', line: 12, character: 2 }
    const report = inventory([
      contract('Config', [declaration({ id: 'Config.server', name: 'server', source })]),
      contract('Agent.generate', [declaration({ id: 'Agent.generate/1/server', name: 'server', source })]),
    ])
    expect(report.owners).toHaveLength(1)
    expect(report.owners[0]!.occurrences).toEqual(['Config: Config.server', 'Agent.generate: Agent.generate/1/server'])
  })

  it('keeps the same name at different source locations as separate owners', () => {
    const report = inventory([
      contract('Config', [
        declaration({ id: 'Config.a', name: 'duplicate', source: { path: 'a.ts', line: 1, character: 0 } }),
        declaration({ id: 'Config.b', name: 'duplicate', source: { path: 'b.ts', line: 1, character: 0 } }),
      ]),
    ])
    expect(report.owners.map(owner => owner.node.id)).toEqual(['Config.a', 'Config.b'])
  })

  it('skips anonymous, undocumented-adjacent and described declarations', () => {
    const report = inventory([
      contract('Config', [
        declaration({ id: 'Config.__type', name: '__type' }),
        declaration({ id: 'Config.kind', name: 'kind', kind: 'EnumMember' }),
        declaration({
          id: 'Config.described',
          name: 'described',
          comment: { summary: [{ kind: 'text', text: 'Documented.' }], tags: [], modifiers: [] },
        }),
        declaration({
          id: 'Config.blank',
          name: 'blank',
          comment: { summary: [{ kind: 'text', text: '   ' }], tags: [], modifiers: [] },
        }),
      ]),
    ])
    expect(report.owners.map(owner => owner.node.id)).toEqual(['Config.blank'])
  })

  it('collects type shapes and service-boundary references across nested operands', () => {
    const report = inventory([
      contract('Config', [
        declaration({
          id: 'Config.root',
          name: 'root',
          type: {
            kind: 'union',
            display: 'A | B',
            attributes: {},
            operands: [
              {
                role: 'member',
                type: {
                  kind: 'reference',
                  display: 'PubSub',
                  attributes: {},
                  operands: [],
                  target: { id: 'PubSub', name: 'PubSub', boundary: 'service', reason: 'runtime replacement' },
                },
              },
              {
                role: 'member',
                type: {
                  kind: 'reference',
                  display: 'Date',
                  attributes: {},
                  operands: [],
                  target: { id: 'Date', name: 'Date', boundary: 'external' },
                },
              },
            ],
          },
        }),
      ]),
    ])
    expect(report.shapes).toEqual(['reference', 'union'])
    expect(report.references).toEqual([
      { id: 'Date', name: 'Date', boundary: 'external' },
      { id: 'PubSub', name: 'PubSub', boundary: 'service', reason: 'runtime replacement' },
    ])
  })
})
