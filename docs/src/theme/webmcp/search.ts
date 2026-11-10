import { liteClient } from 'algoliasearch/lite'
import type { SearchConfig } from './index'
import { LIMITS, type RunSearch, type SearchResult } from './tool'

const LEVELS = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5', 'lvl6'] as const

export interface DocsRecord {
  url?: string | null
  content?: string | null
  hierarchy?: Partial<Record<(typeof LEVELS)[number], string | null>>
}

/** Absolute URL on the docs site, anchor kept; relative URLs resolve against the site. */
function absoluteUrl(value: string, siteUrl: string): string | undefined {
  try {
    const url = new URL(value, siteUrl)
    return url.origin === new URL(siteUrl).origin ? url.href : undefined
  } catch {
    return undefined
  }
}

export function mapHit(hit: DocsRecord, siteUrl: string): SearchResult | undefined {
  const url = hit.url && absoluteUrl(hit.url, siteUrl)
  if (!url) return undefined
  const levels = LEVELS.map(level => hit.hierarchy?.[level]?.trim()).filter((value): value is string => !!value)
  const title = hit.hierarchy?.lvl1?.trim() || levels[0] || ''
  const excerpt = (hit.content ?? '').replace(/\s+/g, ' ').trim()
  return {
    title,
    heading: levels.at(-1) ?? title,
    url,
    excerpt: [...excerpt].slice(0, LIMITS.excerpt).join(''),
  }
}

export function createSearch({ appId, apiKey, indexName, siteUrl }: SearchConfig): RunSearch {
  const client = liteClient(appId, apiKey)
  return async ({ query, limit }) => {
    const { results } = await client.searchForHits<DocsRecord>({
      requests: [
        {
          indexName,
          query,
          hitsPerPage: limit,
          // Agents tend to send whole questions. Making every word optional ranks
          // records by how many words they match instead of requiring all of them.
          optionalWords: query,
          attributesToRetrieve: ['url', 'hierarchy', 'content'],
          attributesToHighlight: [],
          attributesToSnippet: [],
        },
      ],
    })
    const mapped: SearchResult[] = []
    const seen = new Set<string>()
    for (const hit of results[0]?.hits ?? []) {
      const result = mapHit(hit, siteUrl)
      if (!result || seen.has(result.url)) continue
      seen.add(result.url)
      mapped.push(result)
    }
    return mapped
  }
}
