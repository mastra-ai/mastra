import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkExternalDocs } from '../checks/external-docs'

const SOURCE = 'docs/src/site'
const MANIFEST = {
  targets: [{ name: 'site', source: SOURCE, repo: 'mastra-ai/site', branch: 'main', dest: 'src/docs' }],
}

const dirs: string[] = []
afterEach(async () => {
  await Promise.all(dirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })))
})

function page(body: string, frontmatter = 'title: Page') {
  return `---\n${frontmatter}\n---\n\n${body}\n`
}

function sidebar(ids: string[]) {
  return `export default { docsSidebar: ${JSON.stringify(ids.map(id => ({ type: 'doc', id })))} }\n`
}

/** Writes `files` (relative to the synced source dir) and runs the check against them. `null` writes no manifest. */
async function run(files: Record<string, string>, manifest: unknown = MANIFEST) {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'external-docs-'))
  dirs.push(repoRoot)
  for (const [file, content] of Object.entries(files)) {
    const full = path.join(repoRoot, SOURCE, file)
    await fs.mkdir(path.dirname(full), { recursive: true })
    await fs.writeFile(full, content)
  }
  const manifestPath = path.join(repoRoot, '.github/docs-sync.json')
  if (manifest !== null) {
    await fs.mkdir(path.dirname(manifestPath), { recursive: true })
    await fs.writeFile(manifestPath, typeof manifest === 'string' ? manifest : JSON.stringify(manifest))
  }
  return checkExternalDocs({ repoRoot, docsRoot: path.join(repoRoot, 'docs'), manifestPath })
}

const summary = (findings: Awaited<ReturnType<typeof run>>) =>
  findings.map(f => `${f.ruleId} ${f.file}${f.line ? `:${f.line}` : ''}`)

/** A valid two-page site; `index.mdx` links to `extra`, which tests replace to exercise one rule at a time. */
async function runWithLink(link: string, guide = page('# Guide\n\n## Setup\n\nText.')) {
  return run({
    'index.mdx': page(`# Home\n\nSee [the guide](${link}).`),
    'guide.mdx': guide,
    'sidebars.js': sidebar(['index', 'guide']),
  })
}

