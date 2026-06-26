// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { sanitizeSearchHtml } from './sanitize-search-html'

describe('sanitizeSearchHtml', () => {
  it('returns an empty string for falsy input', () => {
    expect(sanitizeSearchHtml('')).toBe('')
    expect(sanitizeSearchHtml(undefined as unknown as string)).toBe('')
    expect(sanitizeSearchHtml(null as unknown as string)).toBe('')
  })

  it('preserves <mark> highlight tags', () => {
    expect(sanitizeSearchHtml('Use a <mark>memory</mark> store')).toBe('Use a <mark>memory</mark> store')
  })

  it('passes plain text through unchanged', () => {
    expect(sanitizeSearchHtml('Agents and workflows')).toBe('Agents and workflows')
  })

  it('keeps HTML entities intact', () => {
    expect(sanitizeSearchHtml('tools &amp; memory')).toBe('tools &amp; memory')
  })

  it('removes <script> tags', () => {
    const result = sanitizeSearchHtml('<script>alert(1)</script>')
    expect(result).not.toContain('<script')
    expect(result).not.toContain('alert(1)')
  })

  it('removes <img> tags with event handlers', () => {
    const result = sanitizeSearchHtml('<img src=x onerror=alert(1)>')
    expect(result).not.toContain('<img')
    expect(result).not.toContain('onerror')
  })

  it('strips disallowed attributes but keeps the <mark> tag', () => {
    const result = sanitizeSearchHtml('<mark onclick="alert(1)">hit</mark>')
    expect(result).toBe('<mark>hit</mark>')
  })

  it('removes disallowed tags while keeping their text content', () => {
    expect(sanitizeSearchHtml('<a href="https://evil.test">link</a>')).toBe('link')
    expect(sanitizeSearchHtml('<b>bold</b>')).toBe('bold')
  })

  it('does not leak an <iframe> into the output', () => {
    const result = sanitizeSearchHtml('<iframe src="https://evil.test"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  it('keeps <mark> while stripping a malicious sibling tag', () => {
    const result = sanitizeSearchHtml('<mark>safe</mark><script>alert(1)</script>')
    expect(result).toContain('<mark>safe</mark>')
    expect(result).not.toContain('<script')
  })

  // Realistic Algolia _highlightResult / _snippetResult payloads must round-trip
  // unchanged so the sanitizer never mangles legitimate highlighted content.
  describe('preserves real Algolia highlight payloads unchanged', () => {
    const algoliaSamples = [
      'Working <mark>memory</mark>',
      'Memory: <mark>working</mark> memory',
      'Agent <mark>tool</mark>s and <mark>workflow</mark>s',
      '…use the <mark>memory</mark> store to persist…',
      'Compare a &lt; b and tools &amp; memory',
      'Escaped tag &lt;script&gt; stays as text',
      '<mark>résumé</mark> and naïve café',
    ]

    it.each(algoliaSamples)('round-trips %j', sample => {
      expect(sanitizeSearchHtml(sample)).toBe(sample)
    })
  })
})
