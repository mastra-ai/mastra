import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { generateMarkdownList, parseSidebarFile, type SidebarItem, type SidebarsConfig } from '../sidebars-handler'

describe('parseSidebarFile', () => {
  it.each<{ name: string; sidebars: SidebarsConfig; expected: SidebarItem[] }>([
    { name: 'empty', sidebars: {}, expected: [] },
    { name: 'single', sidebars: { docsSidebar: ['index'] }, expected: ['index'] },
    {
      name: 'multiple',
      sidebars: {
        docsSidebar: ['index'],
        platformSidebar: [
          {
            type: 'category',
            label: 'Platform',
            items: ['mastra-platform/overview', 'mastra-platform/connect/overview'],
          },
        ],
      },
      expected: [
        'index',
        {
          type: 'category',
          label: 'Platform',
          items: ['mastra-platform/overview', 'mastra-platform/connect/overview'],
        },
      ],
    },
  ])('loads $name sidebars in order without flattening categories', async ({ sidebars, expected }) => {
    const dir = await mkdtemp(path.join(tmpdir(), 'llms-sidebars-'))
    try {
      const file = path.join(dir, 'sidebars.mjs')
      await writeFile(file, `export default ${JSON.stringify(sidebars)}`)
      expect(await parseSidebarFile(file)).toEqual(expected)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

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
