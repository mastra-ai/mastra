import { expect, it } from 'vitest'
import { partitionMethod } from './appendix'
import { composeSurface } from './compose'
import { discriminatedUnion } from './discriminated-union'
import { memberAnchor } from './presentation'
import type { ApiItem } from './presentation'
import { itemLinks, loadContract, navigationIds, renderedIds } from './test-support'

const contract = loadContract('agent-generate')
const chunk = Object.values(contract.declarations).find(node => node.name === 'AgentChunkType')!

it('represents all 46 AgentChunkType variants semantically with BaseChunkType shared once', () => {
  const union = discriminatedUnion(chunk.type, contract)!
  expect(union.key).toBe('type')
  expect(union.variants).toHaveLength(46)
  expect(new Set(union.variants.map(variant => variant.value)).size).toBe(46)
  expect(union.common.map(type => type.target?.name)).toEqual(['BaseChunkType'])
  const surface = composeSurface(contract, 'method')
  const definition = surface.definitions?.find(entry => entry.id === memberAnchor(chunk.id))!
  expect(definition.variantKey).toBe('type')
  expect(definition.typeContent).toBeUndefined()
  expect(definition.nested?.filter(item => !('target' in item) && item.variantValue)).toHaveLength(46)
  expect(
    surface.definitions?.filter(entry => union.variants.some(variant => memberAnchor(variant.id) === entry.id)),
  ).toHaveLength(0)
})

it('keeps exact discriminator owners, all other fields, and generic metadata for relocation', () => {
  const copy = structuredClone(contract)
  const union = discriminatedUnion(chunk.type, copy)!
  const first = union.variants[0]
  for (const id of [first.id, first.discriminator, ...chunk.typeParameters]) {
    copy.declarations[id].comment = {
      modifiers: [],
      summary: [{ kind: 'text', text: `Description for ${id}` }],
      tags: [
        { name: '@deprecated', content: [{ kind: 'text', text: `Deprecated ${id}` }] },
        { name: '@example', content: [{ kind: 'text', text: `Example ${id}` }] },
      ],
    }
  }
  const surface = composeSurface(copy, 'method')
  const definition = surface.definitions?.find(entry => entry.id === memberAnchor(chunk.id))!
  for (const variant of union.variants) {
    const entry = definition.nested?.find(item => !('target' in item) && item.id === memberAnchor(variant.id))
    if (!entry || 'target' in entry) throw new Error('Missing variant owner')
    expect(entry.variantDiscriminator).toBe(memberAnchor(variant.discriminator))
    expect(copy.declarations[variant.discriminator].type?.display).toBe(variant.value)
    for (const child of copy.declarations[variant.id].children) {
      expect(renderedIds(entry.nested ?? [])).toContain(memberAnchor(child))
    }
  }
  for (const id of [first.id, first.discriminator, ...chunk.typeParameters]) {
    expect(JSON.stringify(definition)).toContain(`Description for ${id}`)
    expect(JSON.stringify(definition)).toContain(`Deprecated ${id}`)
    expect(JSON.stringify(definition)).toContain(`Example ${id}`)
  }
  for (const id of chunk.typeParameters) {
    const entry = definition.nested?.find(item => !('target' in item) && item.id === memberAnchor(id))
    if (!entry || 'target' in entry) throw new Error('Missing generic owner')
    expect(entry.kind).toBe('TypeParameter')
    expect(entry.type).toBe(copy.declarations[id].type?.display)
    expect(entry.defaultType).toBe(copy.declarations[id].defaultType?.display)
  }
})

it('falls back to the complete structural representation for ambiguous or optional variantKeys', () => {
  const copy = structuredClone(contract)
  const union = discriminatedUnion(chunk.type, copy)!
  const first = copy.declarations[union.variants[0].id]
  const variantKey = first.children.map(id => copy.declarations[id]).find(node => node.name === union.key)!
  variantKey.flags.push('isOptional')
  expect(discriminatedUnion(chunk.type, copy)).toBeUndefined()
  const ordinary = composeSurface(copy, 'method').definitions?.find(entry => entry.id === memberAnchor(chunk.id))!
  expect(ordinary.variantKey).toBeUndefined()
  expect(ordinary.typeContent?.length).toBeGreaterThan(0)
})

it('preserves every canonical entry exactly once across the method and generated appendix, with valid cross-page links', () => {
  const original = composeSurface(contract, 'method')
  const serialized = JSON.stringify(original)
  const partition = partitionMethod(original, '/reference/agents/generate')
  const methodItems = [...partition.method.entries, ...(partition.method.definitions ?? [])]
  const main = renderedIds(methodItems)
  const appendix = renderedIds(partition.appendix.entries)
  const all = [...main, ...appendix]
  expect(new Set(all).size).toBe(all.length)
  const anchors = navigationIds(methodItems)
  expect(anchors).toHaveLength(3)
  expect(new Set(anchors).size).toBe(anchors.length)
  expect(anchors.some(anchor => all.includes(anchor))).toBe(false)
  expect([...all].sort()).toEqual(renderedIds([...original.entries, ...(original.definitions ?? [])]).sort())
  expect(partition.method.entries).toHaveLength(4)
  expect(partition.method.definitions?.map(entry => entry.name)).toContain('FullOutput')
  expect(main.length).toBeLessThan(all.length / 4)
  expect(partition.appendix.entries.find(entry => entry.id === memberAnchor(chunk.id))?.variantKey).toBe('type')
  for (const [items, local, other, remotePath] of [
    [methodItems, [...main, ...navigationIds(methodItems)], appendix, partition.appendixPath],
    [partition.appendix.entries, appendix, [...main, ...navigationIds(methodItems)], partition.methodPath],
  ] satisfies [ApiItem[], string[], string[], string][]) {
    for (const href of itemLinks(items)) {
      if (href.startsWith('#api-')) expect(local).toContain(href.slice(1))
      if (href.startsWith(`${remotePath}#api-`)) expect(other).toContain(href.split('#')[1])
    }
  }
  expect(itemLinks(methodItems).some(href => href.startsWith(`${partition.appendixPath}#api-`))).toBe(true)
  expect(JSON.stringify(original)).toBe(serialized)
})

it('preserves source-written parameter aliases without replacing the complete resolved graph', () => {
  const surface = composeSurface(contract, 'method')
  const options = surface.entries[0].nested
    ?.flatMap(item => ('target' in item ? [] : (item.nested ?? [])))
    .find(item => !('target' in item) && item.name === 'options')
  expect(options && !('target' in options) && options.type).toContain('AgentExecutionOptionsBase')
  expect(options && !('target' in options) && options.type).toContain('PublicStructuredOutputOptions<T>')
  expect(options && !('target' in options) && options.nested?.length).toBeGreaterThan(0)
})
