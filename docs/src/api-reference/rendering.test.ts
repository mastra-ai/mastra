import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { composeSurfaces } from './compose'
import type { ApiItem } from './presentation'
import { memberAnchor } from './presentation'
import { parseContract } from './schema'
import { traverseSurface } from './traversal'
import type { ApiSection } from './traversal'

const load = (name: string) =>
  parseContract(JSON.parse(readFileSync(new URL(`../data/api-reference/${name}.json`, import.meta.url), 'utf8')))

function renderedIds(items: ApiItem[]): string[] {
  return items.flatMap(item => ('target' in item ? [] : [item.id, ...renderedIds(item.nested ?? [])]))
}
function referenceTargets(items: ApiItem[]): string[] {
  return items.flatMap(item => ('target' in item ? [item.target] : referenceTargets(item.nested ?? [])))
}

describe('complete SSR projection', () => {
  it('emits every configuration declaration exactly once, including collapsed fields', () => {
    const contract = load('configuration')
    const graph = traverseSurface(contract, 'properties')
    const [surface] = composeSurfaces([{ contract, section: 'properties' }])
    const ids = renderedIds(surface.entries)
    expect(ids.length).toBe(new Set(ids).size)
    expect(new Set(ids)).toEqual(new Set([...graph.nodes.keys()].map(memberAnchor)))
    for (const target of referenceTargets(surface.entries)) expect(ids).toContain(target.slice(1))
  })

  it('shares canonical definitions across overloads and sections without omitting returns', () => {
    const contract = load('agent-generate')
    const sections: ApiSection[] = ['signatures', 'parameters', 'returns']
    const surfaces = composeSurfaces(sections.map(section => ({ contract, section })))
    const ids = surfaces.flatMap(surface => renderedIds(surface.entries))
    expect(ids.length).toBe(new Set(ids).size)
    const expected = new Set(
      sections.flatMap(section => [...traverseSurface(contract, section).nodes.keys()].map(memberAnchor)),
    )
    for (const id of expected) expect(ids).toContain(id)
    for (const surface of surfaces)
      for (const target of referenceTargets(surface.entries)) expect(ids).toContain(target.slice(1))
    const fullOutput = Object.values(contract.declarations).find(node => node.name === 'FullOutput')
    expect(fullOutput).toBeDefined()
    if (!fullOutput) throw new Error('Missing real FullOutput')
    expect(renderedIds(surfaces[2].entries)).toContain(memberAnchor(fullOutput.id))
    for (const child of fullOutput.children) expect(renderedIds(surfaces[2].entries)).toContain(memberAnchor(child))
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
