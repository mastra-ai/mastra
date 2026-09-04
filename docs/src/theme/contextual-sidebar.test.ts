import { describe, expect, it } from 'vitest'
import type { PropSidebarItem, PropSidebarItemCategory } from '@docusaurus/plugin-content-docs'
import {
  collectContextualSidebarPathnames,
  createContextualSidebarItems,
  enterContextualSidebar,
  findContextualSidebarCategory,
  findInitialContextualSidebarCategory,
  getContextualSidebarItems,
  getLocalPathname,
  isContextualSidebarVisible,
  isPlainPrimaryClick,
  observeContextualSidebarPathname,
  type SidebarClickEvent,
} from './contextual-sidebar'

const siteUrl = 'https://mastra.ai'

function createCategory(contextualSidebar = true): PropSidebarItemCategory {
  return {
    type: 'category',
    label: 'Agents',
    href: '/docs/agents/overview',
    collapsed: true,
    collapsible: true,
    customProps: contextualSidebar ? { contextualSidebar: true } : undefined,
    items: [
      {
        type: 'link',
        label: 'Tools',
        href: '/docs/agents/using-tools',
      },
      {
        type: 'category',
        label: 'Connections',
        href: '/docs/agents/connections',
        collapsed: true,
        collapsible: true,
        items: [
          {
            type: 'link',
            label: 'A2A',
            href: '/docs/agents/a2a?source=sidebar#example',
          },
          {
            type: 'link',
            label: 'External',
            href: 'https://example.com/docs/agents/external',
          },
        ],
      },
    ],
  }
}

function plainClick(overrides: Partial<SidebarClickEvent> = {}): SidebarClickEvent {
  return {
    altKey: false,
    button: 0,
    ctrlKey: false,
    defaultPrevented: false,
    metaKey: false,
    shiftKey: false,
    ...overrides,
  }
}

