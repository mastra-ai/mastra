import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import {
  moveDocuments,
  globToDynamicPattern,
  isGlobPattern,
  mapSourceToDestination,
  routeToFilePath,
  filePathToRoute,
  routeToSidebarId,
} from '../move-doc'

async function createTempFiles(files: Array<{ path: string; content: string }>) {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'move-doc-test-'))

  const readFile = async (filePath: string) => {
    return await fs.readFile(path.join(tempDir, filePath), 'utf-8')
  }

  const writeFile = async (filePath: string, content: string) => {
    const fullPath = path.join(tempDir, filePath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content)
  }

  const listFiles = async (dir = '') => {
    const fullDir = path.join(tempDir, dir)
    const collectedFiles: string[] = []

    const walk = async (currentDir: string) => {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })

      for (const entry of entries) {
        const entryPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await walk(entryPath)
        } else if (entry.isFile()) {
          collectedFiles.push(path.relative(tempDir, entryPath))
        }
      }
    }

    try {
      await walk(fullDir)
      return collectedFiles.sort()
    } catch {
      return []
    }
  }

  for (const file of files) {
    await writeFile(file.path, file.content)
  }

  return {
    tempDir,
    readFile,
    writeFile,
    listFiles,
    cleanup: async () => {
      await fs.rm(tempDir, { recursive: true, force: true })
    },
  }
}

const docsSidebar = `const sidebars = {
  docsSidebar: [
    { type: 'doc', id: 'references/auth', label: 'Auth' },
    { type: 'doc', id: 'references/users', label: 'Users' },
    { type: 'doc', id: 'references/components/sign-in', label: 'Sign in' },
    { type: 'doc', id: 'auth/overview', label: 'Auth overview' },
    { type: 'doc', id: 'users/management', label: 'Users management' },
    { type: 'doc', id: 'api/endpoints', label: 'API endpoints' },
    { type: 'doc', id: 'agents/using-tools', label: 'Using tools' },
    { type: 'doc', id: 'agents/overview', label: 'Agents overview' },
    { type: 'doc', id: 'mcp/overview', label: 'MCP overview' },
  ],
}

export default sidebars
`

const referenceSidebar = `const sidebars = {
  referenceSidebar: [
    { type: 'doc', id: 'index', label: 'Overview' },
  ],
}

export default sidebars
`

const baseFiles = [
  {
    path: 'src/content/en/docs/references/auth.mdx',
    content: `---
title: Authentication
description: How to authenticate users
---
# Authentication guide`,
  },
  {
    path: 'src/content/en/docs/references/users.mdx',
    content: `---
title: Users
---
# Users guide`,
  },
  {
    path: 'src/content/en/docs/references/components/sign-in.mdx',
    content: `---
title: SignIn Component
---
# SignIn component`,
  },
  {
    path: 'src/content/en/docs/auth/overview.mdx',
    content: `---
title: Auth Overview
---
# Authentication Overview`,
  },
  {
    path: 'src/content/en/docs/users/management.mdx',
    content: `---
title: User Management
---
# User Management`,
  },
  {
    path: 'src/content/en/docs/api/endpoints.mdx',
    content: `---
title: API Endpoints
---
# API Endpoints`,
  },
  {
    path: 'src/content/en/docs/agents/using-tools.mdx',
    content: `---
title: Using Tools
---
# Using Tools`,
  },
  {
    path: 'src/content/en/docs/agents/overview.mdx',
    content: `---
title: Agent Overview
---
# Agent Overview`,
  },
  {
    path: 'src/content/en/docs/mcp/overview.mdx',
    content: `---
title: MCP Overview
---
# MCP Overview`,
  },
  {
    path: 'src/content/en/docs/agents/agent-approval.mdx',
    content: `---
title: Agent Approval
---
# Agent Approval

- [Tools](./using-tools)
- [Tools hash](./using-tools#tool-calling)
- [Agent overview](./overview)
- [MCP overview](../mcp/overview)
- [Memory](/docs/memory/overview)`,
  },
  {
    path: 'src/content/en/docs/other-doc.mdx',
    content: `---
title: Other Doc
---
Link to [auth](/docs/auth/overview)
<Card link="/docs/auth/overview#card" />
const item = { link: '/docs/auth/overview#array' }
[auth-ref]: /docs/auth/overview#ref`,
  },
  {
    path: 'src/content/en/docs/sidebars.js',
    content: docsSidebar,
  },
  {
    path: 'src/content/en/reference/sidebars.js',
    content: referenceSidebar,
  },
  {
    path: 'src/content/en/models/embeddings.mdx',
    content: `---
title: Embeddings
---
# Generated embeddings page

Generated pages are scanned but should not be rewritten.`,
  },
  {
    path: 'vercel.redirects.json',
    content: JSON.stringify(
      {
        redirects: [
          {
            source: '/docs/old-auth-guide',
            destination: '/docs/references/auth',
            permanent: true,
          },
          {
            source: '/docs/legacy-users',
            destination: '/docs/users/management',
            permanent: true,
          },
          {
            source: '/docs/old-api/:path*',
            destination: '/docs/api/:path*',
            permanent: true,
          },
        ],
      },
      null,
      2,
    ),
  },
]

