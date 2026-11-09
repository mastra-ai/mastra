import type { Definition, Link, Root } from 'mdast'
import { finding } from '../finding'
import { parseMdx, type LintMessage } from '../mdx'
import { isKnownRuleId, slugifyRuleName } from '../rules'
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
  /** Another finding on the same URL that this edit also fixes (a self-hosted URL that also redirects). */
  alsoFixes?: Finding
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

    let localUrl = url
    let selfHostFinding: Finding | undefined
    const selfHost = url.match(SELF_HOST)
    // Files like /docs/llms.txt or *.md are served as static assets, not Docusaurus routes, so keep them absolute.
    if (selfHost && !/\.[a-z0-9]+$/i.test(splitUrl(selfHost[1]).pathname)) {
      localUrl = selfHost[1]
      const edit = urlEdit(file, node, url, localUrl)
      selfHostFinding = finding('mastra/no-self-host-url', `Use a root-relative link instead of ${url}`, location, {
        suggestion: localUrl,
        fixable: edit !== undefined,
      })
      findings.push(selfHostFinding)
      if (edit) edits.push({ ...edit, ruleId: selfHostFinding.ruleId, finding: selfHostFinding })
    }

    if (!localUrl.startsWith('/') || localUrl.startsWith('//')) return
    const { pathname, suffix } = splitUrl(localUrl)
    const route = normalizeRoute(pathname)
    if (!isSectionPath(route) || index.routes.has(route)) return

    const destination = findRedirect(index, route)
    if (destination && index.routes.has(normalizeRoute(splitUrl(destination).pathname))) {
      const replacement = destination.includes('#') ? destination : `${destination}${suffix}`
      // Replaces the whole original URL, so it also fixes a self-hosted prefix.
      const edit = urlEdit(file, node, url, replacement)
      const item = finding(
        'mastra/redirected-link',
        `${localUrl} redirects to ${destination}; link to the destination`,
        location,
        {
          suggestion: replacement,
          fixable: edit !== undefined,
        },
      )
      findings.push(item)
      if (edit) edits.push({ ...edit, ruleId: item.ruleId, finding: item, alsoFixes: selfHostFinding })
      return
    }

    const suggestion = suggestRoute(index, route)
    findings.push(
      finding(
        'mastra/internal-link',
        `${localUrl} does not resolve to a page${suggestion ? `. Did you mean ${suggestion}?` : ''}`,
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
    finding(ruleIdForMessage(message), message.reason, {
      file: file.path,
      line: message.line ?? undefined,
      column: message.column ?? undefined,
    }),
  )
}

/** The preset's own rules (`source: 'mastra'`) keep their `mastra/<rule>` ID; third-party remark-lint rules get `mastra/remark-<rule>`. */
function ruleIdForMessage(message: LintMessage): string {
  const own = `mastra/${message.ruleId}`
  if (message.source === 'mastra' && isKnownRuleId(own)) return own
  return `mastra/remark-${slugifyRuleName(message.ruleId ?? 'unknown')}`
}

const PAGE_RULES = new Set(['mastra/description-required', 'mastra/description-length'])

/**
 * Runs every rule that needs the parsed MDX tree: remark-lint, structure, links, and bare URLs.
 * Parsing happens once per file and is shared between rules.
 */
export const mdxCheck: Check = {
  name: 'mdx',
  categories: ['frontmatter', 'structure', 'links', 'prose'],
  scope: 'files',
  async run(ctx: CheckContext): Promise<CheckResult> {
    const findings: Finding[] = []
    let fixed = 0
    const wants = (category: string) => ctx.categories.includes(category as never)
    const index = wants('links') ? buildRouteIndex(await ctx.allFiles(), await loadRedirects(ctx.rootDir)) : undefined

    for (const file of ctx.files) {
      const { tree, lintMessages } = await parseMdx(file)
      // Generated model pages only get link and description checks; the other remark rules cover authored sections.
      // The runner drops findings outside the selected categories.
      const remark = remarkFindings(file, lintMessages)
      findings.push(...(isFormattedFile(file) ? remark : remark.filter(item => PAGE_RULES.has(item.ruleId))))
      if (index) {
        const result = checkLinks(file, tree, index)
        const active = ctx.fix
          ? result.edits.filter(edit => ctx.isRuleActive(edit.ruleId, file, edit.finding.line))
          : []
        // A redirect edit on a self-hosted URL rewrites the same range, so it replaces the self-host edit.
        const superseded = new Set(active.flatMap(edit => (edit.alsoFixes ? [edit.alsoFixes] : [])))
        const edits = active.filter(edit => !superseded.has(edit.finding))
        if (edits.length > 0) {
          fixed += await applyEdits(file, edits)
          const applied = new Set<Finding>([...edits.map(edit => edit.finding), ...superseded])
          findings.push(...result.findings.filter(item => !applied.has(item)))
        } else {
          findings.push(...result.findings)
        }
      }
    }
    return { findings, fixed }
  },
}
