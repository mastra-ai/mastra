import { describe, it, expect } from 'vitest'
import { generateMarkdownList, type SidebarItem } from '../sidebars-handler'

const MODELS = 'https://mastra.ai/models'

describe('generateMarkdownList category links', () => {
  it('links a condensed category to the doc declared on its link', () => {
    const items: SidebarItem[] = [
      {
        type: 'category',
        label: 'Providers',
        link: { type: 'doc', id: 'providers/index' },
        items: [{ type: 'doc', id: 'providers/openai', label: 'OpenAI' }],
      },
    ]

    expect(generateMarkdownList(items, MODELS, 0, ['Providers'])).toBe(
      '- [Providers](https://mastra.ai/models/providers.md)\n',
    )
  })

  it('links a normal category to the doc declared on its link and keeps its children', () => {
    const items: SidebarItem[] = [
      {
        type: 'category',
        label: 'Gateways',
        link: { type: 'doc', id: 'gateways/index' },
        items: [{ type: 'doc', id: 'gateways/mastra', label: 'Mastra' }],
      },
    ]

    expect(generateMarkdownList(items, MODELS)).toBe(
      '- [Gateways](https://mastra.ai/models/gateways.md)\n  - [Mastra](https://mastra.ai/models/gateways/mastra.md)\n',
    )
  })

  it('does not link a normal category that lists its index doc in items, to avoid a duplicate', () => {
    const items: SidebarItem[] = [
      {
        type: 'category',
        label: 'Deployer',
        items: [{ type: 'doc', id: 'deployer/index', label: 'Deployer' }],
      },
    ]

    expect(generateMarkdownList(items, 'https://mastra.ai/reference')).toBe(
      '- Deployer\n  - [Deployer](https://mastra.ai/reference/deployer.md)\n',
    )
  })

  it('falls back to an index doc in items for a condensed category without a link', () => {
    const items: SidebarItem[] = [
      {
        type: 'category',
        label: 'Providers',
        items: [{ type: 'doc', id: 'providers/index', label: 'Overview' }],
      },
    ]

    expect(generateMarkdownList(items, MODELS, 0, ['Providers'])).toBe(
      '- [Providers](https://mastra.ai/models/providers.md)\n',
    )
  })

  it('renders an unlinked label when a category has neither a link nor an index doc', () => {
    const items: SidebarItem[] = [
      {
        type: 'category',
        label: 'Build',
        items: [{ type: 'doc', id: 'agents/tools', label: 'Tools' }],
      },
    ]

    expect(generateMarkdownList(items, 'https://mastra.ai/docs')).toBe(
      '- Build\n  - [Tools](https://mastra.ai/docs/agents/tools.md)\n',
    )
  })
})
