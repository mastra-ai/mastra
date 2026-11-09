import type { Code, Definition, Heading, Link, Root, Text } from 'mdast'
import { finding } from '../finding'
import { parseMdx } from '../mdx'
import { isPartial } from '../content'
import { slugifyRuleName } from '../rules'
import {
  buildRouteIndex,
  findRedirect,
  isSectionPath,
  loadRedirects,
  normalizeRoute,
  suggestRoute,
  type RouteIndex,
} from '../routes'
import type { Check, CheckContext, CheckResult, ContentFile, Finding } from '../types'
import { applyEdits, type TextEdit } from '../edits'
import { isFormattedFile } from './format'

interface Node {
  type: string
  children?: Node[]
  position?: {
    start: { line: number; column: number; offset?: number }
    end: { line: number; column: number; offset?: number }
  }
}

function walk(node: Node, visit: (node: Node) => boolean | void): void {
  // Returning false from `visit` skips the node's children.
  if (visit(node) === false) return
  for (const child of node.children ?? []) walk(child, visit)
}

function at(file: ContentFile, node: Node) {
  return { file: file.path, line: node.position?.start.line, column: node.position?.start.column }
}

export function checkSingleH1(file: ContentFile, tree: Root): Finding[] {
  if (isPartial(file)) return []
  const h1s: Heading[] = []
  walk(tree as Node, node => {
    if (node.type === 'heading' && (node as unknown as Heading).depth === 1) h1s.push(node as unknown as Heading)
  })
  if (h1s.length === 0) {
    return [finding('mastra/single-h1', 'Page has no `#` heading', { file: file.path, line: file.bodyStartLine })]
  }
  return h1s
    .slice(1)
    .map(h1 => finding('mastra/single-h1', `Page has ${h1s.length} \`#\` headings; use one`, at(file, h1 as Node)))
}

