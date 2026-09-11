import { readFileSync } from 'node:fs'
import { parse } from 'valibot'
import { describe, expect, it } from 'vitest'
import { compileComment, safeCommentUrl } from './comments'
import { composeSurface } from './compose'
import { memberAnchor } from './presentation'
import { apiContractSchema } from './schema'
import { MODEL_TOKENS } from '../plugins/remark-model-tokens/models'

const load = (name: string) =>
  parse(
    apiContractSchema,
    JSON.parse(readFileSync(new URL(`../data/api-reference/${name}.json`, import.meta.url), 'utf8')),
  )

describe('source-backed visual surfaces', () => {
  it('projects the complete Config property list without authored member selection', () => {
    const contract = load('configuration')
    const surface = composeSurface(contract, 'properties')
    const properties = contract.declarations[contract.root].children.map(id => contract.declarations[id])
    expect(surface.entries.map(entry => entry.name)).toEqual(properties.map(property => property.name))
    expect(surface.entries).toHaveLength(36)
    expect(surface.entries.every(entry => entry.description.length > 0)).toBe(true)
    expect(surface.entries.find(entry => entry.name === 'harnesses')?.deprecated.length).toBeGreaterThan(0)
  })

  it('keeps all overloads and their generic constraints, optionality, and return relationships', () => {
    const contract = load('agent-generate')
    const surface = composeSurface(contract, 'signatures')
    expect(surface.entries).toHaveLength(4)
    expect(surface.entries[0].signature).toContain('OUTPUT extends StandardSchemaWithJSON')
    expect(surface.entries[0].signature).toContain(
      'T extends InferStandardSchemaOutput<OUTPUT> = InferStandardSchemaOutput<OUTPUT>',
    )
    expect(surface.entries[0].signature).toContain('Promise<FullOutput<T>>')
    expect(surface.entries[1].signature).toContain('OUTPUT extends {}>')
    expect(surface.entries[2].signature).toContain('options: AgentExecutionOptionsBase<unknown>')
    expect(surface.entries[2].signature).toContain('structuredOutput?: never')
    expect(surface.entries[3].signature).not.toContain('options')
    expect(surface.entries.every(entry => entry.description.length > 0)).toBe(true)
    expect(surface.entries.every(entry => entry.signature?.includes('Promise<FullOutput<'))).toBe(true)
  })

  it('renders fenced default values as inline metadata without changing examples', () => {
    const surface = composeSurface(load('configuration'), 'properties')
    expect(surface.entries.find(entry => entry.name === 'cache')?.defaults).toEqual([
      { kind: 'element', tag: 'code', children: [{ kind: 'text', value: 'InMemoryServerCache' }] },
    ])
    expect(
      surface.entries
        .flatMap(entry => entry.examples)
        .flat()
        .some(node => node.kind === 'code'),
    ).toBe(true)
  })

  it('uses verified source destinations keyed by relative path and line', () => {
    const contract = load('configuration')
    const node = contract.declarations[contract.declarations[contract.root].children[0]]
    const sourceLinks = new Map([
      [
        `${node.source?.path}:${node.source?.line}`,
        'https://github.com/mastra-ai/mastra/tree/main/packages/core/src/mastra/index.ts',
      ],
    ])
    const surface = composeSurface(contract, 'properties', { sourceLinks })
    expect(surface.entries[0].sourceUrl).toBe(
      'https://github.com/mastra-ai/mastra/tree/main/packages/core/src/mastra/index.ts',
    )
    expect(composeSurface(contract, 'properties').entries[0].sourceUrl).toBeUndefined()
  })

  it('rejects unsafe source destinations', () => {
    const contract = load('configuration')
    const node = contract.declarations[contract.declarations[contract.root].children[0]]
    const sourceLinks = new Map([[`${node.source?.path}:${node.source?.line}`, 'javascript:alert(1)']])
    expect(() => composeSurface(contract, 'properties', { sourceLinks })).toThrow('Unsafe or noncanonical')
  })

  it('uses injective anchors that do not depend on page placement', () => {
    expect(memberAnchor('a.b')).not.toBe(memberAnchor('a_2e_b'))
    expect(memberAnchor('@mastra/core!Config')).toBe(memberAnchor('@mastra/core!Config'))
  })
})

describe('safe source Markdown', () => {
  const compile = (text: string) => compileComment([{ kind: 'text', text }], new Map())

  it('keeps paragraphs, emphasis, inline code, lists, and fenced code as structured nodes', () => {
    expect(compile('A **strong** `value`.\n\n- First\n- Second\n\n```ts\nconst value = 1\n```')).toEqual([
      {
        kind: 'element',
        tag: 'p',
        children: [
          { kind: 'text', value: 'A ' },
          { kind: 'element', tag: 'strong', children: [{ kind: 'text', value: 'strong' }] },
          { kind: 'text', value: ' ' },
          { kind: 'element', tag: 'code', children: [{ kind: 'text', value: 'value' }] },
          { kind: 'text', value: '.' },
        ],
      },
      {
        kind: 'element',
        tag: 'ul',
        children: [
          {
            kind: 'element',
            tag: 'li',
            children: [{ kind: 'element', tag: 'p', children: [{ kind: 'text', value: 'First' }] }],
          },
          {
            kind: 'element',
            tag: 'li',
            children: [{ kind: 'element', tag: 'p', children: [{ kind: 'text', value: 'Second' }] }],
          },
        ],
      },
      { kind: 'code', language: 'ts', value: 'const value = 1' },
    ])
  })

  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,bad',
    '//outside.invalid',
    '/\\outside.invalid',
  ])('rejects unsafe URL %s', url => {
    expect(() => safeCommentUrl(url)).toThrow('Unsafe or noncanonical')
  })

  it('uses the existing model-token transform in paragraphs, inline code, and examples', () => {
    const content = compile(
      '\\_\\_GATEWAY\\_OPENAI\\_MODEL\\_\\_ and `__GATEWAY_OPENAI_MODEL__`.\n\n```ts\nconst model = "__GATEWAY_OPENAI_MODEL__"\n```',
    )
    const serialized = JSON.stringify(content)
    expect(serialized).not.toContain('__GATEWAY_OPENAI_MODEL__')
    expect(serialized.split(MODEL_TOKENS.__GATEWAY_OPENAI_MODEL__).length - 1).toBe(3)
  })

  it('rejects entity-encoded unsafe schemes after Markdown parsing', () => {
    expect(() => compile('[link](jav&#x61;script:alert)')).toThrow('Unsafe or noncanonical')
  })

  it.each(['<script>alert(1)</script>', '<img src=x onerror=alert(1)>', '<Component onClick={run} />'])(
    'rejects executable HTML/JSX: %s',
    markdown => {
      expect(() => compile(markdown)).toThrow('Unsupported API comment Markdown: html')
    },
  )

  it('maps known symbol links without inventing destinations for unknown targets', () => {
    expect(
      compileComment(
        [{ kind: 'inline-tag', text: 'Controller', target: 'Controller' }],
        new Map([['Controller', '/reference/controller']]),
      ),
    ).toEqual([
      {
        kind: 'element',
        tag: 'p',
        children: [{ kind: 'link', href: '/reference/controller', children: [{ kind: 'text', value: 'Controller' }] }],
      },
    ])
    expect(compileComment([{ kind: 'inline-tag', text: 'Unknown', target: 'Unknown' }], new Map())).toEqual([
      { kind: 'element', tag: 'p', children: [{ kind: 'text', value: 'Unknown' }] },
    ])
  })
})
