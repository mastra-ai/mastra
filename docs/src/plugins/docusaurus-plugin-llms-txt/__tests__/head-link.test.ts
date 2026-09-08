import { describe, it, expect } from 'vitest'
import { injectMarkdownAlternateLink, markdownUrlForRoute } from '../head-link'

const SITE_URL = 'https://mastra.ai'

/** Build a minimal document matching the shape of a built page */
function makeHtml(head = ''): string {
  return `<!doctype html><html><head><title>Docs</title>${head}</head><body><article>Hi</article></body></html>`
}

describe('markdownUrlForRoute', () => {
  it('appends .md to a nested route', () => {
    expect(markdownUrlForRoute('/docs/agents/overview', SITE_URL)).toBe('https://mastra.ai/docs/agents/overview.md')
  })

  it('appends .md to a top level route', () => {
    expect(markdownUrlForRoute('/docs', SITE_URL)).toBe('https://mastra.ai/docs.md')
  })

  it('points the root route at the site index, because / has no .md form', () => {
    expect(markdownUrlForRoute('/', SITE_URL)).toBe('https://mastra.ai/llms.txt')
  })

  it('drops a trailing slash before the extension', () => {
    expect(markdownUrlForRoute('/docs/agents/', SITE_URL)).toBe('https://mastra.ai/docs/agents.md')
  })

  it('drops a trailing slash on the site URL', () => {
    expect(markdownUrlForRoute('/docs', 'https://mastra.ai/')).toBe('https://mastra.ai/docs.md')
  })
})

describe('injectMarkdownAlternateLink', () => {
  it('inserts the alternate link into the head', () => {
    const result = injectMarkdownAlternateLink(makeHtml(), 'https://mastra.ai/docs.md')

    expect(result).toContain('<link rel="alternate" type="text/markdown" href="https://mastra.ai/docs.md">')
  })

  it('inserts the link before the head closes', () => {
    const result = injectMarkdownAlternateLink(makeHtml(), 'https://mastra.ai/docs.md')

    expect(result.indexOf('type="text/markdown"')).toBeLessThan(result.indexOf('</head>'))
  })

  it('leaves the body untouched', () => {
    const result = injectMarkdownAlternateLink(makeHtml(), 'https://mastra.ai/docs.md')

    expect(result).toContain('<body><article>Hi</article></body>')
  })

  it('does not add the tag twice', () => {
    const once = injectMarkdownAlternateLink(makeHtml(), 'https://mastra.ai/docs.md')
    const twice = injectMarkdownAlternateLink(once, 'https://mastra.ai/docs.md')

    expect(twice).toBe(once)
  })

  it('returns the input when there is no head', () => {
    const html = '<p>fragment</p>'

    expect(injectMarkdownAlternateLink(html, 'https://mastra.ai/docs.md')).toBe(html)
  })

  it('escapes characters that would end the href early', () => {
    const result = injectMarkdownAlternateLink(makeHtml(), 'https://mastra.ai/a"b&c.md')

    expect(result).toContain('href="https://mastra.ai/a&quot;b&amp;c.md"')
  })
})