export function checkCodeBlockLanguage(file: ContentFile, tree: Root): Finding[] {
  const findings: Finding[] = []
  walk(tree as Node, node => {
    if (node.type !== 'code') return
    const code = node as unknown as Code
    const offset = node.position?.start.offset
    const fenced = offset !== undefined && /^[`~]{3}/.test(file.source.slice(offset).trimStart())
    if (fenced && !code.lang) {
      findings.push(
        finding(
          'mastra/code-block-lang',
          'Code block has no language; add one, e.g. ```typescript or ```text',
          at(file, node),
        ),
      )
    }
  })
  return findings
}

const URL_PATTERN = /https?:\/\/[^\s)<>"'`]+/g

export function checkBareUrls(file: ContentFile, tree: Root): Finding[] {
  const findings: Finding[] = []
  walk(tree as Node, node => {
    if (node.type === 'link' || node.type === 'linkReference' || node.type === 'definition') return false
    if (node.type !== 'text') return
    const text = node as unknown as Text
    for (const match of text.value.matchAll(URL_PATTERN)) {
      findings.push(
        finding('mastra/bare-url', `Bare URL ${match[0]}; wrap it in a Markdown link`, at(file, node), {
          suggestion: `[descriptive text](${match[0]})`,
        }),
      )
    }
  })
  return findings
}

const SELF_HOST = /^https?:\/\/(?:www\.)?mastra\.ai(\/(?:docs|integrations|models|reference)(?:[/?#].*)?)$/

function splitUrl(url: string): { pathname: string; suffix: string } {
  const index = url.search(/[?#]/)
  return index === -1 ? { pathname: url, suffix: '' } : { pathname: url.slice(0, index), suffix: url.slice(index) }
}

/** Finds the source range of `url` inside a link or definition node. */
function urlEdit(file: ContentFile, node: Node, url: string, text: string): Omit<TextEdit, 'ruleId'> | undefined {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) return undefined
  const index = file.source.slice(start, end).lastIndexOf(url)
  if (index === -1) return undefined
  return { start: start + index, end: start + index + url.length, text }
}

export interface LinkEdit extends TextEdit {
  finding: Finding
}

export function checkLinks(
  file: ContentFile,
  tree: Root,
  index: RouteIndex,
): { findings: Finding[]; edits: LinkEdit[] } {
  const findings: Finding[] = []
  const edits: LinkEdit[] = []

  walk(tree as Node, node => {
    if (node.type !== 'link' && node.type !== 'definition') return
    const url = (node as unknown as Link | Definition).url
    const location = at(file, node)

    const selfHost = url.match(SELF_HOST)
    // Files like /docs/llms.txt or *.md are served as static assets, not Docusaurus routes, so keep them absolute.
    if (selfHost && !/\.[a-z0-9]+$/i.test(splitUrl(selfHost[1]).pathname)) {
      const replacement = selfHost[1]
      const edit = urlEdit(file, node, url, replacement)
      const item = finding('mastra/no-self-host-url', `Use a root-relative link instead of ${url}`, location, {
        suggestion: replacement,
        fixable: edit !== undefined,
      })
      findings.push(item)
      if (edit) edits.push({ ...edit, ruleId: item.ruleId, finding: item })
      return
    }

    if (!url.startsWith('/') || url.startsWith('//')) return
    const { pathname, suffix } = splitUrl(url)
    const route = normalizeRoute(pathname)
    if (!isSectionPath(route) || index.routes.has(route)) return

    const destination = findRedirect(index, route)
    if (destination && index.routes.has(normalizeRoute(splitUrl(destination).pathname))) {
      const replacement = destination.includes('#') ? destination : `${destination}${suffix}`
      const edit = urlEdit(file, node, url, replacement)
      const item = finding(
        'mastra/redirected-link',
        `${url} redirects to ${destination}; link to the destination`,
        location,
        {
          suggestion: replacement,
          fixable: edit !== undefined,
        },
      )
      findings.push(item)
      if (edit) edits.push({ ...edit, ruleId: item.ruleId, finding: item })
      return
    }

    const suggestion = suggestRoute(index, route)
    findings.push(
      finding(
        'mastra/internal-link',
        `${url} does not resolve to a page${suggestion ? `. Did you mean ${suggestion}?` : ''}`,
        location,
        suggestion ? { suggestion: `${suggestion}${suffix}` } : {},
      ),
    )
  })

  return { findings, edits }
}

export function remarkFindings(
  file: ContentFile,
  messages: Awaited<ReturnType<typeof parseMdx>>['lintMessages'],
): Finding[] {
  return messages.map(message =>
    finding(`mastra/remark-${slugifyRuleName(message.ruleId ?? 'unknown')}`, message.reason, {
      file: file.path,
      line: message.line ?? undefined,
      column: message.column ?? undefined,
    }),
  )
}

/**
 * Runs every rule that needs the parsed MDX tree: remark-lint, structure, links, and bare URLs.
 * Parsing happens once per file and is shared between rules.
 */
export const mdxCheck: Check = {
  name: 'mdx',
  categories: ['structure', 'links', 'prose'],
  scope: 'files',
  async run(ctx: CheckContext): Promise<CheckResult> {
    const findings: Finding[] = []
    let fixed = 0
    const wants = (category: string) => ctx.categories.includes(category as never)
    const index = wants('links') ? buildRouteIndex(await ctx.allFiles(), await loadRedirects(ctx.rootDir)) : undefined

    for (const file of ctx.files) {
      const { tree, lintMessages } = await parseMdx(file)
      // Generated model pages only get link checks; remark, prose, and structure rules cover authored sections.
      const authored = isFormattedFile(file)
      if (authored && wants('prose')) {
        findings.push(...remarkFindings(file, lintMessages))
        findings.push(...checkBareUrls(file, tree))
      }
      if (authored && wants('structure')) {
        findings.push(...checkSingleH1(file, tree))
        findings.push(...checkCodeBlockLanguage(file, tree))
      }
      if (index) {
        const result = checkLinks(file, tree, index)
        const edits = ctx.fix ? result.edits.filter(edit => ctx.isRuleActive(edit.ruleId, file, edit.finding.line)) : []
        if (edits.length > 0) {
          fixed += await applyEdits(file, edits)
          const applied = new Set<Finding>(edits.map(edit => edit.finding))
          findings.push(...result.findings.filter(item => !applied.has(item)))
        } else {
          findings.push(...result.findings)
        }
      }
    }
    return { findings, fixed }
  },
}
