import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CheckContext } from '../types'

const writeSortedReferenceSidebar = vi.fn()

vi.mock('../../validate-reference-sidebar-sort', () => ({
  REFERENCE_SIDEBAR_PATH: '/repo/src/content/en/reference/sidebars.js',
  loadReferenceSidebar: async () => [],
  analyzeReferenceSidebar: () => ({
    sortErrors: [{ path: 'Root', message: 'Items are not sorted' }],
    duplicateErrors: [],
    typeWarnings: [],
    propertyWarnings: [],
  }),
  writeSortedReferenceSidebar: (...args: unknown[]) => writeSortedReferenceSidebar(...args),
}))
vi.mock('../../validate-sidebar-docs', () => ({ SECTIONS: [], validateSection: async () => ({ ghostPages: [] }) }))
vi.mock('../../validate-sidebar-new-tags', () => ({
  DEFAULT_SIDEBAR_NEW_TAG_DAYS: 30,
  findStaleNewTags: async () => ({ stale: [] }),
}))

const { sidebarCheck } = await import('../checks/sidebar')

function context(isRuleActive: (ruleId: string) => boolean): CheckContext {
  return {
    rootDir: '/repo',
    files: [],
    scoped: false,
    fix: true,
    categories: ['sidebar'],
    isRuleActive,
    allFiles: async () => [],
  }
}

describe('sidebar sort fix', () => {
  beforeEach(() => writeSortedReferenceSidebar.mockReset())

  it('rewrites the sidebar when the sort rule is active', async () => {
    const result = await sidebarCheck.run(context(() => true))
    expect(writeSortedReferenceSidebar).toHaveBeenCalledTimes(1)
    expect(result.fixed).toBe(1)
  })

  it('leaves the sidebar alone when --rule selects a different rule', async () => {
    const result = await sidebarCheck.run(context(ruleId => ruleId === 'mastra/sidebar-unlinked-page'))
    expect(writeSortedReferenceSidebar).not.toHaveBeenCalled()
    expect(result.fixed).toBe(0)
  })
})
