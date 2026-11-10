// WebMCP (https://webmachinelearning.github.io/webmcp/) lets a page offer tools
// to an agent running in the reader's browser. This entry point is statically
// imported by Root, so it only feature-detects; the tool and the search code
// are loaded on demand.

export interface SearchConfig {
  appId: string
  apiKey: string
  indexName: string
  /** Absolute origin used to resolve relative hit URLs. */
  siteUrl: string
}

export interface ModelContext {
  registerTool(tool: object, options?: { signal?: AbortSignal }): unknown
}

/**
 * The current draft exposes `document.modelContext`. Early Chrome previews and
 * polyfills used `navigator.modelContext`, so fall back to it.
 */
export function getModelContext(): ModelContext | undefined {
  try {
    for (const host of [globalThis.document, globalThis.navigator]) {
      const context = (host as { modelContext?: ModelContext } | undefined)?.modelContext
      if (typeof context?.registerTool === 'function') return context
    }
  } catch {
    // A throwing getter means the API is unusable here.
  }
  return undefined
}

/** Registers the `search_documentation` tool when WebMCP exists. Returns a cleanup function. */
export function mountWebMcp(config: Partial<SearchConfig>): () => void {
  const context = getModelContext()
  const { appId, apiKey, indexName, siteUrl } = config
  if (!context || !appId || !apiKey || !indexName || !siteUrl) return () => {}

  const controller = new AbortController()
  import('./tool')
    .then(({ registerSearchTool }) =>
      registerSearchTool(context, { appId, apiKey, indexName, siteUrl }, controller.signal),
    )
    .catch(() => {})
  return () => controller.abort()
}
