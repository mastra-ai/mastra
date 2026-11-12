import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { LoadedPlugin } from '@docusaurus/types'
import { describe, it, expect } from 'vitest'
import {
  buildFullBundles,
  collectSidebarDocIds,
  generateFullLlmsTxt,
  getDocRoutes,
  type BundlePage,
  type BundleSection,
} from '../full-bundle'

const SITE_URL = 'https://mastra.ai'

function page(route: string, heading: string, body = `Body of ${route}.`): BundlePage {
  return { route, title: `${heading} | Section`, content: `# ${heading}\n\n${body}` }
}

/** Return the page headings in the order they appear in a bundle. */
function headings(bundle: string): string[] {
  return [...bundle.matchAll(/^# (.+)$/gm)].map(match => match[1]).slice(1)
}

const docsSection: BundleSection = {
  slug: 'docs',
  label: 'Docs',
  pluginId: 'default',
  items: [
    'index',
    {
      type: 'category',
      label: 'Agents',
      link: { type: 'doc', id: 'agents/overview' },
      items: [{ type: 'doc', id: 'agents/tools', label: 'Tools' }, 'agents/memory'],
    },
    { type: 'doc', id: 'workflows/index', label: 'Workflows' },
  ],
}

const referenceSection: BundleSection = {
  slug: 'reference',
  label: 'Reference',
  pluginId: 'reference',
  items: ['index', 'classifier/classifier'],
}

describe('collectSidebarDocIds', () => {
  it('lists docs in reading order with category links before their items', () => {
    expect(collectSidebarDocIds(docsSection.items)).toEqual([
      'index',
      'agents/overview',
      'agents/tools',
      'agents/memory',
      'workflows/index',
    ])
  })

  it('skips external links and generated-index categories', () => {
    expect(
      collectSidebarDocIds([
        { type: 'link', href: 'https://example.com', label: 'Example' } as never,
        { type: 'category', label: 'Generated', link: { type: 'generated-index' }, items: ['a'] },
      ]),
    ).toEqual(['a'])
  })
})

describe('buildFullBundles', () => {
  // Pages arrive in glob order, not sidebar order.
  const pages = [
    page('/reference/classifier', 'Classifier'),
    page('/docs/workflows', 'Workflows'),
    page('/docs/agents/memory', 'Memory'),
    page('/docs/agents/tools', 'Tools'),
    page('/docs', 'Get started'),
    page('/reference', 'Reference overview'),
    page('/docs/agents/overview', 'Agents'),
  ]

  it('orders pages by sidebar within each section and sections by sidebar order', () => {
    const bundles = buildFullBundles({
      sections: [docsSection, referenceSection],
      pages,
      siteUrl: SITE_URL,
      // Docusaurus routes "classifier/classifier" to "/classifier" because the file matches its folder name.
      docRoutes: new Map([['reference:classifier/classifier', '/reference/classifier']]),
    })

    expect(bundles.rootIsIndex).toBe(false)
    expect(headings(bundles.root)).toEqual([
      'Get started',
      'Agents',
      'Tools',
      'Memory',
      'Workflows',
      'Reference overview',
      'Classifier',
    ])
    expect(headings(bundles.sections[0].content)).toEqual(['Get started', 'Agents', 'Tools', 'Memory', 'Workflows'])
    expect(headings(bundles.sections[1].content)).toEqual(['Reference overview', 'Classifier'])
    expect(bundles.sections.map(({ slug, pageCount }) => ({ slug, pageCount }))).toEqual([
      { slug: 'docs', pageCount: 5 },
      { slug: 'reference', pageCount: 2 },
    ])
  })

  it('formats each page as title, source line, then body without repeating the heading', () => {
    const bundles = buildFullBundles({ sections: [docsSection], pages, siteUrl: SITE_URL })

    expect(bundles.root).toContain(
      '# Agents\n\nSource: https://mastra.ai/docs/agents/overview · Markdown: https://mastra.ai/docs/agents/overview.md\n\nBody of /docs/agents/overview.',
    )
    expect(bundles.root.match(/^# Agents$/gm)).toHaveLength(1)
    expect(bundles.root.startsWith('# Mastra\n')).toBe(true)
    expect(bundles.root).toContain('Index: https://mastra.ai/llms.txt')
    expect(bundles.sections[0].content.startsWith('# Mastra Docs\n')).toBe(true)
  })

  it('falls back to the page title when the body has no heading', () => {
    const bundles = buildFullBundles({
      sections: [docsSection],
      pages: [{ route: '/docs', title: 'Get started', content: 'No heading here.' }],
      siteUrl: SITE_URL,
    })

    expect(bundles.root).toContain(
      '# Get started\n\nSource: https://mastra.ai/docs · Markdown: https://mastra.ai/docs.md\n\nNo heading here.',
    )
  })

  it('appends section pages missing from the sidebar after the sidebar pages', () => {
    const bundles = buildFullBundles({
      sections: [docsSection],
      pages: [...pages, page('/docs/unlisted-b', 'Unlisted B'), page('/docs/unlisted-a', 'Unlisted A')],
      siteUrl: SITE_URL,
    })

    expect(headings(bundles.root).slice(-2)).toEqual(['Unlisted A', 'Unlisted B'])
  })

  it('leaves out excluded routes, empty pages, and pages outside the sections', () => {
    const bundles = buildFullBundles({
      sections: [docsSection],
      pages: [
        ...pages,
        page('/404', 'Page not found'),
        page('/learn/what-is-an-agent', 'Lesson'),
        page('/docs/private/secret', 'Secret'),
        page('/docsearch', 'Not in docs'),
        { route: '/docs/empty', title: 'Empty', content: '  ' },
      ],
      siteUrl: SITE_URL,
      excludeRoutes: ['/404', '/docs/private', '/docs/agents/memory'],
    })

    const titles = headings(bundles.root)
    expect(titles).toEqual(['Get started', 'Agents', 'Tools', 'Workflows'])
    expect(bundles.root).not.toContain('/404')
    expect(bundles.root).not.toContain('/learn/')
  })

  it('replaces the root bundle with an index of section bundles when it exceeds the size limit', () => {
    const bundles = buildFullBundles({
      sections: [docsSection, referenceSection],
      pages,
      siteUrl: SITE_URL,
      maxRootBytes: 200,
    })

    expect(bundles.rootIsIndex).toBe(true)
    expect(bundles.root).not.toContain('Source:')
    expect(bundles.root).toMatch(/- \[Docs\]\(https:\/\/mastra\.ai\/docs\/llms-full\.txt\): 5 pages, [\d.]+ (B|KiB)/)
    expect(bundles.root).toContain('- [Reference](https://mastra.ai/reference/llms-full.txt)')
    // Section bundles still carry every page.
    expect(headings(bundles.sections[0].content)).toHaveLength(5)
  })
})

describe('getDocRoutes', () => {
  it('maps doc ids to permalinks from the current version of each docs plugin', () => {
    const plugins = [
      {
        name: 'docusaurus-plugin-content-docs',
        options: { id: 'reference' },
        content: {
          loadedVersions: [
            { isLast: true, docs: [{ id: 'classifier/classifier', permalink: '/reference/classifier' }] },
          ],
        },
      },
      {
        name: 'docusaurus-plugin-content-docs',
        options: {},
        content: { loadedVersions: [{ isLast: true, docs: [{ id: 'index', permalink: '/docs' }] }] },
      },
      { name: 'docusaurus-plugin-llms-txt', options: {}, content: undefined },
    ] as unknown as LoadedPlugin[]

    expect(getDocRoutes(plugins)).toEqual(
      new Map([
        ['reference:classifier/classifier', '/reference/classifier'],
        ['default:index', '/docs'],
      ]),
    )
  })
})

describe('generateFullLlmsTxt', () => {
  it('writes the root bundle and one bundle per section from the real sidebars', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'llms-full-'))
    const siteDir = path.resolve(__dirname, '../../../..')

    try {
      await generateFullLlmsTxt(outDir, siteDir, [page('/docs', 'Get started')], SITE_URL, ['/404'])

      expect(await readFile(path.join(outDir, 'llms-full.txt'), 'utf-8')).toContain('# Get started')
      for (const section of ['docs', 'models', 'integrations', 'reference']) {
        expect(existsSync(path.join(outDir, section, 'llms-full.txt'))).toBe(true)
        // Per-section llms.txt is the section index page and must not be written here.
        expect(existsSync(path.join(outDir, section, 'llms.txt'))).toBe(false)
      }
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  })
})
