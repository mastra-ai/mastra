/**
 * Plugin options and configuration
 */

export interface LlmsTxtPluginOptions {
  /** Base URL for absolute links (e.g., "https://mastra.ai") */
  siteUrl: string
  /** Site title for the root llms.txt header */
  siteTitle?: string
  /** Site description for the root llms.txt */
  siteDescription?: string
  /** CSS selectors to extract content from (in priority order) */
  contentSelectors?: string[]
  /** Route patterns to exclude (simple string matching) */
  excludeRoutes?: string[]
  /** Whether to enable caching based on content hash */
  enableCache?: boolean
}

export interface ResolvedOptions extends Required<LlmsTxtPluginOptions> {}

export const DEFAULT_OPTIONS: Omit<ResolvedOptions, 'siteUrl'> = {
  siteTitle: 'Mastra',
  siteDescription: `Mastra is a framework for building AI-powered applications and agents with a modern TypeScript stack. It includes everything you need to go from early prototypes to production-ready applications.`,
  contentSelectors: ['article', '.theme-doc-markdown', 'main'],
  excludeRoutes: ['/404'],
  enableCache: true,
}

export function resolveOptions(options: LlmsTxtPluginOptions): ResolvedOptions {
  return {
    siteUrl: options.siteUrl,
    siteTitle: options.siteTitle ?? DEFAULT_OPTIONS.siteTitle,
    siteDescription: options.siteDescription ?? DEFAULT_OPTIONS.siteDescription,
    contentSelectors: options.contentSelectors ?? DEFAULT_OPTIONS.contentSelectors,
    excludeRoutes: options.excludeRoutes ?? DEFAULT_OPTIONS.excludeRoutes,
    enableCache: options.enableCache ?? DEFAULT_OPTIONS.enableCache,
  }
}

export function validateOptions(options: LlmsTxtPluginOptions): void {
  if (!options.siteUrl) {
    throw new Error('[llms-txt] siteUrl is required')
  }

  if (!options.siteUrl.startsWith('http://') && !options.siteUrl.startsWith('https://')) {
    throw new Error('[llms-txt] siteUrl must start with http:// or https://')
  }

  // Remove trailing slash from siteUrl
  if (options.siteUrl.endsWith('/')) {
    options.siteUrl = options.siteUrl.slice(0, -1)
  }
}
