import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { checkFrontmatter } from '../checks/frontmatter'
import { checkBareUrls, checkCodeBlockLanguage, checkLinks, checkSingleH1 } from '../checks/mdx'
import { checkRedirectList } from '../checks/redirects'
import { valeFindings } from '../checks/vale'
import { parseContentFile } from '../content'
import { formatHuman, parseArgs } from '../index'
import { parseMdx } from '../mdx'
import { buildRouteIndex, routeForFile } from '../routes'
import { isKnownRuleId, matchesRuleFilter, RULE_FAMILIES, RULES, slugifyRuleName } from '../rules'
import { runChecks, UsageError } from '../runner'
import { isSuppressed, parseSuppressions } from '../suppress'

const ROOT = '/repo'
const VALID_FRONTMATTER = `---
title: 'Agents overview'
description: 'Learn how agents use models, tools, and memory to complete open-ended tasks.'
packages:
  - '@mastra/core'
---`

function page(relativePath: string, body: string, frontmatter = VALID_FRONTMATTER) {
  return parseContentFile(ROOT, `src/content/en/${relativePath}`, `${frontmatter}\n\n${body}\n`)
}

async function tree(file: ReturnType<typeof page>) {
  return (await parseMdx(file)).tree
}

describe('rule registry', () => {
  it('uses unique, namespaced, kebab-case IDs', () => {
    const ids = RULES.map(rule => rule.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^mastra\/[a-z0-9]+(-[a-z0-9]+)*$/)
  })

  it('recognizes tool-derived rule families', () => {
    expect(isKnownRuleId('mastra/remark-heading-increment')).toBe(true)
    expect(isKnownRuleId('mastra/vale-mastra-headings')).toBe(true)
    expect(isKnownRuleId('mastra/remark-')).toBe(false)
    expect(isKnownRuleId('mastra/not-a-rule')).toBe(false)
  })

  it('matches exact and prefix filters', () => {
    expect(matchesRuleFilter('mastra/internal-link', 'mastra/internal-link')).toBe(true)
    expect(matchesRuleFilter('mastra/sidebar-unlinked-page', 'mastra/sidebar-*')).toBe(true)
    expect(matchesRuleFilter('mastra/internal-link', 'mastra/link')).toBe(false)
  })

  it('slugifies external rule names', () => {
    expect(slugifyRuleName('Mastra.Headings')).toBe('mastra-headings')
    expect(slugifyRuleName('write-good.Weasel')).toBe('write-good-weasel')
    expect(slugifyRuleName('signs-of-ai-writing.AspectOveruse')).toBe('signs-of-ai-writing-aspect-overuse')
  })
})

describe('frontmatter rules', () => {
  it('passes a valid page', () => {
    expect(checkFrontmatter(page('docs/agents/overview.mdx', '# Agents'))).toEqual([])
  })

  it('reports missing frontmatter', () => {
    const file = parseContentFile(ROOT, 'src/content/en/docs/a.mdx', '# No frontmatter\n')
    expect(checkFrontmatter(file).map(f => f.ruleId)).toEqual(['mastra/frontmatter-missing'])
  })

  it('reports invalid YAML with its line', () => {
    const file = parseContentFile(
      ROOT,
      'src/content/en/docs/a.mdx',
      `---\ntitle: 'ok'\ndescription: [unclosed\n---\n\n# A\n`,
    )
    const [item] = checkFrontmatter(file)
    expect(item.ruleId).toBe('mastra/frontmatter-parse')
    expect(item.line).toBeGreaterThan(1)
  })

  it('reports missing title, short description, and invalid packages', () => {
    const file = page('docs/a.mdx', '# A', `---\ndescription: 'Too short.'\npackages:\n  - 'not-a-package'\n---`)
    expect(checkFrontmatter(file).map(f => f.ruleId)).toEqual(
      expect.arrayContaining(['mastra/frontmatter-title', 'mastra/description-length', 'mastra/frontmatter-packages']),
    )
  })
})

