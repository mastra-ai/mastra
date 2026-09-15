import { describe, expect, it } from 'vitest'
import { normalizeSiteSectionRoot, SITE_SECTION_ROOTS } from './canonical-url'

describe('normalizeSiteSectionRoot', () => {
  it.each(Object.values(SITE_SECTION_ROOTS))('removes the trailing slash from %s', root => {
    expect(normalizeSiteSectionRoot(`${root}/`)).toBe(root)
    expect(normalizeSiteSectionRoot(`https://mastra.ai${root}/`)).toBe(`https://mastra.ai${root}`)
  })

  it('leaves nested routes and unrelated roots unchanged', () => {
    expect(normalizeSiteSectionRoot('/docs/agents/')).toBe('/docs/agents/')
    expect(normalizeSiteSectionRoot('/learn/')).toBe('/learn/')
  })
})