describe('contextual sidebar model', () => {
  it('finds only opted-in categories by runtime href', () => {
    const regularCategory = createCategory(false)
    const contextualCategory = createCategory()
    const sidebar: PropSidebarItem[] = [regularCategory, contextualCategory]

    expect(findContextualSidebarCategory([regularCategory], '/docs/agents/overview')).toBeUndefined()
    expect(findContextualSidebarCategory(sidebar, '/docs/agents/overview')).toBe(contextualCategory)
    expect(findContextualSidebarCategory(sidebar, '/docs/agents/missing')).toBeUndefined()
  })

  it('finds an initial contextual category at any exact destination pathname', () => {
    const contextualCategory = createCategory()
    const regularCategory = { ...createCategory(false), href: '/docs/workflows/overview' }
    const sidebar: PropSidebarItem[] = [regularCategory, contextualCategory]

    expect(findInitialContextualSidebarCategory(sidebar, '/docs/agents/overview/', siteUrl)).toBe(contextualCategory)
    expect(findInitialContextualSidebarCategory(sidebar, '/docs/agents/using-tools', siteUrl)).toBe(contextualCategory)
    expect(findInitialContextualSidebarCategory(sidebar, '/docs/agents/a2a', siteUrl)).toBe(contextualCategory)
    expect(findInitialContextualSidebarCategory(sidebar, '/docs/workflows/overview', siteUrl)).toBeUndefined()
    expect(findInitialContextualSidebarCategory(sidebar, '/docs/agents/overview-extra', siteUrl)).toBeUndefined()
  })

  it('creates Overview before the original category children without mutation', () => {
    const category = createCategory()
    const originalItems = [...category.items]

    const items = createContextualSidebarItems({ ...category, href: '/docs/agents/overview' })

    expect(items[0]).toEqual({
      type: 'link',
      label: 'Overview',
      href: '/docs/agents/overview',
    })
    expect(items.slice(1)).toEqual(originalItems)
    expect(category.items).toEqual(originalItems)
    expect(items).not.toBe(category.items)
  })

  it('uses a custom label for the contextual category link', () => {
    const category = createCategory()
    category.customProps = {
      ...category.customProps,
      contextualSidebarLabel: 'Multi-agent systems',
    }

    const items = createContextualSidebarItems({ ...category, href: '/docs/guides/multi-agent-systems' })

    expect(items[0]).toEqual({
      type: 'link',
      label: 'Multi-agent systems',
      href: '/docs/guides/multi-agent-systems',
    })
  })

  it('collects nested local destinations and normalizes exact pathnames', () => {
    const category = createCategory()
    if (!category.href) {
      throw new Error('Expected category href')
    }

    expect(collectContextualSidebarPathnames({ ...category, href: category.href }, siteUrl)).toEqual([
      '/docs/agents/overview',
      '/docs/agents/using-tools',
      '/docs/agents/connections',
      '/docs/agents/a2a',
    ])
  })

  it('normalizes root-relative and same-origin absolute hrefs by pathname', () => {
    expect(getLocalPathname('/docs/agents/overview/?source=nav#top', siteUrl)).toBe('/docs/agents/overview')
    expect(getLocalPathname('https://mastra.ai/ja/docs/agents/overview/?source=nav#top', siteUrl)).toBe(
      '/ja/docs/agents/overview',
    )
    expect(getLocalPathname('/', siteUrl)).toBe('/')
  })

  it('excludes path-relative, external, and protocol-relative hrefs', () => {
    expect(getLocalPathname('agents/overview', siteUrl)).toBeUndefined()
    expect(getLocalPathname('https://example.com/docs/agents/overview', siteUrl)).toBeUndefined()
    expect(getLocalPathname('//mastra.ai/docs/agents/overview', siteUrl)).toBeUndefined()
  })

  it('keeps entry pending until navigation reaches a category destination', () => {
    const category = createCategory()
    const state = enterContextualSidebar(category, '/docs', siteUrl)

    expect(state).toBeDefined()
    expect(isContextualSidebarVisible(state, '/docs')).toBe(true)
    expect(isContextualSidebarVisible(state, '/docs/agents/overview/')).toBe(true)
    expect(observeContextualSidebarPathname(state, '/docs')).toBe(state)

    const promoted = observeContextualSidebarPathname(state, '/docs/agents/overview/')
    expect(promoted).toEqual({ ...state, phase: 'active' })
    expect(isContextualSidebarVisible(promoted, '/docs/agents/overview/')).toBe(true)
    expect(isContextualSidebarVisible(promoted, '/docs/agents/overview-extra')).toBe(false)
    expect(observeContextualSidebarPathname(promoted, '/docs/agents/using-tools')).toBe(promoted)
    expect(observeContextualSidebarPathname(promoted, '/docs/workflows/overview')).toBeUndefined()
  })

  it('clears a pending entry on the first unrelated pathname change', () => {
    const state = enterContextualSidebar(createCategory(), '/docs', siteUrl)

    expect(observeContextualSidebarPathname(state, '/docs')).toBe(state)
    expect(observeContextualSidebarPathname(state, '/docs/workflows/overview')).toBeUndefined()
    expect(isContextualSidebarVisible(state, '/docs')).toBe(true)
    expect(isContextualSidebarVisible(state, '/docs/workflows/overview')).toBe(false)
  })

  it('clears active context when browser history returns to the entry pathname', () => {
    const pending = enterContextualSidebar(createCategory(), '/docs', siteUrl)
    const active = observeContextualSidebarPathname(pending, '/docs/agents/overview')

    expect(active?.phase).toBe('active')
    expect(observeContextualSidebarPathname(active, '/docs')).toBeUndefined()
  })

  it('activates immediately when entry starts on a category destination', () => {
    const state = enterContextualSidebar(createCategory(), '/docs/agents/using-tools/', siteUrl)

    expect(isContextualSidebarVisible(state, '/docs/agents/using-tools')).toBe(true)
  })

  it('does not create context from pathname observation alone', () => {
    expect(observeContextualSidebarPathname(undefined, '/docs/agents/overview')).toBeUndefined()
    expect(isContextualSidebarVisible(undefined, '/docs/agents/overview')).toBe(false)
  })

  it('derives contextual items from the opted-in runtime category', () => {
    const category = createCategory()
    const sidebar: PropSidebarItem[] = [category]
    const state = enterContextualSidebar(category, '/docs/agents/overview', siteUrl)

    expect(getContextualSidebarItems(sidebar, state)?.map(item => ('label' in item ? item.label : item.type))).toEqual([
      'Overview',
      'Tools',
      'Connections',
    ])
    expect(getContextualSidebarItems([], state)).toBeUndefined()
  })

  it('does not mutate the original sidebar data while deriving state and items', () => {
    const category = createCategory()
    const sidebar: PropSidebarItem[] = [category]
    const before = JSON.stringify(sidebar)
    const state = enterContextualSidebar(category, '/docs', siteUrl)

    getContextualSidebarItems(sidebar, state)

    expect(JSON.stringify(sidebar)).toBe(before)
  })

  it('accepts only an unmodified, non-prevented primary click', () => {
    expect(isPlainPrimaryClick(plainClick())).toBe(true)

    for (const event of [
      plainClick({ defaultPrevented: true }),
      plainClick({ button: 1 }),
      plainClick({ metaKey: true }),
      plainClick({ ctrlKey: true }),
      plainClick({ shiftKey: true }),
      plainClick({ altKey: true }),
    ]) {
      expect(isPlainPrimaryClick(event)).toBe(false)
    }
  })
})