describe('inline lint comments', () => {
  const lineOf = (file: ReturnType<typeof page>, text: string) =>
    file.source.split('\n').findIndex(l => l.includes(text)) + 1

  it('disables a rule until it is re-enabled', () => {
    const file = page(
      'docs/a.mdx',
      '# A\n\n{/* lint disable mastra/bare-url */}\n\nhttps://one.example\n\n{/* lint enable mastra/bare-url */}\n\nhttps://two.example',
    )
    const s = parseSuppressions(file)
    expect(s.invalid).toEqual([])
    expect(isSuppressed(s, 'mastra/bare-url', lineOf(file, 'one.example'))).toBe(true)
    expect(isSuppressed(s, 'mastra/bare-url', lineOf(file, 'two.example'))).toBe(false)
    expect(isSuppressed(s, 'mastra/internal-link', lineOf(file, 'one.example'))).toBe(false)
  })

  it('ignores a rule for the next block only', () => {
    const file = page(
      'docs/a.mdx',
      '# A\n\n{/* lint ignore mastra/code-block-lang */}\n\`\`\`\nfirst\n\n\`\`\`\n\n\`\`\`\nsecond\n\`\`\`',
    )
    const s = parseSuppressions(file)
    expect(isSuppressed(s, 'mastra/code-block-lang', lineOf(file, 'first') - 1)).toBe(true)
    expect(isSuppressed(s, 'mastra/code-block-lang', lineOf(file, 'second') - 1)).toBe(false)
  })

  it('applies a leading disable to the whole file, including frontmatter and line-less findings', () => {
    const file = page('docs/a.mdx', '{/* lint disable mastra/description-length mastra/vale-* */}\n\n# A')
    const s = parseSuppressions(file)
    expect(isSuppressed(s, 'mastra/description-length', 3)).toBe(true)
    expect(isSuppressed(s, 'mastra/description-length')).toBe(true)
    expect(isSuppressed(s, 'mastra/vale-mastra-headings', 99)).toBe(true)
  })

  it('treats a comment without IDs as all rules and skips comments in code', () => {
    const file = page(
      'docs/a.mdx',
      '# A\n\n\`\`\`mdx\n{/* lint disable mastra/nope */}\n\`\`\`\n\n{/* lint ignore */}\nhttps://x.example',
    )
    const s = parseSuppressions(file)
    expect(s.invalid).toEqual([])
    expect(isSuppressed(s, 'mastra/bare-url', lineOf(file, 'x.example'))).toBe(true)
  })

  it('re-enables only the rules named by a partial enable', () => {
    const file = page(
      'docs/a.mdx',
      [
        '# A',
        '{/* lint disable mastra/bare-url, mastra/code-block-lang */}',
        'one',
        '{/* lint enable mastra/bare-url */}',
        'two',
        '{/* lint disable */}',
        'three',
        '{/* lint enable mastra/bare-url */}',
        'four',
      ].join('\n\n'),
    )
    const s = parseSuppressions(file)
    expect(isSuppressed(s, 'mastra/bare-url', lineOf(file, 'one'))).toBe(true)
    expect(isSuppressed(s, 'mastra/code-block-lang', lineOf(file, 'one'))).toBe(true)
    expect(isSuppressed(s, 'mastra/bare-url', lineOf(file, 'two'))).toBe(false)
    expect(isSuppressed(s, 'mastra/code-block-lang', lineOf(file, 'two'))).toBe(true)
    expect(isSuppressed(s, 'mastra/internal-link', lineOf(file, 'three'))).toBe(true)
    expect(isSuppressed(s, 'mastra/bare-url', lineOf(file, 'four'))).toBe(false)
    expect(isSuppressed(s, 'mastra/internal-link', lineOf(file, 'four'))).toBe(true)
  })

  it('accepts wildcard IDs that match a registered rule', () => {
    const file = page('docs/a.mdx', '# A\n\n{/* lint disable mastra/redirect-* mastra/nope-* */}\n\nbody')
    const s = parseSuppressions(file)
    expect(s.invalid).toEqual([{ id: 'mastra/nope-*', line: lineOf(file, 'nope-*') }])
    expect(isSuppressed(s, 'mastra/redirect-chain', lineOf(file, 'body'))).toBe(true)
    expect(isSuppressed(s, 'mastra/redirected-link', lineOf(file, 'body'))).toBe(false)
  })

  it('closes code fences only on a bare fence of the same character and length', () => {
    const file = page(
      'docs/a.mdx',
      [
        '# A',
        '````mdx',
        '```ts',
        '{/* lint disable mastra/nope */}',
        '```',
        '~~~~',
        '````',
        '{/* lint ignore mastra/bare-url */}',
        'https://x.example',
      ].join('\n'),
    )
    const s = parseSuppressions(file)
    expect(s.invalid).toEqual([])
    expect(isSuppressed(s, 'mastra/bare-url', lineOf(file, 'x.example'))).toBe(true)
  })

  it('reports unknown rule IDs', () => {
    const file = page('docs/a.mdx', '# A\n\n{/* lint disable mastra/nope */}')
    expect(parseSuppressions(file).invalid).toEqual([{ id: 'mastra/nope', line: lineOf(file, 'mastra/nope') }])
  })
})

