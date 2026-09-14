import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { composeSurfaces } from './compose'
import type { ApiItem, ApiSurface } from './presentation'
import { memberAnchor } from './presentation'
import { parseContract } from './schema'
import { traverseSurface } from './traversal'
import type { ApiSection } from './traversal'

const load = (name: string) =>
  parseContract(JSON.parse(readFileSync(new URL(`../data/api-reference/${name}.json`, import.meta.url), 'utf8')))

function surfaceItems(surface: ApiSurface): ApiItem[] {
  return [...surface.entries, ...(surface.definitions ?? [])]
}

function renderedIds(items: ApiItem[]): string[] {
  return items.flatMap(item => ('target' in item ? [] : [item.id, ...renderedIds(item.nested ?? [])]))
}
function referenceTargets(items: ApiItem[]): string[] {
  return items.flatMap(item => ('target' in item ? [item.target] : referenceTargets(item.nested ?? [])))
}

describe('complete SSR projection', () => {
  it('emits every configuration declaration exactly once, including inline fields and linked type definitions', () => {
    const contract = load('configuration')
    const graph = traverseSurface(contract, 'properties')
    const [surface] = composeSurfaces([{ contract, section: 'properties' }])
    const ids = renderedIds(surfaceItems(surface))
    expect(ids.length).toBe(new Set(ids).size)
    expect(new Set(ids)).toEqual(new Set([...graph.nodes.keys()].map(memberAnchor)))
    for (const target of referenceTargets(surfaceItems(surface))) expect(ids).toContain(target.slice(1))
    const paths: string[] = []
    function inspectInline(items: ApiItem[]) {
      for (const item of items) {
        if ('target' in item) continue
        expect(item.table).toBeUndefined()
        if (item.path && item.label && item.name.endsWith(`.${item.label}`)) {
          expect(item.path).toBe(item.name)
          paths.push(item.path)
        }
        inspectInline(item.nested ?? [])
      }
    }
    inspectInline(surfaceItems(surface))
    expect(paths.length).toBeGreaterThan(10)
  })

  it('shares canonical definitions across overloads and sections without omitting returns', () => {
    const contract = load('agent-generate')
    const sections: ApiSection[] = ['signatures', 'parameters', 'returns']
    const surfaces = composeSurfaces(sections.map(section => ({ contract, section })))
    const ids = surfaces.flatMap(surface => renderedIds(surfaceItems(surface)))
    expect(ids.length).toBe(new Set(ids).size)
    const expected = new Set(
      sections.flatMap(section => [...traverseSurface(contract, section).nodes.keys()].map(memberAnchor)),
    )
    for (const id of expected) expect(ids).toContain(id)
    for (const surface of surfaces)
      for (const target of referenceTargets(surfaceItems(surface))) expect(ids).toContain(target.slice(1))
    const fullOutput = Object.values(contract.declarations).find(node => node.name === 'FullOutput')
    expect(fullOutput).toBeDefined()
    if (!fullOutput) throw new Error('Missing real FullOutput')
    const definitions = surfaces.flatMap(surface => surface.definitions ?? [])
    expect(definitions.find(entry => entry.id === memberAnchor(fullOutput.id))).toBeDefined()
    for (const child of fullOutput.children) expect(renderedIds(definitions)).toContain(memberAnchor(child))
  })

  it('groups each complete method under one overload while keeping shared definitions outside tabs', () => {
    const contract = load('agent-generate')
    const [surface] = composeSurfaces([{ contract, section: 'method' }])
    expect(surface.entries).toHaveLength(4)
    const ids = renderedIds(surfaceItems(surface))
    expect(ids.length).toBe(new Set(ids).size)
    for (const id of traverseSurface(contract, 'method').nodes.keys()) expect(ids).toContain(memberAnchor(id))
    for (const target of referenceTargets(surfaceItems(surface))) expect(ids).toContain(target.slice(1))
    for (const entry of surface.entries) {
      expect(entry.signature).toContain('generate')
      expect(
        entry.nested?.filter(item => 'target' in item || item.kind !== 'TypeParameter').map(item => item.name),
      ).toEqual(['Parameters', 'Returns'])
      const signature =
        contract.declarations[contract.declarations[contract.root].signatures[surface.entries.indexOf(entry)]]
      expect(
        entry.nested
          ?.filter(item => !('target' in item) && item.kind === 'TypeParameter')
          .map(item => !('target' in item) && item.id),
      ).toEqual(signature.typeParameters.map(memberAnchor))
      expect(entry.signature).toBe(signature.sourceSignature)
      const parameters = entry.nested?.find(item => item.name === 'Parameters')
      expect(parameters && !('target' in parameters) && parameters.table).toBe('Parameter')
      if (parameters && !('target' in parameters))
        for (const parameter of parameters.nested ?? []) {
          if ('target' in parameter) continue
          expect(parameter.nested?.every(item => 'target' in item)).toBe(true)
        }
    }
    expect(surface.definitions?.every(entry => entry.table === 'Property')).toBe(true)
    const options = surface.entries[0].nested?.find(item => item.name === 'Parameters')
    if (!options || 'target' in options) throw new Error('Missing parameters')
    const option = options.nested?.find(item => item.name === 'options')
    if (!option || 'target' in option) throw new Error('Missing options')
    expect(option.type).toContain('AgentExecutionOptionsBase<T>')
    const shapeLinks =
      option.nested?.filter(
        item =>
          'target' in item &&
          surface.definitions?.some(
            definition => `#${definition.id}` === item.target && definition.name.startsWith('Overload 1.options'),
          ),
      ) ?? []
    expect(shapeLinks).toHaveLength(3)
    const shapeNames = shapeLinks.map(link => link.name)
    expect(new Set(shapeNames).size).toBe(3)
    expect(shapeNames).toContain('Overload 1.options.structuredOutput')
    expect(shapeNames).toContain('Overload 1.options.model')
    const fullOutput = surface.definitions?.find(entry => entry.name === 'FullOutput')
    expect(fullOutput).toBeDefined()
    if (!fullOutput) throw new Error('Missing shared FullOutput definition')
    expect(surface.entries.every(entry => !renderedIds(entry.nested ?? []).includes(fullOutput.id))).toBe(true)
  })

  it('links return types inline while retaining canonical targets for method-page ownership', () => {
    const contract = load('agent-generate')
    const [surface] = composeSurfaces([{ contract, section: 'method' }])
    const fullOutput = surface.definitions?.find(entry => entry.name === 'FullOutput')
    if (!fullOutput) throw new Error('Missing FullOutput definition')
    for (const overload of surface.entries) {
      const returns = overload.nested?.find(item => !('target' in item) && item.returnValue)
      if (!returns || 'target' in returns) throw new Error('Missing returns entry')
      const links = returns.typeContent?.filter(node => node.kind === 'link').map(node => node.href) ?? []
      expect(links).toContain(`#${fullOutput.id}`)
      expect(returns.nested).toContainEqual({ target: `#${fullOutput.id}`, name: 'FullOutput' })
    }
  })

  it('rejects duplicate authored canonical surfaces', () => {
    const contract = load('configuration')
    expect(() =>
      composeSurfaces([
        { contract, section: 'properties' },
        { contract, section: 'properties' },
      ]),
    ).toThrow('Duplicate canonical API surface')
  })
})
