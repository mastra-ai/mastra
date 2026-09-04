import { describe, expect, it } from 'vitest'

import { getIntegrationItemHref, getIntegrationItemKey, getIntegrationItems, integrationCategories } from './data'

describe('getIntegrationItems', () => {
  it('returns all items from a sidebar section', () => {
    const channels = integrationCategories.find(category => category.label === 'Channels')

    expect(channels).toBeDefined()
    expect(getIntegrationItems('Channels')).toEqual(channels?.items)
  })

  it('returns allowlisted items in the requested display order', () => {
    expect(
      getIntegrationItems('Frameworks', ['frameworks/next-js', 'frameworks/vite-react', 'frameworks/astro']).map(item =>
        getIntegrationItemKey(item),
      ),
    ).toEqual(['frameworks/next-js', 'frameworks/vite-react', 'frameworks/astro'])
  })

  it('includes sidebar links with their configured destination', () => {
    const mastra = getIntegrationItems('Deploy').find(item => item.label === 'Mastra')

    expect(mastra).toBeDefined()
    if (!mastra) return

    expect(getIntegrationItemKey(mastra)).toBe('/docs/mastra-platform/deploy')
    expect(getIntegrationItemHref(mastra)).toBe('/docs/mastra-platform/deploy')
  })

  it('inserts additional items into the section label order', () => {
    const additionalItem = {
      type: 'link' as const,
      href: '/reference/workspace/local-sandbox',
      label: 'LocalSandbox',
    }
    const items = getIntegrationItems('Sandboxes', undefined, undefined, [additionalItem])
    const labels = items.map(item => item.label)
    const additionalItemIndex = labels.indexOf(additionalItem.label)

    expect(items).toContainEqual(additionalItem)
    expect(additionalItemIndex).toBeGreaterThan(0)
    expect(additionalItemIndex).toBeLessThan(labels.length - 1)
    expect(labels[additionalItemIndex - 1]?.localeCompare(additionalItem.label)).toBeLessThan(0)
    expect(additionalItem.label.localeCompare(labels[additionalItemIndex + 1] ?? '')).toBeLessThan(0)
  })

  it('excludes blocklisted items without changing the remaining section items', () => {
    const blocklist = ['channels/github', 'channels/imessage']
    const expectedItems = getIntegrationItems('Channels').filter(
      item => !blocklist.includes(getIntegrationItemKey(item)),
    )

    expect(getIntegrationItems('Channels', undefined, blocklist)).toEqual(expectedItems)
  })

  it('applies the blocklist after the allowlist', () => {
    expect(
      getIntegrationItems(
        'Channels',
        ['channels/slack', 'channels/github', 'channels/discord'],
        ['channels/github'],
      ).map(item => getIntegrationItemKey(item)),
    ).toEqual(['channels/slack', 'channels/discord'])
  })

  it('ignores unknown sections and list entries', () => {
    expect(getIntegrationItems('Unknown')).toEqual([])
    expect(
      getIntegrationItems('Channels', ['channels/slack', 'channels/unknown']).map(item => getIntegrationItemKey(item)),
    ).toEqual(['channels/slack'])
  })
})