describe('structure rules', () => {
  it('requires exactly one H1', async () => {
    const good = page('docs/a.mdx', '# One\n\n## Two')
    expect(checkSingleH1(good, await tree(good))).toEqual([])

    const none = page('docs/a.mdx', '## Only a subheading')
    expect(checkSingleH1(none, await tree(none)).map(f => f.ruleId)).toEqual(['mastra/single-h1'])

    const two = page('docs/a.mdx', '# One\n\n# Two')
    const findings = checkSingleH1(two, await tree(two))
    expect(findings).toHaveLength(1)
    expect(findings[0].line).toBe(two.source.split('\n').indexOf('# Two') + 1)
  })

  it('requires a language on fenced code blocks', async () => {
    const good = page('docs/a.mdx', '# A\n\n```typescript\nconst a = 1\n```')
    expect(checkCodeBlockLanguage(good, await tree(good))).toEqual([])

    const bad = page('docs/a.mdx', '# A\n\n```\nconst a = 1\n```')
    expect(checkCodeBlockLanguage(bad, await tree(bad)).map(f => f.ruleId)).toEqual(['mastra/code-block-lang'])
  })
})

describe('prose rules', () => {
  it('reports bare URLs but not links or code', async () => {
    const good = page(
      'docs/a.mdx',
      '# A\n\nSee [the site](https://example.com) or `https://example.com`.\n\n```bash\ncurl https://example.com\n```',
    )
    expect(checkBareUrls(good, await tree(good))).toEqual([])

    const bad = page('docs/a.mdx', '# A\n\nSee https://example.com for details.')
    const findings = checkBareUrls(bad, await tree(bad))
    expect(findings.map(f => f.ruleId)).toEqual(['mastra/bare-url'])
    expect(findings[0].suggestion).toBe('[descriptive text](https://example.com)')
  })
})

describe('routes and links', () => {
  const target = page('docs/agents/overview.mdx', '# Agents')
  const indexPage = page('reference/index.mdx', '# Reference')
  const slugged = page(
    'reference/classifier/classifier.mdx',
    '# Classifier',
    `${VALID_FRONTMATTER.slice(0, -3)}slug: '/classifier/classifier'\n---`,
  )
  const partial = page('docs/agents/_partial.mdx', 'Shared text')
  const files = [target, indexPage, slugged, partial]
  const index = buildRouteIndex(files, [{ source: '/docs/agents', destination: '/docs/agents/overview' }])

  it('derives Docusaurus routes', () => {
    expect(routeForFile(target)).toBe('/docs/agents/overview')
    expect(routeForFile(indexPage)).toBe('/reference')
    expect(routeForFile(slugged)).toBe('/reference/classifier/classifier')
    expect(routeForFile(partial)).toBeNull()
  })

  it('accepts links to existing routes, anchors, and external URLs', async () => {
    const file = page(
      'docs/a.mdx',
      '# A\n\n[a](/docs/agents/overview#tools) [b](/reference/) [c](https://example.com) [d](#local)',
    )
    expect(checkLinks(file, await tree(file), index).findings).toEqual([])
  })

  it('reports broken links with a suggestion', async () => {
    const file = page('docs/a.mdx', '# A\n\n[a](/docs/agents/overveiw)')
    const { findings, edits } = checkLinks(file, await tree(file), index)
    expect(findings.map(f => f.ruleId)).toEqual(['mastra/internal-link'])
    expect(findings[0].suggestion).toBe('/docs/agents/overview')
    expect(edits).toEqual([])
  })

  it('rewrites redirected and self-hosted links', async () => {
    const file = page('docs/a.mdx', '# A\n\n[a](/docs/agents#tools) [b](https://mastra.ai/docs/agents/overview)')
    const { findings, edits } = checkLinks(file, await tree(file), index)
    expect(findings.map(f => f.ruleId)).toEqual(['mastra/redirected-link', 'mastra/no-self-host-url'])
    expect(edits.map(edit => edit.text)).toEqual(['/docs/agents/overview#tools', '/docs/agents/overview'])
    expect(edits.map(edit => file.source.slice(edit.start, edit.end))).toEqual([
      '/docs/agents#tools',
      'https://mastra.ai/docs/agents/overview',
    ])
  })

  it('checks self-hosted links for redirects and broken routes', async () => {
    const file = page(
      'docs/a.mdx',
      '# A\n\n[a](https://mastra.ai/docs/agents#tools) [b](https://mastra.ai/docs/agents/overveiw)',
    )
    const { findings, edits } = checkLinks(file, await tree(file), index)
    expect(findings.map(f => f.ruleId)).toEqual([
      'mastra/no-self-host-url',
      'mastra/redirected-link',
      'mastra/no-self-host-url',
      'mastra/internal-link',
    ])
    const redirect = edits.find(edit => edit.ruleId === 'mastra/redirected-link')
    expect(redirect?.text).toBe('/docs/agents/overview#tools')
    expect(file.source.slice(redirect!.start, redirect!.end)).toBe('https://mastra.ai/docs/agents#tools')
    expect(redirect?.alsoFixes?.ruleId).toBe('mastra/no-self-host-url')
  })

  it('keeps self-hosted links to static files absolute', async () => {
    const file = page(
      'docs/a.mdx',
      '# A\n\n[a](https://mastra.ai/docs/llms.txt) [b](https://mastra.ai/reference/agents/agent.md)',
    )
    expect(checkLinks(file, await tree(file), index).findings).toEqual([])
  })
})