describe('external-docs check', () => {
  it('passes a site whose links, anchors, and sidebar all resolve', async () => {
    const findings = await run({
      'index.mdx': page(
        [
          '# Home',
          '',
          '## Next steps',
          '',
          '- [Guide](/guide#setup)',
          '- [Nested](/topics/deep)',
          '- [Self](#next-steps)',
          '- [Home](/)',
          '- [Relative](./guide.mdx#setup)',
          '- [External](https://example.com/missing#nope)',
          '- [Mail](mailto:team@example.com)',
          '- [Asset](/img/diagram.png)',
          '- [Custom slug](/custom)',
          '',
          '[ref]: /guide',
        ].join('\n'),
      ),
      'guide.mdx': page('# Guide\n\n## Setup\n\nText.'),
      'topics/deep.mdx': page('# Deep'),
      'slugged.mdx': page('# Slugged', 'title: Slugged\nslug: /custom'),
      '_partial.mdx': page('# Partial, not a page'),
      'sidebars.js': sidebar(['index', 'guide', 'topics/deep', 'slugged']),
    })
    expect(summary(findings)).toEqual([])
  })

  it('reports a page missing from sidebars.js', async () => {
    const findings = await run({
      'index.mdx': page('# Home'),
      'orphan.mdx': page('# Orphan'),
      'sidebars.js': sidebar(['index']),
    })
    expect(summary(findings)).toEqual(['mastra/external-sidebar-unlinked-page src/site/orphan.mdx'])
  })

  it('reports a sidebar doc ID with no page', async () => {
    const findings = await run({ 'index.mdx': page('# Home'), 'sidebars.js': sidebar(['index', 'gone']) })
    expect(summary(findings)).toEqual(['mastra/external-sidebar-missing-doc src/site/sidebars.js'])
    expect(findings[0].message).toContain('`gone`')
  })

  it('uses the frontmatter id as the doc ID', async () => {
    const findings = await run({
      'index.mdx': page('# Home'),
      'file-name.mdx': page('# Renamed', 'title: Renamed\nid: renamed'),
      'sidebars.js': sidebar(['index', 'renamed']),
    })
    expect(summary(findings)).toEqual([])
  })

  it('routes a page with a frontmatter id and no slug by its id, like Docusaurus', async () => {
    const site = (link: string) =>
      run({
        'index.mdx': page(`# Home\n\nSee [the guide](${link}).`),
        'guide.mdx': page('# Guide\n\n## Setup\n\nText.', 'title: Guide\nid: renamed'),
        'topics/index.mdx': page('# Topics', 'title: Topics\nid: overview'),
        'sidebars.js': sidebar(['index', 'renamed', 'topics/overview']),
      })
    expect(summary(await site('/renamed#setup'))).toEqual([])
    expect(summary(await site('/topics'))).toEqual([])
    expect(summary(await site('/guide#setup'))).toEqual(['mastra/external-internal-link src/site/index.mdx:7'])
    expect(summary(await site('/topics/overview'))).toEqual(['mastra/external-internal-link src/site/index.mdx:7'])
  })

  it('reports a missing or broken sidebars.js', async () => {
    expect(summary(await run({ 'index.mdx': page('# Home') }))).toEqual([
      'mastra/external-sidebar-invalid src/site/sidebars.js',
    ])
    expect(
      summary(await run({ 'index.mdx': page('# Home'), 'sidebars.js': 'export default { docsSidebar: [' })),
    ).toEqual(['mastra/external-sidebar-invalid src/site/sidebars.js'])
  })

  it('reports a link to a route with no page', async () => {
    const findings = await runWithLink('/guides/missing')
    expect(summary(findings)).toEqual(['mastra/external-internal-link src/site/index.mdx:7'])
  })

  it('reports a relative .mdx link to a missing file', async () => {
    const findings = await runWithLink('./missing.mdx')
    expect(summary(findings)).toEqual(['mastra/external-internal-link src/site/index.mdx:7'])
  })

  it('reports relative page links without an .mdx extension', async () => {
    expect(summary(await runWithLink('missing#setup'))).toEqual(['mastra/external-internal-link src/site/index.mdx:7'])
    expect(summary(await runWithLink('guide'))).toEqual(['mastra/external-internal-link src/site/index.mdx:7'])
    expect(summary(await runWithLink('./img/diagram.png'))).toEqual([])
  })

  it('reports an anchor with no matching heading', async () => {
    const findings = await runWithLink('/guide#install')
    expect(summary(findings)).toEqual(['mastra/external-anchor src/site/index.mdx:7'])
    expect(findings[0].message).toContain('"install"')
  })

  it('ignores headings inside fenced code blocks', async () => {
    const guide = page('# Guide\n\n```md\n## Not a heading\n```')
    expect(summary(await runWithLink('/guide#not-a-heading', guide))).toEqual([
      'mastra/external-anchor src/site/index.mdx:7',
    ])
  })

  it('uses explicit heading ids instead of the generated slug', async () => {
    const guide = page('# Guide\n\n## Install the CLI {#install}\n\nText.')
    expect(summary(await runWithLink('/guide#install', guide))).toEqual([])
    expect(summary(await runWithLink('/guide#install-the-cli', guide))).toEqual([
      'mastra/external-anchor src/site/index.mdx:7',
    ])
  })

  it('uses MDX comment heading ids like Docusaurus', async () => {
    const guide = page('# Guide\n\n## Install the CLI {/* #install */}\n\n## Plain {/* note */}\n\nText.')
    expect(summary(await runWithLink('/guide#install', guide))).toEqual([])
    expect(summary(await runWithLink('/guide#install-the-cli', guide))).toEqual([
      'mastra/external-anchor src/site/index.mdx:7',
    ])
  })

  it('slugs heading text like Docusaurus', async () => {
    const guide = page('# Guide\n\n## `createMastraCode()`\n\n## Options & flags\n\n### `MastraCodeConfig`')
    expect(summary(await runWithLink('/guide#createmastracode', guide))).toEqual([])
    expect(summary(await runWithLink('/guide#options--flags', guide))).toEqual([])
    expect(summary(await runWithLink('/guide#mastracodeconfig', guide))).toEqual([])
    expect(summary(await runWithLink('/guide#createmastracodeoptions', guide))).toEqual([
      'mastra/external-anchor src/site/index.mdx:7',
    ])
  })

  it('suffixes duplicate headings', async () => {
    const guide = page('# Guide\n\n## Setup\n\n## Setup')
    expect(summary(await runWithLink('/guide#setup-1', guide))).toEqual([])
    expect(summary(await runWithLink('/guide#setup-2', guide))).toEqual(['mastra/external-anchor src/site/index.mdx:7'])
  })

  it('accepts JSX id attributes as anchors', async () => {
    const guide = page('# Guide\n\n<div id="custom-target">Text</div>')
    expect(summary(await runWithLink('/guide#custom-target', guide))).toEqual([])
  })

  it('reports an MDX syntax error once, without anchor findings for that page', async () => {
    const guide = page('# Guide\n\n<div>unclosed\n')
    const findings = await runWithLink('/guide#anything', guide)
    expect(summary(findings)).toEqual([expect.stringMatching(/^mastra\/external-mdx-parse src\/site\/guide\.mdx/)])
  })

  describe('a site with several sections', () => {
    const REF_SOURCE = 'docs/src/site-ref'
    const sections = (refRepo = 'mastra-ai/site') => ({
      targets: [
        MANIFEST.targets[0],
        {
          name: 'ref',
          source: REF_SOURCE,
          repo: refRepo,
          branch: 'main',
          dest: 'src/reference',
          routeBasePath: '/reference',
        },
      ],
    })
    // `run` writes relative to the first section's source dir.
    const ref = (file: string) => `../site-ref/${file}`
    const site = (link: string, refSidebar = sidebar(['api'])) => ({
      'index.mdx': page(`# Home\n\nSee [the API](${link}).`),
      'sidebars.js': sidebar(['index']),
      [ref('api.mdx')]: page('# API\n\n## Usage\n\nBack to [home](/).'),
      [ref('sidebars.js')]: refSidebar,
    })

    it('resolves links and anchors across sections served under their routeBasePath', async () => {
      expect(await run(site('/reference/api#usage'), sections())).toEqual([])
    })

    it('reports routes and anchors missing from another section', async () => {
      for (const link of ['/reference/missing', '/api', '/reference/api#nope']) {
        expect(summary(await run(site(link), sections()))).toEqual([
          `mastra/external-${link.includes('#') ? 'anchor' : 'internal-link'} src/site/index.mdx:7`,
        ])
      }
    })

    it('checks each section against its own sidebars.js', async () => {
      expect(summary(await run(site('/reference/api'), sections()))).toEqual([])
      expect(summary(await run(site('/reference/api', sidebar([])), sections()))).toEqual([
        'mastra/external-sidebar-unlinked-page src/site-ref/api.mdx',
      ])
    })

    it('routes index pages and frontmatter ids under the section routeBasePath', async () => {
      const files = {
        ...site('/reference#overview'),
        [ref('index.mdx')]: page('# Reference\n\n## Overview\n\nText.'),
        [ref('renamed.mdx')]: page('# Renamed', 'id: client'),
        [ref('sidebars.js')]: sidebar(['api', 'index', 'client']),
      }
      expect(await run(files, sections())).toEqual([])
      files['index.mdx'] = page('# Home\n\nSee [the client](/reference/client) and [old](/reference/renamed).')
      expect(summary(await run(files, sections()))).toEqual(['mastra/external-internal-link src/site/index.mdx:7'])
    })

    it('does not resolve links into a different site', async () => {
      expect(summary(await run(site('/reference/api'), sections('mastra-ai/other')))).toEqual([
        'mastra/external-internal-link src/site/index.mdx:7',
        'mastra/external-internal-link src/site-ref/api.mdx:9',
      ])
    })
  })

  it('does nothing when the manifest does not exist', async () => {
    expect(await run({ 'index.mdx': page('[broken](/nope)') }, null)).toEqual([])
  })

  it('reports manifest problems as findings instead of throwing', async () => {
    const files = { 'index.mdx': page('# Home'), 'sidebars.js': sidebar(['index']) }
    const cases: [unknown, string][] = [
      ['{ "targets": [', 'JSON'],
      [{ targets: [{ ...MANIFEST.targets[0], name: 'Bad Name' }] }, '"name"'],
      [{ targets: [{ ...MANIFEST.targets[0], source: 'docs/src/missing' }] }, 'does not exist'],
      [{ targets: [] }, 'non-empty'],
    ]
    for (const [manifest, message] of cases) {
      const findings = await run(files, manifest)
      expect(summary(findings)).toEqual(['mastra/external-manifest-invalid ../.github/docs-sync.json'])
      expect(findings[0].message).toContain(message)
    }
  })
})
