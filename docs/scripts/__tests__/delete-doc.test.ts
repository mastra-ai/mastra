import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { deleteDocument, removeSidebarDocId } from '../delete-doc'

interface Fixture {
  tempDir: string
  read: (filePath: string) => Promise<string>
  exists: (filePath: string) => Promise<boolean>
  snapshot: () => Promise<Map<string, string>>
  cleanup: () => Promise<void>
}

const sidebar = `const unrelated = ['old/page']
const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Remove me',
      customProps: { note: 'keep elsewhere' },
      items: [
        { type: 'doc', id: 'old/page', label: 'Old' },
      ],
    },
    { type: 'doc', id: 'replacement', label: 'Replacement' },
  ],
}

export default sidebars
`

const files = {
  'src/content/en/docs/old/page.mdx': '# Old page\n',
  'src/content/en/docs/replacement.mdx': '# Replacement\n',
  'src/content/en/docs/links.mdx': `# Links

[Absolute](/docs/old/page#absolute)
[Relative](./old/page#relative)
<Card link="/docs/old/page#card" />
const item = { link: '/docs/old/page#array' }
[reference]: /docs/old/page#reference
`,
  'src/content/en/docs/nested/links.mdx': `# Nested links

[Parent relative](../old/page#parent)
`,
  'src/content/en/docs/sidebars.js': sidebar,
  'src/content/en/reference/sidebars.js':
    "const sidebars = { referenceSidebar: [{ type: 'doc', id: 'index' }] }\nexport default sidebars\n",
  'vercel.redirects.json': `${JSON.stringify(
    {
      redirects: [
        { source: '/docs/legacy', destination: '/docs/old/page#legacy', permanent: false },
        { source: '/docs/older', destination: '/docs/legacy', permanent: true },
      ],
    },
    null,
    2,
  )}\n`,
}

async function createFixture(overrides: Record<string, string | null> = {}): Promise<Fixture> {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'delete-doc-test-'))
  const fixtureFiles = { ...files, ...overrides }

  for (const [filePath, content] of Object.entries(fixtureFiles)) {
    if (content === null) continue
    const fullPath = path.join(tempDir, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content)
  }

  const read = (filePath: string) => fs.readFile(path.join(tempDir, filePath), 'utf-8')
  const exists = async (filePath: string) => {
    try {
      await fs.access(path.join(tempDir, filePath))
      return true
    } catch {
      return false
    }
  }
  const snapshot = async () => {
    const result = new Map<string, string>()
    const walk = async (directory: string): Promise<void> => {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const fullPath = path.join(directory, entry.name)
        if (entry.isDirectory()) await walk(fullPath)
        else result.set(path.relative(tempDir, fullPath), await fs.readFile(fullPath, 'utf-8'))
      }
    }
    await walk(tempDir)
    return result
  }

  return {
    tempDir,
    read,
    exists,
    snapshot,
    cleanup: () => fs.rm(tempDir, { recursive: true, force: true }),
  }
}