describe('move-doc utility functions', () => {
  test('isGlobPattern detects glob patterns', () => {
    expect(isGlobPattern('/docs/references/**')).toBe(true)
    expect(isGlobPattern('/docs/quickstarts/*')).toBe(true)
    expect(isGlobPattern('/docs/guides/[id]')).toBe(true)
    expect(isGlobPattern('/docs/guides/{a,b}')).toBe(true)
    expect(isGlobPattern('/docs/single-file')).toBe(false)
  })

  test('globToDynamicPattern converts glob patterns', () => {
    expect(globToDynamicPattern('/docs/references/**')).toBe('/docs/references/:path*')
    expect(globToDynamicPattern('/docs/quickstarts/*')).toBe('/docs/quickstarts/:path*')
    expect(globToDynamicPattern('/docs/guides/*/*')).toBe('/docs/guides/:path*/:path*')
  })

  test('mapSourceToDestination maps files with glob captures', () => {
    expect(mapSourceToDestination('/docs/references/authentication', '/docs/references/**', '/docs/reference/**')).toBe(
      '/docs/reference/authentication',
    )
  })

  test('routeToFilePath maps editable Mastra route families', () => {
    expect(routeToFilePath('/docs/agents/overview')).toBe('src/content/en/docs/agents/overview.mdx')
    expect(routeToFilePath('/reference/agents/agent')).toBe('src/content/en/reference/agents/agent.mdx')
    expect(routeToFilePath('/guides/getting-started/quickstart')).toBe(
      'src/content/en/guides/getting-started/quickstart.mdx',
    )
  })

  test('filePathToRoute maps editable Mastra content files to routes', () => {
    expect(filePathToRoute('src/content/en/docs/agents/overview.mdx')).toBe('/docs/agents/overview')
    expect(filePathToRoute('src/content/en/reference/agents/agent.mdx')).toBe('/reference/agents/agent')
    expect(filePathToRoute('src/content/en/guides/getting-started/quickstart.mdx')).toBe(
      '/guides/getting-started/quickstart',
    )
  })

  test('routeToSidebarId strips editable family route prefix', () => {
    expect(routeToSidebarId('/docs/agents/overview')).toBe('agents/overview')
    expect(routeToSidebarId('/reference/agents/agent')).toBe('agents/agent')
    expect(routeToSidebarId('/guides/getting-started/quickstart')).toBe('getting-started/quickstart')
  })

  test('model routes are rejected because they are auto-generated', () => {
    expect(() => routeToFilePath('/models/providers/openai')).toThrow('/models pages are auto-generated')
    expect(() => filePathToRoute('src/content/en/models/providers/openai.mdx')).toThrow('Unsupported docs file path')
    expect(() => routeToSidebarId('/models/providers/openai')).toThrow('/models pages are auto-generated')
  })
})

