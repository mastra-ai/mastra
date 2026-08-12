import { describe, expect, it } from 'vitest'

import { getIntegrationItems } from './data'

describe('getIntegrationItems', () => {
  it('returns all items from a sidebar section', () => {
    expect(getIntegrationItems('Channels').map(item => item.id)).toEqual([
      'channels/discord',
      'channels/github',
      'channels/imessage',
      'channels/teams',
      'channels/slack',
      'channels/telegram',
      'channels/whatsapp',
    ])
  })

  it('returns allowlisted items in the requested display order', () => {
    expect(
      getIntegrationItems('Frameworks', ['frameworks/next-js', 'frameworks/vite-react', 'frameworks/astro']).map(
        item => ({ id: item.id, label: item.label, icon: item.customProps?.icon }),
      ),
    ).toEqual([
      {
        id: 'frameworks/next-js',
        label: 'Next.js',
        icon: 'https://cdn.simpleicons.org/nextdotjs/black/white?viewbox=auto&size=28',
      },
      {
        id: 'frameworks/vite-react',
        label: 'React + Vite',
        icon: 'https://cdn.simpleicons.org/vite?viewbox=auto&size=28',
      },
      {
        id: 'frameworks/astro',
        label: 'Astro',
        icon: 'https://cdn.simpleicons.org/astro?viewbox=auto&size=28',
      },
    ])
  })

  it('ignores unknown sections and allowlist entries', () => {
    expect(getIntegrationItems('Unknown')).toEqual([])
    expect(getIntegrationItems('Channels', ['channels/slack', 'channels/unknown']).map(item => item.id)).toEqual([
      'channels/slack',
    ])
  })
})