describe('removeSidebarDocId', () => {
  test('removes object and string entries while preserving unrelated source', () => {
    const content = `const unrelated = ['target']
const sidebars = {
  docsSidebar: [
    'target', // between duplicate entries
    { type: 'doc', id: 'target', label: 'Target' },
    { type: 'doc', id: 'keep', customProps: { value: 'target' } },
  ],
}
export default sidebars
`

    const result = removeSidebarDocId(content, 'docs', 'target')

    expect(result.matched).toBe(2)
    expect(result.content).toContain("const unrelated = ['target']")
    expect(result.content).toContain("id: 'keep'")
    expect(result.content).toContain("value: 'target'")
    expect(result.content).not.toContain("id: 'target'")
  })

  test.each([
    ['start', "'target', 'target', 'keep'", "  'keep'"],
    ['middle', "'before', 'target', 'target', 'after'", "'before',   'after'"],
    ['end', "'keep', 'target', 'target'", "'keep'  "],
    ['all', "'target', 'target'", ' '],
  ])('removes an adjacent duplicate run at the %s', (_position, items, expectedItems) => {
    const content = `const sidebars = { docsSidebar: [${items}] }\nexport default sidebars\n`
    const result = removeSidebarDocId(content, 'docs', 'target')
    expect(result.matched).toBe(2)
    expect(result.content).toBe(`const sidebars = { docsSidebar: [${expectedItems}] }\nexport default sidebars\n`)
  })

  test('prunes nested categories that become empty and preserves retained category comments', () => {
    const content = `const sidebars = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Outer',
      items: [
        {
          type: 'category',
          label: 'Inner',
          items: [{ type: 'doc', id: 'target' }],
        },
      ],
    },
    // keep this comment
    { type: 'doc', id: 'keep' },
  ],
}
export default sidebars
`
    const result = removeSidebarDocId(content, 'docs', 'target')
    expect(result.content).not.toContain("label: 'Outer'")
    expect(result.content).not.toContain("label: 'Inner'")
    expect(result.content).toContain('// keep this comment')
    expect(result.content).toContain("id: 'keep'")
  })

  test('rejects malformed or ambiguous sidebar modules', () => {
    expect(() => removeSidebarDocId('const sidebars = {', 'docs', 'target')).toThrow('Could not parse sidebar')
    expect(() =>
      removeSidebarDocId(
        'const sidebars = { docsSidebar: [] }; const sidebars = { docsSidebar: [] }',
        'docs',
        'target',
      ),
    ).toThrow('Expected one sidebars object declaration')
    expect(() => removeSidebarDocId('const sidebars = { docsSidebar: [...items] }', 'docs', 'target')).toThrow(
      'spread elements',
    )
  })
})

