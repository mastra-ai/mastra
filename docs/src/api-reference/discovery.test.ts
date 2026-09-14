import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { afterAll, describe, expect, it } from 'vitest'
import { artifactDirectory, repositoryRoot } from '../../scripts/api-reference/config'
import { validatePages } from '../../scripts/api-reference/validate'
import remarkApiReference, { discoverSurfaces } from '../plugins/remark-api-reference'
import type { ApiContract } from './model'
import { parseContract } from './schema'

const directory = mkdtempSync(join(tmpdir(), 'api-reference-discovery-'))
afterAll(() => rmSync(directory, { recursive: true, force: true }))
const parser = () => unified().use(remarkParse).use(remarkMdx)
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()

function pinSource(name: string, contracts: ApiContract[]) {
  const cwd = join(directory, name)
  const sources = new Set<string>()
  for (const contract of contracts) {
    JSON.stringify(contract, (key, value) => {
      if ((key === 'source' || key === 'targetSource') && typeof value?.path === 'string') sources.add(value.path)
      return value
    })
  }
  for (const source of sources) {
    const target = join(cwd, source)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(join(repositoryRoot, source), target)
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
  git('init', '--quiet')
  const origin = execFileSync('git', ['remote', 'get-url', 'origin'], { cwd: repositoryRoot, encoding: 'utf8' }).trim()
  git('remote', 'add', 'origin', origin)
  git('add', '.')
  git(
    '-c',
    'user.name=API test',
    '-c',
    'user.email=api-test@example.invalid',
    '-c',
    'commit.gpgsign=false',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    'Pin source bytes for publication validation\n\nCo-Authored-By: mastra-platform[bot] <284800079+mastra-platform[bot]@users.noreply.github.com>',
  )
  return { cwd, revision: git('rev-parse', 'HEAD') }
}

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
  it('validates the migrated pages without extraction and rejects MDX-only or description regressions', async () => {
    const files = ['configuration.json', 'agent-generate.json']
    const contracts = files.map(file => parseContract(JSON.parse(readFileSync(join(artifactDirectory, file), 'utf8'))))
    const snapshot = pinSource('complete-page-validator', contracts)
    const data = join(snapshot.cwd, 'docs/src/data/api-reference')
    const content = join(snapshot.cwd, 'docs/src/content/en/reference')
    mkdirSync(data, { recursive: true })
    mkdirSync(join(content, 'agents'), { recursive: true })
    for (const file of files) copyFileSync(join(artifactDirectory, file), join(data, file))
    for (const file of ['configuration.mdx', 'agents/generate.mdx'])
      copyFileSync(join(repositoryRoot, 'docs/src/content/en/reference', file), join(content, file))
    const before = files.map(file => readFileSync(join(data, file), 'utf8'))
    const pages = await validatePages(snapshot.cwd, snapshot.revision)
    expect(pages).toHaveLength(2)
    const entry = pathToFileURL(join(repositoryRoot, 'docs/scripts/api-reference/validate.ts')).href
    execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '--eval',
        `import { validatePages } from ${JSON.stringify(entry)}; await validatePages(${JSON.stringify(snapshot.cwd)}, ${JSON.stringify(snapshot.revision)});`,
      ],
      { cwd: join(repositoryRoot, 'docs'), maxBuffer: 4 * 1024 * 1024, stdio: 'pipe' },
    )
    expect(files.map(file => readFileSync(join(data, file), 'utf8'))).toEqual(before)

    const methodPath = join(content, 'agents/generate.mdx')
    const method = readFileSync(methodPath, 'utf8')
    writeFileSync(methodPath, method.replace('section="method"', 'section="signatures"'))
    await expect(validatePages(snapshot.cwd, snapshot.revision)).rejects.toThrow('complete source-backed method')
    expect(files.map(file => readFileSync(join(data, file), 'utf8'))).toEqual(before)
    writeFileSync(methodPath, method.replace('<ApiReference root="Agent.generate" section="method" />', ''))
    await expect(validatePages(snapshot.cwd, snapshot.revision)).rejects.toThrow('complete source-backed method')
    writeFileSync(methodPath, method)

    const config = contracts[0]!
    const child = config.declarations[config.root]!.children[0]!
    delete config.declarations[child]!.comment
    writeFileSync(join(data, files[0]!), JSON.stringify(config))
    await expect(validatePages(snapshot.cwd, snapshot.revision)).rejects.toThrow(/description/i)
  })

  it('requires a registered appendix route before compiling a documented method in production', async () => {
    const template = writeFixture().declarations.field
    const root = '@mastra/core/agent!Agent.generate'
    const contract: ApiContract = {
      version: 1,
      root,
      diagnostics: [],
      declarations: {
        [root]: { ...template, id: root, name: 'generate', kind: 'Method', signatures: ['signature'] },
        signature: {
          ...template,
          id: 'signature',
          name: 'generate',
          kind: 'CallSignature',
          sourceSignature: 'generate(): void',
          type: { kind: 'intrinsic', display: 'void', operands: [], attributes: {} },
          comment: {
            summary: [{ kind: 'text', text: 'Generates a response.' }],
            modifiers: [],
            tags: [{ name: '@returns', content: [{ kind: 'text', text: 'No result.' }] }],
          },
        },
      },
    }
    writeFileSync(join(directory, 'agent-generate.json'), JSON.stringify(contract))
    const routeRegistry = join(directory, 'method-routes.json')
    const outputDirectory = join(directory, 'method-output')
    const path = join(directory, 'method.mdx')
    const processor = parser().use(remarkApiReference, {
      inputDirectory: directory,
      outputDirectory,
      routeRegistry,
      cwd: repositoryRoot,
      revision,
      production: true,
    })
    const source = '<ApiReference root="Agent.generate" section="method" />'
    await expect(processor.run(processor.parse(source), { path })).rejects.toThrow(
      'method appendix route was not registered',
    )
    writeFileSync(routeRegistry, JSON.stringify({ [path]: '/reference/fixture' }))
    await processor.run(processor.parse(source), { path })
    const payload = JSON.parse(readFileSync(join(outputDirectory, readdirSync(outputDirectory)[0]), 'utf8'))
    expect(payload.appendix).toEqual({ href: '/reference/fixture/types', title: 'Supporting types' })
    expect(payload.entries).toHaveLength(1)
  })

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

  it.each([
    ['Config', 'properties'],
    ['Agent.generate', 'method'],
  ])('publishes the complete real %s %s surface but rejects a removed source description', async (root, section) => {
    const filename = root === 'Config' ? 'configuration.json' : 'agent-generate.json'
    const contract = parseContract(JSON.parse(readFileSync(join(artifactDirectory, filename), 'utf8')))
    const source = pinSource(`source-${section}`, [contract])
    const path = join(directory, `${section}.mdx`)
    const routeRegistry = join(directory, `${section}-routes.json`)
    writeFileSync(routeRegistry, JSON.stringify({ [path]: `/reference/${section}` }))
    const inputDirectory = join(directory, `input-${section}`)
    mkdirSync(inputDirectory)
    writeFileSync(join(inputDirectory, filename), JSON.stringify(contract))
    const options = { ...source, inputDirectory, routeRegistry, production: true }
    const page = root === 'Config' ? 'configuration.mdx' : 'agents/generate.mdx'
    const markup = readFileSync(join(repositoryRoot, 'docs/src/content/en/reference', page), 'utf8')
    expect(discoverSurfaces(parser().parse(markup))).toHaveLength(1)
    const outputDirectory = join(directory, `real-complete-${section}`)
    const complete = parser().use(remarkApiReference, { ...options, outputDirectory })
    await expect(complete.run(complete.parse(markup), { path })).resolves.toBeDefined()
    expect(readdirSync(outputDirectory)).toHaveLength(1)
    const payload = readFileSync(join(outputDirectory, readdirSync(outputDirectory)[0]), 'utf8')
    expect(payload).not.toContain('Missing description')

    const declaration = contract.declarations[contract.root]!
    const owner = section === 'method' ? declaration.signatures[0]! : declaration.children[0]!
    contract.declarations[owner]!.comment = undefined
    writeFileSync(join(inputDirectory, filename), JSON.stringify(contract))
    const rejected = parser().use(remarkApiReference, {
      ...options,
      outputDirectory: join(directory, `real-rejected-${section}`),
    })
    await expect(rejected.run(rejected.parse(markup), { path })).rejects.toThrow('Missing description')
    expect(readdirSync(directory)).not.toContain(`real-rejected-${section}`)
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

  it('links out-of-surface comment targets to verified source without including their declarations', async () => {
    const contract = writeFixture()
    contract.declarations.field.comment = {
      summary: [
        {
          kind: 'inline-tag',
          tag: '@link',
          text: 'Mastra.getAgentController',
          target: 'owned-method',
          targetSource: { path: 'packages/core/src/mastra/index.ts', line: 1, character: 0 },
        },
      ],
      tags: [],
      modifiers: [],
    }
    writeFileSync(join(directory, 'configuration.json'), JSON.stringify(contract))
    const outputDirectory = join(directory, 'source-comment-output')
    const source = pinSource('comment-source', [contract])
    const processor = parser().use(remarkApiReference, {
      inputDirectory: directory,
      outputDirectory,
      ...source,
      production: true,
    })
    await processor.run(processor.parse('<ApiReference root="Config" section="properties" />'))
    const payload = readFileSync(join(outputDirectory, readdirSync(outputDirectory)[0]), 'utf8')
    expect(payload).toContain(`/blob/${source.revision}/packages/core/src/mastra/index.ts#L1`)
    expect(payload).not.toContain('Missing description')
    expect(contract.declarations['owned-method']).toBeUndefined()
  })

  it('rejects unverifiable source metadata on an out-of-surface comment link', async () => {
    const contract = writeFixture()
    contract.declarations.field.comment = {
      summary: [
        {
          kind: 'inline-tag',
          tag: '@link',
          text: 'Missing source',
          target: 'owned-method',
          targetSource: { path: 'missing-source.ts', line: 1, character: 0 },
        },
      ],
      tags: [],
      modifiers: [],
    }
    writeFileSync(join(directory, 'configuration.json'), JSON.stringify(contract))
    const processor = parser().use(remarkApiReference, {
      inputDirectory: directory,
      outputDirectory: join(directory, 'bad-source-output'),
      cwd: repositoryRoot,
      revision,
      production: true,
    })
    await expect(processor.run(processor.parse('<ApiReference root="Config" section="properties" />'))).rejects.toThrow(
      'API reference source verification failed',
    )
    expect(readdirSync(directory)).not.toContain('bad-source-output')
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

  it('accepts real documented signatures at a matching revision and rejects subsequent source edits', async () => {
    const contract = parseContract(JSON.parse(readFileSync(join(artifactDirectory, 'agent-generate.json'), 'utf8')))
    const cwd = join(directory, 'real-source')
    const sources = new Set<string>()
    JSON.stringify(contract, (key, value) => {
      if ((key === 'source' || key === 'targetSource') && typeof value?.path === 'string') sources.add(value.path)
      return value
    })
    for (const source of sources) {
      const target = join(cwd, source)
      mkdirSync(dirname(target), { recursive: true })
      copyFileSync(join(repositoryRoot, source), target)
    }
    const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
    git('init', '--quiet')
    const origin = execFileSync('git', ['remote', 'get-url', 'origin'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    }).trim()
    git('remote', 'add', 'origin', origin)
    git('add', '.')
    git(
      '-c',
      'user.name=API test',
      '-c',
      'user.email=api-test@example.invalid',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--quiet',
      '-m',
      'Pin real source bytes for publication validation\n\nCo-Authored-By: mastra-platform[bot] <284800079+mastra-platform[bot]@users.noreply.github.com>',
    )
    const options = {
      inputDirectory: artifactDirectory,
      cwd,
      revision: git('rev-parse', 'HEAD'),
      production: true,
    }
    const source = '<ApiReference root="Agent.generate" section="signatures" />'
    const processor = parser().use(remarkApiReference, {
      ...options,
      outputDirectory: join(directory, 'real-output'),
    })
    await expect(processor.run(processor.parse(source))).resolves.toBeDefined()
    expect(readdirSync(join(directory, 'real-output'))).toHaveLength(1)

    const signature = contract.declarations[contract.declarations[contract.root]!.signatures[0]!]!
    const file = join(cwd, signature.source!.path)
    writeFileSync(file, `${readFileSync(file, 'utf8')}\n// Uncommitted source change.\n`)
    const changed = parser().use(remarkApiReference, {
      ...options,
      outputDirectory: join(directory, 'dirty-real-output'),
    })
    await expect(changed.run(changed.parse(source))).rejects.toThrow('Source file differs from revision')
    expect(readdirSync(directory)).not.toContain('dirty-real-output')
  })
})
