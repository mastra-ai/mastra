import { describe, expect, it } from 'vitest'
import { extractSidebarDocIds, type SidebarItem } from './sidebar-doc-ids'

describe('extractSidebarDocIds', () => {
  it('collects normal doc items and string shorthand', () => {
    const items: SidebarItem[] = [
      'getting-started',
      {
        type: 'doc',
        id: 'agents/overview',
      },
    ]

    expect([...extractSidebarDocIds(items)]).toEqual(['getting-started', 'agents/overview'])
  })

  it('collects nested category descendants and linked category docs', () => {
    const items: SidebarItem[] = [
      {
        type: 'category',
        link: {
          type: 'doc',
          id: 'agents/overview',
        },
        items: [
          {
            type: 'doc',
            id: 'agents/using-tools',
          },
          {
            type: 'category',
            items: ['agents/a2a'],
          },
        ],
      },
    ]

    expect([...extractSidebarDocIds(items)]).toEqual(['agents/overview', 'agents/using-tools', 'agents/a2a'])
  })

  it('does not count non-doc category links', () => {
    const items: SidebarItem[] = [
      {
        type: 'category',
        link: {
          type: 'generated-index',
        },
        items: [],
      },
    ]

    expect([...extractSidebarDocIds(items)]).toEqual([])
  })
})
