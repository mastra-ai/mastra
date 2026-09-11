import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { afterAll, describe, expect, it } from 'vitest'
import { artifactDirectory, repositoryRoot } from '../../scripts/api-reference/config'
import remarkApiReference, { discoverSurfaces } from '../plugins/remark-api-reference'
import type { ApiContract } from './model'

const directory = mkdtempSync(join(tmpdir(), 'api-reference-discovery-'))
afterAll(() => rmSync(directory, { recursive: true, force: true }))
const parser = () => unified().use(remarkParse).use(remarkMdx)
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()

function writeFixture() {
  const contract: ApiContract = {
    version: 1,
    root: '@mastra/core!Config',
    diagnostics: [],
    declarations: {
      '@mastra/core!Config': {
        id: '@mastra/core!Config',
        name: 'Config',
        kind: 'Interface',
        flags: [],
        children: ['field'],
        signatures: [],
        parameters: [],
        typeParameters: [],
        indexSignatures: [],
      },
      field: {
        id: 'field',
        name: 'field',
        kind: 'Property',
        flags: [],
        children: [],
        signatures: [],
        parameters: [],
        typeParameters: [],
        indexSignatures: [],
        comment: { summary: [{ kind: 'text', text: 'A documented property.' }], tags: [], modifiers: [] },
      },
    },
  }
  writeFileSync(join(directory, 'configuration.json'), JSON.stringify(contract))
  return contract
}

describe('static API block discovery', () => {
  it('recognizes literal complete-surface selectors', () => {
    const tree = parser().parse('<ApiReference root="Agent.generate" section="returns" />')
    expect(discoverSurfaces(tree).map(({ root, section }) => [root.id, section])).toEqual([
      ['@mastra/core/agent!Agent.generate', 'returns'],
    ])
  })

  it.each([
    '<ApiReference root={"Config"} section="properties" />',
    '<ApiReference {...props} />',
    '<ApiReference root="Config" section="properties" data={override} />',
    '<ApiReference root="Config" section="properties" members="agents" />',
    '<ApiReference root="Config" root="Config" section="properties" />',
    '<ApiReference root="Config" />',
    '<ApiReference root="Config" section="unknown" />',
    '<ApiReference root="Unknown" section="properties" />',
    '<ApiReference root="Config" section="properties">Authored override</ApiReference>',
    'Inline <ApiReference root="Config" section="properties" /> text.',
  ])('rejects invalid author syntax: %s', source => {
    expect(() => discoverSurfaces(parser().parse(source))).toThrow()
  })

  it('injects trusted imports, data expressions, and headings while preserving prose', async () => {
    writeFixture()
    const processor = parser().use(remarkApiReference, {
      inputDirectory: directory,
      outputDirectory: join(directory, 'output'),
      cwd: repositoryRoot,
      revision,
      production: true,
    })
    const tree = processor.parse('Before.\n\n<ApiReference root="Config" section="properties" />\n\nAfter.')
    await processor.run(tree)
    expect(tree.children.map(node => node.type)).toEqual([
      'mdxjsEsm',
      'paragraph',
      'heading',
      'mdxJsxFlowElement',
      'paragraph',
    ])
    const output = readdirSync(join(directory, 'output'))
    expect(output).toHaveLength(1)
    const payload = JSON.parse(readFileSync(join(directory, 'output', output[0]), 'utf8'))
    expect(payload.entries[0].description[0].children[0].value).toBe('A documented property.')
    expect(payload.externalHeading).toBe(true)
    expect(JSON.stringify(tree)).toContain('data')
    expect(JSON.stringify(payload)).not.toContain('Agent.generate')
  })

  it('does not rewrite unchanged projections and retrigger the development watcher', async () => {
    writeFixture()
    const outputDirectory = join(directory, 'stable-output')
    const processor = parser().use(remarkApiReference, {
      inputDirectory: directory,
      outputDirectory,
      cwd: repositoryRoot,
      revision,
      production: true,
    })
    const source = '<ApiReference root="Config" section="properties" />'
    await processor.run(processor.parse(source))
    const output = join(outputDirectory, readdirSync(outputDirectory)[0])
    utimesSync(output, 1000, 1000)
    await processor.run(processor.parse(source))
    expect(statSync(output).mtimeMs).toBe(1000000)
  })

  it('validates consumed artifacts and included descriptions before emitting output', async () => {
    const contract = writeFixture()
    contract.declarations.field.comment = undefined
    writeFileSync(join(directory, 'configuration.json'), JSON.stringify(contract))
    const processor = parser().use(remarkApiReference, {
      inputDirectory: directory,
      outputDirectory: join(directory, 'invalid-output'),
      revision,
      production: true,
    })
    await expect(processor.run(processor.parse('<ApiReference root="Config" section="properties" />'))).rejects.toThrow(
      'Missing description for Config.field',
    )
    expect(readdirSync(directory)).not.toContain('invalid-output')
    writeFileSync(join(directory, 'configuration.json'), JSON.stringify({ ...contract, version: 2 }))
    await expect(
      processor.run(processor.parse('<ApiReference root="Config" section="properties" />')),
    ).rejects.toThrow()
  })

  it('fails publication on broken included comment links but exempts unused diagnostics', async () => {
    const contract = writeFixture()
    contract.diagnostics.push({ code: 'unresolved-link', owner: 'unused', message: 'Unused bad link' })
    const processor = parser().use(remarkApiReference, {
      inputDirectory: directory,
      outputDirectory: join(directory, 'links-output'),
      revision,
      production: true,
    })
    writeFileSync(join(directory, 'configuration.json'), JSON.stringify(contract))
    await expect(
      processor.run(processor.parse('<ApiReference root="Config" section="properties" />')),
    ).resolves.toBeDefined()
    contract.declarations.field.comment = {
      summary: [{ kind: 'inline-tag', tag: '@link', text: 'Missing', target: 'Missing' }],
      tags: [],
      modifiers: [],
    }
    writeFileSync(join(directory, 'configuration.json'), JSON.stringify(contract))
    await expect(processor.run(processor.parse('<ApiReference root="Config" section="properties" />'))).rejects.toThrow(
      'unresolved authored API link Missing',
    )
  })

  it('does not load or validate unused artifacts on handwritten pages', async () => {
    const processor = parser().use(remarkApiReference, {
      inputDirectory: join(directory, 'nonexistent'),
      production: true,
    })
    await expect(processor.run(processor.parse('A handwritten page.'))).resolves.toBeDefined()
  })

  it('accepts the real documented signatures without validating unconsumed parameter data', async () => {
    const processor = parser().use(remarkApiReference, {
      inputDirectory: artifactDirectory,
      outputDirectory: join(directory, 'real-output'),
      cwd: repositoryRoot,
      revision,
      production: true,
    })
    await expect(
      processor.run(processor.parse('<ApiReference root="Agent.generate" section="signatures" />')),
    ).resolves.toBeDefined()
    expect(readdirSync(join(directory, 'real-output'))).toHaveLength(1)
  })
})