describe('redirect rules', () => {
  const routes = new Set(['/docs/a', '/docs/b'])

  it('passes valid redirects', () => {
    expect(checkRedirectList([{ source: '/docs/old', destination: '/docs/a' }], routes, new Map())).toEqual([])
  })

  it('reports duplicates, chains, and missing destinations', () => {
    const findings = checkRedirectList(
      [
        { source: '/docs/old', destination: '/docs/a' },
        { source: '/docs/old', destination: '/docs/b' },
        { source: '/docs/older', destination: '/docs/old' },
        { source: '/docs/gone', destination: '/docs/missing' },
        { source: '/docs/wild/:path*', destination: '/docs/new/:path*' },
      ],
      routes,
      new Map([['/docs/old', 3]]),
    )
    expect(findings.map(f => f.ruleId).sort()).toEqual([
      'mastra/redirect-chain',
      'mastra/redirect-destination',
      'mastra/redirect-duplicate',
    ])
    expect(findings.find(f => f.ruleId === 'mastra/redirect-duplicate')?.line).toBe(3)
  })
})

describe('vale adapter', () => {
  it('maps Vale alerts to findings', () => {
    const findings = valeFindings(ROOT, {
      [`${ROOT}/src/content/en/docs/a.mdx`]: [
        { Check: 'Mastra.Headings', Message: 'Use sentence case', Severity: 'suggestion', Line: 4, Span: [3, 9] },
      ],
    })
    expect(findings).toEqual([
      expect.objectContaining({
        ruleId: 'mastra/vale-mastra-headings',
        severity: 'info',
        category: 'prose',
        file: 'src/content/en/docs/a.mdx',
        line: 4,
        column: 3,
      }),
    ])
  })
})

describe('CLI', () => {
  it('parses flags and files', () => {
    expect(
      parseArgs(['--json', '--fix', '--rule', 'mastra/sidebar-*', '--category=links,prose', '-q', 'a.mdx']),
    ).toMatchObject({
      json: true,
      fix: true,
      quiet: true,
      rules: ['mastra/sidebar-*'],
      categories: ['links', 'prose'],
      files: ['a.mdx'],
    })
    expect(parseArgs(['--format', 'json', '--only', 'sidebar'])).toMatchObject({ json: true, categories: ['sidebar'] })
    expect(parseArgs(['--format=human']).json).toBe(false)
    expect(() => parseArgs(['--format', 'xml'])).toThrow(/Unknown format/)
    expect(() => parseArgs(['--category', 'nope'])).toThrow(/Unknown category/)
    expect(() => parseArgs(['--bogus'])).toThrow(/Unknown option/)
  })
})