describe('deleteDocument', () => {
  let fixture: Fixture
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    fixture = await createFixture()
    process.chdir(fixture.tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    vi.restoreAllMocks()
    await fixture.cleanup()
  })

  test('deletes one document and updates redirects, links, and nested sidebars', async () => {
    const result = await deleteDocument('/docs/old/page', '/docs/replacement#new-section', { verbose: false })

    expect(result).toMatchObject({ success: true, results: [{ status: 'success' }] })
    expect(await fixture.exists('src/content/en/docs/old/page.mdx')).toBe(false)

    const updatedSidebar = await fixture.read('src/content/en/docs/sidebars.js')
    expect(updatedSidebar).not.toContain("label: 'Remove me'")
    expect(updatedSidebar).toContain("id: 'replacement'")
    expect(updatedSidebar).toContain("const unrelated = ['old/page']")

    const links = await fixture.read('src/content/en/docs/links.mdx')
    expect(links).toContain('[Absolute](/docs/replacement#new-section)')
    expect(links).toContain('[Relative](./replacement#new-section)')
    expect(links).toContain('link="/docs/replacement#new-section"')
    expect(links).toContain("link: '/docs/replacement#new-section'")
    expect(links).toContain('[reference]: /docs/replacement#new-section')
    expect(await fixture.read('src/content/en/docs/nested/links.mdx')).toContain(
      '[Parent relative](../replacement#new-section)',
    )

    const redirects = JSON.parse(await fixture.read('vercel.redirects.json')).redirects
    expect(redirects).toContainEqual({
      source: '/docs/old/page',
      destination: '/docs/replacement#new-section',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/legacy',
      destination: '/docs/replacement#new-section',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/older',
      destination: '/docs/replacement#new-section',
      permanent: true,
    })
  })

  test('redirects links to an external HTTPS replacement', async () => {
    const result = await deleteDocument('/docs/old/page', 'https://agent-builder.mastra.ai', { verbose: false })

    expect(result).toMatchObject({
      success: true,
      results: [{ destination: 'https://agent-builder.mastra.ai/', status: 'success' }],
    })
    expect(await fixture.exists('src/content/en/docs/old/page.mdx')).toBe(false)

    const links = await fixture.read('src/content/en/docs/links.mdx')
    expect(links).toContain('[Absolute](https://agent-builder.mastra.ai/#absolute)')
    expect(links).toContain('[Relative](https://agent-builder.mastra.ai/#relative)')
    expect(links).toContain('link="https://agent-builder.mastra.ai/#card"')
    expect(links).toContain("link: 'https://agent-builder.mastra.ai/#array'")
    expect(links).toContain('[reference]: https://agent-builder.mastra.ai/#reference')
    expect(await fixture.read('src/content/en/docs/nested/links.mdx')).toContain(
      '[Parent relative](https://agent-builder.mastra.ai/#parent)',
    )

    const redirects = JSON.parse(await fixture.read('vercel.redirects.json')).redirects
    expect(redirects).toContainEqual({
      source: '/docs/old/page',
      destination: 'https://agent-builder.mastra.ai/',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/legacy',
      destination: 'https://agent-builder.mastra.ai/#legacy',
      permanent: true,
    })
  })

  test('normalizes trailing slashes after splitting destination hashes', async () => {
    const result = await deleteDocument('/docs/old/page/', '/docs/replacement/#section', { verbose: false })
    expect(result.success).toBe(true)
    expect(result.results[0].destination).toBe('/docs/replacement#section')
  })

  test('supports a replacement in another editable family', async () => {
    process.chdir(originalCwd)
    await fixture.cleanup()
    fixture = await createFixture({ 'src/content/en/reference/replacement.mdx': '# Guide replacement\n' })
    process.chdir(fixture.tempDir)

    const result = await deleteDocument('/docs/old/page', '/reference/replacement#guide', { verbose: false })

    expect(result.success).toBe(true)
    expect(await fixture.read('src/content/en/docs/links.mdx')).toContain('[Absolute](/reference/replacement#guide)')
    expect(await fixture.read('src/content/en/docs/links.mdx')).toContain('[Relative](../reference/replacement#guide)')
  })

  test('supports a family-root index replacement with a hash', async () => {
    process.chdir(originalCwd)
    await fixture.cleanup()
    fixture = await createFixture({ 'src/content/en/docs/index.mdx': '# Docs index\n' })
    process.chdir(fixture.tempDir)

    const result = await deleteDocument('/docs/old/page', '/docs/#section', { verbose: false })

    expect(result.success).toBe(true)
    expect(result.results[0].destination).toBe('/docs#section')
    expect(await fixture.read('src/content/en/docs/links.mdx')).toContain('[Absolute](/docs#section)')
  })

  test('dry-run validates routes and reads every candidate file without changing files', async () => {
    const before = await fixture.snapshot()
    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { dryRun: true, verbose: false })
    expect(result.results[0].status).toBe('would-delete')
    expect(await fixture.snapshot()).toEqual(before)
  })

  test.each([
    ['/docs/old/page#section', '/docs/replacement', 'Source route must not include a hash'],
    ['/docs/old/page', '/docs/old/page#section', 'different routes'],
    ['/docs/old/*', '/docs/replacement', 'Glob routes are not supported'],
    ['/docs/../guides/page', '/docs/replacement', 'Route must not contain dot segments'],
    ['/docs/old/page', '/docs/./replacement', 'Route must not contain dot segments'],
    ['/docs//old/page', '/docs/replacement', 'Route must not contain repeated slashes'],
    ['/docs/old/page', '/docs//replacement', 'Route must not contain repeated slashes'],
    ['/docs/old/page', 'http://agent-builder.mastra.ai', 'External replacement URLs must use HTTPS'],
    ['/docs/old/page', 'https://', 'Invalid replacement URL'],
    ['/docs/old/page', 'https://user:secret@example.com', 'must not include credentials'],
    ['/models/old/page', '/docs/replacement', 'Unsupported generated docs route'],
    ['/docs/old/page', '/models/replacement', 'Unsupported generated docs route'],
    ['/unknown/old', '/docs/replacement', 'Unsupported docs route'],
  ])('rejects invalid routes before mutation: %s', async (source, destination, message) => {
    const before = await fixture.snapshot()
    const result = await deleteDocument(source, destination, { verbose: false })
    expect(result.success).toBe(false)
    expect(result.message).toContain(message)
    expect(await fixture.snapshot()).toEqual(before)
  })

  test('requires the replacement destination to be a live file', async () => {
    const result = await deleteDocument('/docs/old/page', '/docs/missing', { verbose: false })
    expect(result.success).toBe(false)
    expect(result.message).toContain('Destination path does not exist')
    expect(await fixture.exists('src/content/en/docs/old/page.mdx')).toBe(true)
  })

  test('rejects a redirect-only replacement alias', async () => {
    const result = await deleteDocument('/docs/old/page', '/docs/legacy', { verbose: false })
    expect(result.success).toBe(false)
    expect(result.message).toContain('Destination path does not exist')
  })

  test.each([
    ['/docs/directory', '/docs/replacement', 'Source path must be a file'],
    ['/docs/old/page', '/docs/directory', 'Destination path must be a file'],
  ])('rejects directory routes before mutation: %s', async (source, destination, message) => {
    await fs.mkdir(path.join(fixture.tempDir, 'src/content/en/docs/directory.mdx'))
    const before = await fixture.snapshot()
    const result = await deleteDocument(source, destination, { verbose: false })
    expect(result.success).toBe(false)
    expect(result.message).toContain(message)
    expect(await fixture.snapshot()).toEqual(before)
  })

  test.each([
    ['malformed redirects', { 'vercel.redirects.json': '{' }, 'JSON'],
    ['malformed sidebar', { 'src/content/en/docs/sidebars.js': 'const sidebars = {' }, 'Could not parse sidebar'],
  ])('fails preflight for %s without writes', async (_name, overrides, message) => {
    process.chdir(originalCwd)
    await fixture.cleanup()
    fixture = await createFixture(overrides)
    process.chdir(fixture.tempDir)
    const before = await fixture.snapshot()
    const write = vi.spyOn(fs, 'writeFile')
    const unlink = vi.spyOn(fs, 'unlink')

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain(message)
    expect(write).not.toHaveBeenCalled()
    expect(unlink).not.toHaveBeenCalled()
    expect(await fixture.snapshot()).toEqual(before)
  })

  test('fails preflight when an editable MDX file cannot be read', async () => {
    const before = await fixture.snapshot()
    const originalRead = fs.readFile.bind(fs)
    vi.spyOn(fs, 'readFile').mockImplementation(async (...args) => {
      if (String(args[0]).endsWith(path.join('docs', 'links.mdx'))) throw new Error('injected MDX read failure')
      return await originalRead(...args)
    })
    const write = vi.spyOn(fs, 'writeFile')
    const unlink = vi.spyOn(fs, 'unlink')

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain('injected MDX read failure')
    expect(write).not.toHaveBeenCalled()
    expect(unlink).not.toHaveBeenCalled()
    vi.mocked(fs.readFile).mockRestore()
    expect(await fixture.snapshot()).toEqual(before)
  })

  test('allows a missing sidebar and still deletes the document', async () => {
    process.chdir(originalCwd)
    await fixture.cleanup()
    fixture = await createFixture({ 'src/content/en/docs/sidebars.js': null })
    process.chdir(fixture.tempDir)

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })
    expect(result.success).toBe(true)
    expect(await fixture.exists('src/content/en/docs/old/page.mdx')).toBe(false)
  })

  test('warns when the source sidebar file is missing', async () => {
    process.chdir(originalCwd)
    await fixture.cleanup()
    fixture = await createFixture({ 'src/content/en/docs/sidebars.js': null })
    process.chdir(fixture.tempDir)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await deleteDocument('/docs/old/page', '/docs/replacement')

    expect(result.success).toBe(true)
    expect(warn).toHaveBeenCalledWith(
      'No sidebar file found at src/content/en/docs/sidebars.js; update sidebar manually if needed.',
    )
  })

  test('allows a sidebar without the source id', async () => {
    process.chdir(originalCwd)
    await fixture.cleanup()
    fixture = await createFixture({
      'src/content/en/docs/sidebars.js':
        "const sidebars = { docsSidebar: [{ type: 'doc', id: 'replacement' }] }\nexport default sidebars\n",
    })
    process.chdir(fixture.tempDir)

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })
    expect(result.success).toBe(true)
  })

  test('warns when the source sidebar id is absent', async () => {
    process.chdir(originalCwd)
    await fixture.cleanup()
    fixture = await createFixture({
      'src/content/en/docs/sidebars.js':
        "const sidebars = { docsSidebar: [{ type: 'doc', id: 'replacement' }] }\nexport default sidebars\n",
    })
    process.chdir(fixture.tempDir)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    const result = await deleteDocument('/docs/old/page', '/docs/replacement')

    expect(result.success).toBe(true)
    expect(warn).toHaveBeenCalledWith('No sidebar id found for old/page in src/content/en/docs/sidebars.js')
  })

  test('silent mode suppresses informational, warning, and error output', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(true)
    expect(log).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  test('default verbosity reports completion', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    const result = await deleteDocument('/docs/old/page', '/docs/replacement')
    expect(result.success).toBe(true)
    expect(log).toHaveBeenCalledWith('Document deletion completed successfully')
  })

  test.each([
    ['redirect write', 1],
    ['sidebar write', 2],
    ['MDX link write', 3],
  ])('rolls back byte-for-byte after a failed %s', async (_stage, failedWrite) => {
    const before = await fixture.snapshot()
    const originalWrite = fs.writeFile.bind(fs)
    let calls = 0
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
      calls++
      if (calls === failedWrite) throw new Error(`injected write failure ${failedWrite}`)
      return await originalWrite(...args)
    })
    const unlink = vi.spyOn(fs, 'unlink')

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain(`injected write failure ${failedWrite}`)
    expect(unlink).not.toHaveBeenCalled()
    expect(await fixture.snapshot()).toEqual(before)
  })

  test('restores an earlier MDX update when a later MDX write fails', async () => {
    const before = await fixture.snapshot()
    const originalWrite = fs.writeFile.bind(fs)
    let calls = 0
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
      calls++
      if (calls === 4) throw new Error('second MDX write failed')
      return await originalWrite(...args)
    })

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain('second MDX write failed')
    expect(await fixture.snapshot()).toEqual(before)
  })

  test('reports both the original error and rollback failures', async () => {
    const originalWrite = fs.writeFile.bind(fs)
    let calls = 0
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
      calls++
      if (calls === 1) {
        await originalWrite(...args)
        throw new Error('original write failure')
      }
      if (calls === 2) throw new Error('rollback write failure')
      return await originalWrite(...args)
    })

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain('original write failure')
    expect(result.message).toContain('Rollback failed:')
    expect(result.message).toContain('rollback write failure')
  })

  test('rolls back a file that was mutated before a write rejected', async () => {
    const before = await fixture.snapshot()
    const originalWrite = fs.writeFile.bind(fs)
    let calls = 0
    vi.spyOn(fs, 'writeFile').mockImplementation(async (...args) => {
      calls++
      const result = await originalWrite(...args)
      if (calls === 1) throw new Error('mutated before rejection')
      return result
    })

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain('mutated before rejection')
    expect(await fixture.snapshot()).toEqual(before)
  })

  test('deletes the source only after every write succeeds', async () => {
    const write = vi.spyOn(fs, 'writeFile')
    const unlink = vi.spyOn(fs, 'unlink')

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(true)
    const lastWriteOrder = Math.max(...write.mock.invocationCallOrder)
    expect(unlink.mock.invocationCallOrder[0]).toBeGreaterThan(lastWriteOrder)
  })

  test('restores the source file when unlink fails', async () => {
    const before = await fixture.snapshot()
    vi.spyOn(fs, 'unlink').mockRejectedValueOnce(new Error('injected unlink failure'))

    const result = await deleteDocument('/docs/old/page', '/docs/replacement', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain('injected unlink failure')
    expect(await fixture.snapshot()).toEqual(before)
  })
})