describe('move-doc Mastra integration tests', () => {
  let tempSetup: Awaited<ReturnType<typeof createTempFiles>>
  let originalCwd: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    tempSetup = await createTempFiles(baseFiles)
    process.chdir(tempSetup.tempDir)
  })

  afterEach(async () => {
    process.chdir(originalCwd)
    vi.restoreAllMocks()
    await tempSetup.cleanup()
  })

  test('handles dry run for single file without mutating files', async () => {
    const initialRedirects = await tempSetup.readFile('vercel.redirects.json')
    const initialSidebar = await tempSetup.readFile('src/content/en/docs/sidebars.js')

    const result = await moveDocuments('/docs/references/auth', '/docs/guide/authentication', {
      verbose: false,
      dryRun: true,
    })

    expect(result.success).toBe(true)
    expect(result.results[0].status).toBe('would-move')
    expect(await tempSetup.listFiles()).toContain('src/content/en/docs/references/auth.mdx')
    expect(await tempSetup.readFile('vercel.redirects.json')).toBe(initialRedirects)
    expect(await tempSetup.readFile('src/content/en/docs/sidebars.js')).toBe(initialSidebar)
  })

  test('handles dry run for glob pattern without mutating files', async () => {
    const initialRedirects = await tempSetup.readFile('vercel.redirects.json')

    const result = await moveDocuments('/docs/references/**', '/docs/reference/**', { verbose: false, dryRun: true })

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(3)
    expect(result.results.every(r => r.status === 'would-move')).toBe(true)
    expect(await tempSetup.readFile('vercel.redirects.json')).toBe(initialRedirects)
    expect(await tempSetup.listFiles()).toContain('src/content/en/docs/references/auth.mdx')
  })

  test('moves a single file, updates redirects, sidebars, and inbound links', async () => {
    const result = await moveDocuments('/docs/references/auth', '/docs/guide/authentication', { verbose: false })

    expect(result.success).toBe(true)
    expect(result.results[0].status).toBe('success')

    const files = await tempSetup.listFiles()
    expect(files).toContain('src/content/en/docs/guide/authentication.mdx')
    expect(files).not.toContain('src/content/en/docs/references/auth.mdx')

    const redirects = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects
    expect(redirects).toContainEqual({
      source: '/docs/references/auth',
      destination: '/docs/guide/authentication',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/old-auth-guide',
      destination: '/docs/guide/authentication',
      permanent: true,
    })

    const sidebar = await tempSetup.readFile('src/content/en/docs/sidebars.js')
    expect(sidebar).toContain("id: 'guide/authentication'")
    expect(sidebar).not.toContain("id: 'references/auth'")
  })

  test('rewrites all supported MDX link shapes for single-file moves', async () => {
    await moveDocuments('/docs/auth/overview', '/docs/authentication/guide', { verbose: false })

    const content = await tempSetup.readFile('src/content/en/docs/other-doc.mdx')
    expect(content).toContain('[auth](/docs/authentication/guide)')
    expect(content).toContain('link="/docs/authentication/guide#card"')
    expect(content).toContain("link: '/docs/authentication/guide#array'")
    expect(content).toContain('[auth-ref]: /docs/authentication/guide#ref')
  })

  test('rewrites relative markdown links and preserves relative style', async () => {
    await moveDocuments('/docs/agents/using-tools', '/docs/tools/using-tools', { verbose: false })

    const content = await tempSetup.readFile('src/content/en/docs/agents/agent-approval.mdx')
    expect(content).toContain('- [Tools](../tools/using-tools)')
    expect(content).toContain('- [Tools hash](../tools/using-tools#tool-calling)')
    expect(content).toContain('- [Agent overview](./overview)')
    expect(content).toContain('- [MCP overview](../mcp/overview)')
    expect(content).toContain('- [Memory](/docs/memory/overview)')
  })

  test('rewrites relative parent markdown links when the target moves', async () => {
    await moveDocuments('/docs/mcp/overview', '/docs/protocols/mcp/overview', { verbose: false })

    const content = await tempSetup.readFile('src/content/en/docs/agents/agent-approval.mdx')
    expect(content).toContain('- [MCP overview](../protocols/mcp/overview)')
    expect(content).toContain('- [Tools](./using-tools)')
  })

  test('moves a glob and adds one dynamic redirect without SDK-scoped redirects', async () => {
    const result = await moveDocuments('/docs/references/**', '/docs/reference/**', { verbose: false })

    expect(result.success).toBe(true)
    expect(result.results).toHaveLength(3)
    expect(result.results.every(r => r.status === 'success')).toBe(true)

    const files = await tempSetup.listFiles()
    expect(files).toContain('src/content/en/docs/reference/auth.mdx')
    expect(files).toContain('src/content/en/docs/reference/users.mdx')
    expect(files).toContain('src/content/en/docs/reference/components/sign-in.mdx')

    const redirects = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects
    expect(redirects).toContainEqual({
      source: '/docs/references/:path*',
      destination: '/docs/reference/:path*',
      permanent: true,
    })
    expect(redirects.some((redirect: { source: string }) => redirect.source.includes(':sdk'))).toBe(false)
  })

  test('updates static redirect source and destination when glob redirect covers them', async () => {
    await tempSetup.writeFile(
      'vercel.redirects.json',
      JSON.stringify({
        redirects: [{ source: '/docs/api/v1/users', destination: '/docs/api/v2/users', permanent: true }],
      }),
    )
    await tempSetup.writeFile('src/content/en/docs/api/v1/users.mdx', '---\ntitle: Users v1\n---\n# Users v1')
    await tempSetup.writeFile('src/content/en/docs/api/v2/users.mdx', '---\ntitle: Users v2\n---\n# Users v2')

    const result = await moveDocuments('/docs/api/**', '/docs/**', { verbose: false })

    expect(result.success).toBe(true)
    const redirects = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects
    expect(redirects).toContainEqual({
      source: '/docs/api/:path*',
      destination: '/docs/:path*',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/v1/users',
      destination: '/docs/v2/users',
      permanent: true,
    })
  })

  test('collapses redirect chains and preserves hashes', async () => {
    await tempSetup.writeFile(
      'vercel.redirects.json',
      JSON.stringify({
        redirects: [
          { source: '/docs/very-old-auth', destination: '/docs/old-auth#old', permanent: true },
          { source: '/docs/old-auth#source', destination: '/docs/auth/overview#config', permanent: true },
          { source: '/docs/legacy-guide', destination: '/docs/auth/overview#getting-started', permanent: true },
        ],
      }),
    )

    const result = await moveDocuments('/docs/auth/overview', '/docs/authentication/guide', { verbose: false })

    expect(result.success).toBe(true)
    const redirects = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects
    expect(redirects).toContainEqual({
      source: '/docs/old-auth#source',
      destination: '/docs/authentication/guide#config',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/very-old-auth',
      destination: '/docs/authentication/guide#old',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/legacy-guide',
      destination: '/docs/authentication/guide#getting-started',
      permanent: true,
    })
    expect(redirects).toContainEqual({
      source: '/docs/auth/overview',
      destination: '/docs/authentication/guide',
      permanent: true,
    })
  })

  test('does not create duplicate static redirects on repeated move patterns', async () => {
    await moveDocuments('/docs/auth/overview', '/docs/authentication/guide', { verbose: false })
    const initialCount = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects.filter(
      (redirect: { source: string }) => redirect.source === '/docs/auth/overview',
    ).length

    await tempSetup.writeFile(
      'src/content/en/docs/auth/overview.mdx',
      '---\ntitle: Auth Overview\n---\n# Auth Overview',
    )
    await fs.rm(path.join(tempSetup.tempDir, 'src/content/en/docs/authentication/guide.mdx'))

    await moveDocuments('/docs/auth/overview', '/docs/authentication/guide', { verbose: false })
    const finalCount = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects.filter(
      (redirect: { source: string }) => redirect.source === '/docs/auth/overview',
    ).length

    expect(finalCount).toBe(initialCount)
  })

  test('does not create duplicate dynamic redirects on repeated glob moves', async () => {
    await tempSetup.writeFile('src/content/en/docs/guides/auth.mdx', '---\ntitle: Auth Guide\n---\n# Auth')
    await moveDocuments('/docs/guides/**', '/docs/guide/**', { verbose: false })

    await tempSetup.writeFile('src/content/en/docs/guides/new-auth.mdx', '---\ntitle: New Auth\n---\n# Auth')
    await moveDocuments('/docs/guides/**', '/docs/guide/**', { verbose: false })

    const redirects = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects
    expect(redirects.filter((redirect: { source: string }) => redirect.source === '/docs/guides/:path*')).toHaveLength(
      1,
    )
  })

  test('returns failure when source file does not exist', async () => {
    const result = await moveDocuments('/docs/nonexistent', '/docs/new-location', { verbose: false })

    expect(result.success).toBe(false)
    expect(result.message).toContain('Source path does not exist')
    expect(result.results[0].status).toBe('failed')
  })

  test('rejects moves from or to the auto-generated models family', async () => {
    const sourceResult = await moveDocuments('/models/providers/openai', '/docs/models/openai', { verbose: false })
    const destinationResult = await moveDocuments('/docs/auth/overview', '/models/providers/openai', { verbose: false })
    const dryRunResult = await moveDocuments('/models/providers/openai', '/docs/models/openai', {
      verbose: false,
      dryRun: true,
    })

    expect(sourceResult.success).toBe(false)
    expect(sourceResult.message).toContain('/models pages are auto-generated')
    expect(destinationResult.success).toBe(false)
    expect(destinationResult.message).toContain('/models pages are auto-generated')
    expect(dryRunResult.success).toBe(false)
    expect(dryRunResult.message).toContain('/models pages are auto-generated')
  })

  test('validates glob pattern requirements', async () => {
    await expect(moveDocuments('/docs/references/**', '/docs/single-destination', { verbose: false })).rejects.toThrow(
      'If source is a glob pattern, destination must also be a glob pattern',
    )
    await expect(moveDocuments('/docs/single-source', '/docs/references/**', { verbose: false })).rejects.toThrow(
      'If destination is a glob pattern, source must also be a glob pattern',
    )
  })

  test('skips same-source-destination move and redirect', async () => {
    const initialCount = JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects.length

    const result = await moveDocuments('/docs/auth/overview', '/docs/auth/overview', { verbose: false })

    expect(result.success).toBe(true)
    expect(JSON.parse(await tempSetup.readFile('vercel.redirects.json')).redirects).toHaveLength(initialCount)
    expect(await tempSetup.listFiles()).toContain('src/content/en/docs/auth/overview.mdx')
  })

  test('cross-family moves warn and leave sidebar update to user', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await moveDocuments('/docs/auth/overview', '/reference/auth/overview', { verbose: false })

    expect(result.success).toBe(true)
    expect(await tempSetup.listFiles()).toContain('src/content/en/reference/auth/overview.mdx')
    expect(await tempSetup.readFile('src/content/en/docs/sidebars.js')).toContain("id: 'auth/overview'")
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Cross-family move detected'))
  })

  test('missing sidebars.js is handled gracefully', async () => {
    await fs.rm(path.join(tempSetup.tempDir, 'src/content/en/docs/sidebars.js'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await moveDocuments('/docs/auth/overview', '/docs/authentication/guide', { verbose: false })

    expect(result.success).toBe(true)
    expect(await tempSetup.listFiles()).toContain('src/content/en/docs/authentication/guide.mdx')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No sidebar file found'))
  })
})
