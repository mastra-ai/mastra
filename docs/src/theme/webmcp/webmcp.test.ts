import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const searchForHits = vi.fn()
const liteClient = vi.fn((_appId: string, _apiKey: string) => ({ searchForHits }))
vi.mock('algoliasearch/lite', () => ({ liteClient }))

const { getModelContext, mountWebMcp } = await import('./index')
const { registerSearchTool, validateInput } = await import('./tool')
const { mapHit } = await import('./search')

const config = {
  appId: 'APP_ID',
  apiKey: 'SEARCH_KEY',
  indexName: 'docs_main',
  siteUrl: 'https://mastra.ai',
}

interface RegisteredTool {
  name: string
  inputSchema: object
  annotations: object
  execute(input: unknown, options?: { signal?: AbortSignal }): Promise<any>
}

function stubContext() {
  const registerTool = vi.fn(async (_tool: RegisteredTool, _options?: { signal?: AbortSignal }) => {})
  return { registerTool }
}

async function registeredTool(context = stubContext()) {
  await registerSearchTool(context, config, new AbortController().signal)
  return context.registerTool.mock.calls[0]![0]
}

function algoliaResponse(hits: object[]) {
  return { results: [{ hits }] }
}

beforeEach(() => {
  searchForHits.mockReset()
  liteClient.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('feature detection', () => {
  it('does nothing when WebMCP is absent', async () => {
    vi.stubGlobal('document', {})
    vi.stubGlobal('navigator', {})
    expect(getModelContext()).toBeUndefined()

    const cleanup = mountWebMcp(config)
    await vi.dynamicImportSettled()
    expect(cleanup).not.toThrow()
    expect(liteClient).not.toHaveBeenCalled()
  })

  it('does nothing outside the browser', () => {
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('navigator', undefined)
    expect(getModelContext()).toBeUndefined()
    expect(() => mountWebMcp(config)()).not.toThrow()
  })

  it('does not throw when the modelContext getter throws', () => {
    vi.stubGlobal('document', {
      get modelContext() {
        throw new Error('blocked')
      },
    })
    vi.stubGlobal('navigator', {})
    expect(getModelContext()).toBeUndefined()
  })

  it('prefers document.modelContext and falls back to navigator.modelContext', () => {
    const fromDocument = stubContext()
    const fromNavigator = stubContext()
    vi.stubGlobal('document', { modelContext: fromDocument })
    vi.stubGlobal('navigator', { modelContext: fromNavigator })
    expect(getModelContext()).toBe(fromDocument)

    vi.stubGlobal('document', {})
    expect(getModelContext()).toBe(fromNavigator)
  })

  it('skips registration when search is not configured', async () => {
    const context = stubContext()
    vi.stubGlobal('document', { modelContext: context })
    mountWebMcp({ ...config, apiKey: undefined })
    await vi.dynamicImportSettled()
    expect(context.registerTool).not.toHaveBeenCalled()
  })
})

describe('registration', () => {
  it('registers search_documentation and unregisters through the signal', async () => {
    const context = stubContext()
    vi.stubGlobal('navigator', { modelContext: context })
    vi.stubGlobal('document', {})

    const cleanup = mountWebMcp(config)
    await vi.waitFor(() => expect(context.registerTool).toHaveBeenCalledTimes(1))

    const [tool, options] = context.registerTool.mock.calls[0]!
    expect(tool.name).toBe('search_documentation')
    expect(tool.annotations).toEqual({ readOnlyHint: true, untrustedContentHint: true })
    expect(tool.inputSchema).toMatchObject({
      required: ['query'],
      properties: {
        query: { type: 'string', maxLength: 500 },
        limit: { type: ['integer', 'null'], minimum: 1, maximum: 20, default: 5 },
      },
    })
    // Registering must not create the Algolia client.
    expect(liteClient).not.toHaveBeenCalled()

    expect(options?.signal?.aborted).toBe(false)
    cleanup()
    expect(options?.signal?.aborted).toBe(true)
  })

  it('does not register when cleaned up before the tool code loads', async () => {
    const context = stubContext()
    vi.stubGlobal('document', { modelContext: context })
    mountWebMcp(config)()
    await vi.dynamicImportSettled()
    expect(context.registerTool).not.toHaveBeenCalled()
  })

  it('keeps exactly one live registration across a StrictMode remount', async () => {
    const context = stubContext()
    vi.stubGlobal('document', { modelContext: context })
    mountWebMcp(config)()
    const cleanup = mountWebMcp(config)
    await vi.waitFor(() => expect(context.registerTool).toHaveBeenCalledTimes(1))
    await vi.dynamicImportSettled()
    expect(context.registerTool).toHaveBeenCalledTimes(1)
    expect(context.registerTool.mock.calls[0]![1]?.signal?.aborted).toBe(false)
    cleanup()
  })

  it('swallows a rejected registration', async () => {
    const context = stubContext()
    context.registerTool.mockRejectedValueOnce(new DOMException('Duplicate', 'InvalidStateError'))
    vi.stubGlobal('document', { modelContext: context })
    mountWebMcp(config)
    await vi.waitFor(() => expect(context.registerTool).toHaveBeenCalled())
  })

  it('unregisters by name on legacy implementations that ignore the signal', async () => {
    const registered = new Set<string>()
    const context = {
      registerTool: vi.fn(async (tool: RegisteredTool) => {
        if (registered.has(tool.name)) throw new DOMException('Duplicate', 'InvalidStateError')
        registered.add(tool.name)
      }),
      unregisterTool: vi.fn((name: string) => {
        if (!registered.delete(name)) throw new DOMException('Unknown', 'NotFoundError')
      }),
    }
    vi.stubGlobal('document', {})
    vi.stubGlobal('navigator', { modelContext: context })

    const first = mountWebMcp(config)
    await vi.waitFor(() => expect(registered.has('search_documentation')).toBe(true))
    first()
    expect(context.unregisterTool).toHaveBeenCalledWith('search_documentation')
    expect(registered.size).toBe(0)

    // A remount (or new config) registers again instead of hitting a duplicate name.
    const second = mountWebMcp(config)
    await vi.waitFor(() => expect(context.registerTool).toHaveBeenCalledTimes(2))
    await expect(context.registerTool.mock.results[1]!.value).resolves.toBeUndefined()
    second()
    expect(registered.size).toBe(0)
  })

  it('does not unregister when registration failed', async () => {
    const context = { ...stubContext(), unregisterTool: vi.fn() }
    context.registerTool.mockRejectedValueOnce(new DOMException('Duplicate', 'InvalidStateError'))
    vi.stubGlobal('document', { modelContext: context })
    const cleanup = mountWebMcp(config)
    await vi.waitFor(() => expect(context.registerTool).toHaveBeenCalled())
    await Promise.resolve()
    cleanup()
    expect(context.unregisterTool).not.toHaveBeenCalled()
  })
})

describe('input validation', () => {
  it.each([
    ['a missing input', undefined],
    ['an array', ['query']],
    ['a missing query', {}],
    ['a non-string query', { query: 42 }],
    ['a blank query', { query: '   ' }],
    ['a query over 500 characters', { query: 'a'.repeat(501) }],
    ['a limit of 0', { query: 'agents', limit: 0 }],
    ['a limit over 20', { query: 'agents', limit: 21 }],
    ['a fractional limit', { query: 'agents', limit: 2.5 }],
    ['a string limit', { query: 'agents', limit: '5' }],
    ['an unknown property', { query: 'agents', version: 'v1' }],
  ])('rejects %s', (_, input) => {
    expect(validateInput(input)).toBeUndefined()
  })

  it('defaults limit to 5 and trims the query', () => {
    expect(validateInput({ query: '  agents  ' })).toEqual({ query: 'agents', limit: 5 })
    expect(validateInput({ query: 'agents', limit: null })).toEqual({ query: 'agents', limit: 5 })
    expect(validateInput({ query: 'a'.repeat(500), limit: 20 })).toEqual({ query: 'a'.repeat(500), limit: 20 })
  })

  it('returns invalid_input as a result without calling Algolia', async () => {
    const tool = await registeredTool()
    await expect(tool.execute({ query: '' })).resolves.toEqual({
      error: { code: 'invalid_input', message: expect.any(String) },
    })
    expect(liteClient).not.toHaveBeenCalled()
  })
})

describe('search', () => {
  const hits = [
    {
      url: 'https://mastra.ai/docs/memory/working-memory#example',
      content: 'Working memory\r\nkeeps   facts\tacross turns.',
      hierarchy: { lvl0: 'Docs', lvl1: 'Working memory', lvl2: 'Usage', lvl3: 'Example', lvl4: null },
    },
    {
      url: 'https://mastra.ai/reference/memory/memory-class',
      content: null,
      hierarchy: { lvl0: 'Reference', lvl1: 'Memory', lvl2: null },
    },
    // Duplicate of the first hit.
    {
      url: 'https://mastra.ai/docs/memory/working-memory#example',
      content: 'again',
      hierarchy: { lvl0: 'Docs', lvl1: 'Working memory' },
    },
  ]

  it('queries Algolia with the configured index and maps hits', async () => {
    searchForHits.mockResolvedValue(algoliaResponse(hits))
    const tool = await registeredTool()

    const response = await tool.execute({ query: 'working memory', limit: 3 })

    expect(liteClient).toHaveBeenCalledWith('APP_ID', 'SEARCH_KEY')
    expect(searchForHits).toHaveBeenCalledWith({
      requests: [
        expect.objectContaining({
          indexName: 'docs_main',
          query: 'working memory',
          hitsPerPage: 3,
          optionalWords: 'working memory',
        }),
      ],
    })
    expect(response).toEqual({
      results: [
        {
          title: 'Working memory',
          heading: 'Example',
          url: 'https://mastra.ai/docs/memory/working-memory#example',
          excerpt: 'Working memory keeps facts across turns.',
        },
        {
          title: 'Memory',
          heading: 'Memory',
          url: 'https://mastra.ai/reference/memory/memory-class',
          excerpt: '',
        },
      ],
    })
  })

  it('creates the client once and reuses it', async () => {
    searchForHits.mockResolvedValue(algoliaResponse([]))
    const tool = await registeredTool()
    await tool.execute({ query: 'agents' })
    await tool.execute({ query: 'workflows' })
    expect(liteClient).toHaveBeenCalledTimes(1)
    expect(searchForHits).toHaveBeenCalledTimes(2)
  })

  it('returns search_failed when Algolia fails, then recovers', async () => {
    searchForHits.mockRejectedValueOnce(new Error('network'))
    const tool = await registeredTool()

    await expect(tool.execute({ query: 'agents' })).resolves.toEqual({
      error: { code: 'search_failed', message: expect.any(String) },
    })

    searchForHits.mockResolvedValueOnce(algoliaResponse([hits[1]]))
    await expect(tool.execute({ query: 'agents' })).resolves.toMatchObject({ results: [{ title: 'Memory' }] })
  })

  it('rejects when the caller cancels', async () => {
    const controller = new AbortController()
    searchForHits.mockImplementation(async () => {
      controller.abort()
      throw new DOMException('Aborted', 'AbortError')
    })
    const tool = await registeredTool()
    await expect(tool.execute({ query: 'agents' }, { signal: controller.signal })).rejects.toThrow()
  })
})

describe('mapHit', () => {
  it('resolves relative URLs against the site and keeps the anchor', () => {
    expect(mapHit({ url: '/docs/agents/overview#tools', hierarchy: { lvl1: 'Agents' } }, config.siteUrl)?.url).toBe(
      'https://mastra.ai/docs/agents/overview#tools',
    )
  })

  it('drops hits without a usable URL', () => {
    expect(mapHit({ url: null }, config.siteUrl)).toBeUndefined()
    expect(mapHit({ url: 'javascript:alert(1)' }, config.siteUrl)).toBeUndefined()
    expect(mapHit({ url: 'https://evil.example/docs' }, config.siteUrl)).toBeUndefined()
  })

  it('caps the excerpt at 1000 characters', () => {
    const excerpt = mapHit({ url: '/docs', content: 'x'.repeat(1500) }, config.siteUrl)?.excerpt
    expect(excerpt).toHaveLength(1000)
  })

  it('falls back to lvl0 when the page has no lvl1', () => {
    expect(mapHit({ url: '/docs', hierarchy: { lvl0: 'Docs' } }, config.siteUrl)).toMatchObject({
      title: 'Docs',
      heading: 'Docs',
    })
  })
})