describe('runChecks', () => {
  let rootDir: string

  beforeEach(async () => {
    rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docs-check-'))
    await fs.writeFile(
      path.join(rootDir, 'vercel.redirects.json'),
      JSON.stringify({ redirects: [{ source: '/docs/old', destination: '/docs/good', permanent: true }] }),
    )
    const write = async (relative: string, content: string) => {
      const full = path.join(rootDir, 'src/content/en', relative)
      await fs.mkdir(path.dirname(full), { recursive: true })
      await fs.writeFile(full, content)
    }
    await write('docs/good.mdx', `${VALID_FRONTMATTER}\n\n# Good\n\nSee [the bad page](/docs/bad).\n`)
    await write(
      'docs/bad.mdx',
      `${VALID_FRONTMATTER}\n\n# Bad\n\n[old](/docs/old) and [missing](/docs/nowhere).\n\n{/* lint ignore mastra/code-block-lang */}\n\`\`\`\nno language\n\`\`\`\n`,
    )
  })

  afterEach(async () => {
    await fs.rm(rootDir, { recursive: true, force: true })
  })

  it('reports normalized findings and a summary', async () => {
    const report = await runChecks({ rootDir, categories: ['frontmatter', 'structure', 'links'] })
    expect(report.version).toBe(1)
    expect(report.summary).toMatchObject({ ok: true, errors: 0, warnings: 2, fixable: 1, fixed: 0, filesChecked: 2 })
    expect(report.findings.map(f => [f.file, f.ruleId])).toEqual([
      ['src/content/en/docs/bad.mdx', 'mastra/redirected-link'],
      ['src/content/en/docs/bad.mdx', 'mastra/internal-link'],
    ])
    for (const item of report.findings) {
      expect(item).toEqual(
        expect.objectContaining({
          severity: 'warn',
          category: 'links',
          fixable: expect.any(Boolean),
          line: expect.any(Number),
        }),
      )
    }
    expect(formatHuman(report)).toContain('mastra/internal-link')
  })

  it('filters by rule and scopes to file arguments', async () => {
    const report = await runChecks({
      rootDir,
      rules: ['mastra/internal-link'],
      files: ['src/content/en/docs/bad.mdx'],
    })
    expect(report.summary.filesChecked).toBe(1)
    expect(report.summary.status).toBe('passed')
    expect(report.findings.map(f => f.ruleId)).toEqual(['mastra/internal-link'])
  })

  it('reports file arguments that are not content pages and rejects runs with none', async () => {
    const report = await runChecks({
      rootDir,
      categories: ['structure'],
      files: ['src/content/en/docs/bad.mdx', 'README.md'],
    })
    expect(report.summary.filesChecked).toBe(1)
    expect(report.summary.status).toBe('partial')
    expect(report.summary.skipped).toEqual([{ check: 'files', reason: expect.stringContaining('README.md') }])
    await expect(runChecks({ rootDir, files: ['src/content/en/docs/typo.md'] })).rejects.toBeInstanceOf(UsageError)
  })

  it('applies fixes with --fix', async () => {
    const report = await runChecks({ rootDir, categories: ['links'], fix: true })
    expect(report.summary.fixed).toBe(1)
    expect(report.findings.map(f => f.ruleId)).toEqual(['mastra/internal-link'])
    const source = await fs.readFile(path.join(rootDir, 'src/content/en/docs/bad.mdx'), 'utf8')
    expect(source).toContain('[old](/docs/good)')
  })

  it('fixes a self-hosted link that also redirects in one edit', async () => {
    const file = path.join(rootDir, 'src/content/en/docs/good.mdx')
    await fs.writeFile(file, `${VALID_FRONTMATTER}\n\n# Good\n\nSee [old](https://mastra.ai/docs/old#x).\n`)
    const report = await runChecks({
      rootDir,
      categories: ['links'],
      files: ['src/content/en/docs/good.mdx'],
      fix: true,
    })
    expect(report.summary.fixed).toBe(1)
    expect(report.findings).toEqual([])
    expect(await fs.readFile(file, 'utf8')).toContain('[old](/docs/good#x)')
  })
})

describe('rule documentation', () => {
  it('documents every rule in styleguides/CHECKS.md with its current severity', async () => {
    const doc = await fs.readFile(path.join(__dirname, '../../../styleguides/CHECKS.md'), 'utf8')
    for (const rule of [...RULES, ...RULE_FAMILIES]) {
      const row = doc.split('\n').find(line => line.startsWith(`| \`${rule.id}\``))
      expect(row, `${rule.id} is missing from CHECKS.md`).toBeDefined()
      expect(row).toContain(`| ${rule.severity}`)
    }
  })
})
