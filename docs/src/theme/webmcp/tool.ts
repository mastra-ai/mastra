import type { ModelContext, SearchConfig } from './index'

export const LIMITS = { query: 500, defaultLimit: 5, maxLimit: 20, excerpt: 1000 } as const

export interface SearchResult {
  title: string
  heading: string
  url: string
  excerpt: string
}

export type ErrorCode = 'invalid_input' | 'search_failed'

export type SearchResponse = { results: SearchResult[] } | { error: { code: ErrorCode; message: string } }

export interface SearchInput {
  query: string
  limit: number
}

export type RunSearch = (input: SearchInput) => Promise<SearchResult[]>

type LoadSearch = () => Promise<{ createSearch(config: SearchConfig): RunSearch }>

const MESSAGES: Record<ErrorCode, string> = {
  invalid_input: `Provide a non-empty query of at most ${LIMITS.query} characters and an integer limit from 1 to ${LIMITS.maxLimit}.`,
  search_failed: 'Documentation search failed. Retry the search; if it keeps failing, reload the page.',
}

function failure(code: ErrorCode): SearchResponse {
  return { error: { code, message: MESSAGES[code] } }
}

export const inputSchema = {
  type: 'object',
  required: ['query'],
  additionalProperties: false,
  properties: {
    query: {
      type: 'string',
      description: 'What to search for. Keywords or a natural-language question.',
      minLength: 1,
      maxLength: LIMITS.query,
      pattern: '\\S',
    },
    limit: {
      type: 'integer',
      description: 'Maximum number of results.',
      minimum: 1,
      maximum: LIMITS.maxLimit,
      default: LIMITS.defaultLimit,
    },
  },
} as const

/** Agents can send anything, so check the input even though the schema describes it. */
export function validateInput(input: unknown): SearchInput | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined
  const record = input as Record<string, unknown>
  if (Object.keys(record).some(key => key !== 'query' && key !== 'limit')) return undefined
  const { query, limit = LIMITS.defaultLimit } = record
  if (typeof query !== 'string' || !query.trim() || [...query].length > LIMITS.query) return undefined
  if (typeof limit !== 'number' || !Number.isInteger(limit) || limit < 1 || limit > LIMITS.maxLimit) return undefined
  return { query: query.trim(), limit }
}

export async function registerSearchTool(
  context: ModelContext,
  config: SearchConfig,
  signal: AbortSignal,
  loadSearch: LoadSearch = () => import('./search'),
): Promise<void> {
  if (signal.aborted) return
  // The Algolia client is created on the first call, never just to expose the tool.
  let search: Promise<RunSearch> | undefined

  await context.registerTool(
    {
      name: 'search_documentation',
      title: 'Search Mastra documentation',
      description:
        'Search the Mastra documentation (guides, reference, integrations, models). Returns matching sections with their page title, heading, absolute URL and a plain-text excerpt.',
      inputSchema,
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      async execute(input: unknown, options?: { signal?: AbortSignal }): Promise<SearchResponse> {
        const parsed = validateInput(input)
        if (!parsed) return failure('invalid_input')
        try {
          search ??= loadSearch().then(({ createSearch }) => createSearch(config))
          const run = await search
          options?.signal?.throwIfAborted()
          return { results: await run(parsed) }
        } catch (error) {
          // A cancelled call stays cancelled; everything else is reported to the agent.
          if (options?.signal?.aborted) throw error
          search = undefined
          return failure('search_failed')
        }
      },
    },
    { signal },
  )
}
