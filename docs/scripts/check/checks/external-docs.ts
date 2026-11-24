import fs from 'fs/promises'
import GithubSlugger from 'github-slugger'
import path from 'path'
import { pathToFileURL } from 'url'
import { extractSidebarDocIds, type SidebarItem } from '../../sidebar-doc-ids'
import { parseContentFile, toPosix, walkMdx } from '../content'
import { finding } from '../finding'
import { parseMdx, type LintMessage } from '../mdx'
import { normalizeRoute, routeWithin } from '../routes'
import type { Check, ContentFile, Finding } from '../types'

interface Node {
  type: string
  value?: unknown
  url?: string
  alt?: string
  depth?: number
  name?: string | null
  attributes?: { type: string; name?: string; value?: unknown }[]
  children?: Node[]
  position?: { start: { line: number; column: number } }
  data?: { estree?: { body: unknown[]; comments?: { value: string }[] } }
}

interface Target {
  name: string
  source: string
  repo: string
  routeBasePath?: string
}

interface SyncedPage {
  file: ContentFile
  docId: string
  route: string
  /** Heading and JSX `id` anchors, or null when the page failed to parse. */
  anchors: Set<string> | null
  parseError?: LintMessage
  tree: Node
}

/** `.github/docs-sync.json` for a docs package root. */
export function manifestPath(docsRoot: string): string {
  return path.resolve(docsRoot, '..', '.github/docs-sync.json')
}

// Docusaurus reads `## Heading {#custom-id}` before MDX parsing, which would reject the braces as an expression.
const EXPLICIT_ID = /^(#{1,6}\s.*?)(\s*\{#([^}\s]+)\})\s*$/

/** Blanks explicit heading ids (keeping every offset) and returns them by line. */
function stripExplicitIds(source: string): { source: string; ids: Map<number, string> } {
  const ids = new Map<number, string>()
  const lines = source.split('\n').map((line, index) => {
    const match = line.match(EXPLICIT_ID)
    if (!match) return line
    ids.set(index + 1, match[3])
    return match[1] + ' '.repeat(line.length - match[1].length)
  })
  return { source: lines.join('\n'), ids }
}

/** Id from a trailing `{/* #custom-id *\/}` comment, using the same rule as Docusaurus' heading plugin. */
function commentHeadingId(heading: Node): string | undefined {
  const last = heading.children?.at(-1)
  const program = last?.type === 'mdxTextExpression' ? last.data?.estree : undefined
  if (!program || program.body.length !== 0 || program.comments?.length !== 1) return undefined
  const firstPart = program.comments[0].value.trim().split(' ')[0]
  return firstPart.startsWith('#') ? firstPart.slice(1) || undefined : undefined
}

/** Plain text of a node, matching `mdast-util-to-string`, which Docusaurus slugs headings from. */
function toText(node: Node): string {
  if (typeof node.value === 'string') return node.value
  if (node.type === 'image' && typeof node.alt === 'string') return node.alt
  return (node.children ?? []).map(toText).join('')
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node)
  for (const child of node.children ?? []) walk(child, visit)
}

function collectAnchors(tree: Node, explicitIds: Map<number, string>): Set<string> {
  const anchors = new Set<string>()
  const slugger = new GithubSlugger()
  walk(tree, node => {
    if (node.type === 'heading') {
      const explicit = (node.position ? explicitIds.get(node.position.start.line) : undefined) ?? commentHeadingId(node)
      anchors.add(explicit ?? slugger.slug(toText(node).trim()))
    } else if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
      const id = node.attributes?.find(attribute => attribute.type === 'mdxJsxAttribute' && attribute.name === 'id')
      if (typeof id?.value === 'string') anchors.add(id.value)
    }
  })
  return anchors
}

/** Doc ID Docusaurus assigns a page: its path without extension, with the frontmatter `id` replacing the name. */
function docIdFor(relativePath: string, frontmatter: Record<string, unknown> | null): string {
  const segments = relativePath.replace(/\.mdx$/, '').split('/')
  if (typeof frontmatter?.id === 'string' && frontmatter.id.trim() !== '') {
    segments[segments.length - 1] = frontmatter.id.trim()
  }
  return segments.join('/')
}

async function loadSidebarIds(sidebarPath: string): Promise<Set<string>> {
  // Cache-bust so edits are picked up when the checker runs repeatedly in one process (tests, watch).
  const mod = await import(`${pathToFileURL(sidebarPath).href}?t=${Date.now()}`)
  const sidebars = (mod.default ?? mod) as Record<string, unknown>
  if (!sidebars || typeof sidebars !== 'object') throw new Error('sidebars.js has no default export object')
  const ids = new Set<string>()
  for (const [name, items] of Object.entries(sidebars)) {
    if (!Array.isArray(items)) throw new Error(`sidebar "${name}" is not an array`)
    for (const id of extractSidebarDocIds(items as SidebarItem[])) ids.add(id)
  }
  return ids
}

async function loadPage(
  docsRoot: string,
  sourceDir: string,
  routeBase: string,
  absolutePath: string,
): Promise<SyncedPage> {
  const relativeToDocs = toPosix(path.relative(docsRoot, absolutePath))
  const withinSource = toPosix(path.relative(sourceDir, absolutePath))
  const file = parseContentFile(docsRoot, relativeToDocs, await fs.readFile(absolutePath, 'utf-8'))
  const { source, ids } = stripExplicitIds(file.source)
  const { tree, lintMessages } = await parseMdx({ ...file, source })
  const parseError = lintMessages.find(message => message.fatal)
  return {
    file,
    docId: docIdFor(withinSource, file.frontmatter),
    route: routeWithin(routeBase, withinSource, file.frontmatter),
    anchors: parseError ? null : collectAnchors(tree as Node, ids),
    parseError,
    tree: tree as Node,
  }
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i

function checkPageLinks(page: SyncedPage, byRoute: Map<string, SyncedPage>, byPath: Map<string, SyncedPage>) {
  const findings: Finding[] = []
  walk(page.tree, node => {
    if ((node.type !== 'link' && node.type !== 'definition') || typeof node.url !== 'string') return
    const url = node.url
    if (url === '' || SCHEME.test(url) || url.startsWith('//')) return
    const at = { file: page.file.path, line: node.position?.start.line, column: node.position?.start.column }

    const hashIndex = url.indexOf('#')
    const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
    const anchor = hashIndex === -1 ? '' : url.slice(hashIndex + 1)
    const pathname = beforeHash.split('?', 1)[0]

    let linked: SyncedPage | undefined
    if (pathname === '') {
      linked = page
    } else if (/\.mdx?$/.test(pathname) && !pathname.startsWith('/')) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(page.file.path), pathname))
      linked = byPath.get(target)
      if (!linked) {
        findings.push(finding('mastra/external-internal-link', `${url} does not resolve to a synced page`, at))
        return
      }
    } else if (pathname.startsWith('/')) {
      // Other files (images, `llms.txt`) are static assets of the target site.
      if (/\.[a-z0-9]+$/i.test(pathname)) return
      linked = byRoute.get(normalizeRoute(pathname))
      if (!linked) {
        findings.push(finding('mastra/external-internal-link', `${url} does not resolve to a synced page`, at))
        return
      }
    } else {
      // Relative page links without `.md(x)` resolve against the browser URL, which depends on trailing slashes.
      if (/\.[a-z0-9]+$/i.test(pathname)) return
      findings.push(
        finding(
          'mastra/external-internal-link',
          `${url}: link to synced pages with a root-relative route or a relative .mdx path`,
          at,
        ),
      )
      return
    }

    if (anchor === '' || !linked.anchors) return
    let decoded = anchor
    try {
      decoded = decodeURIComponent(anchor)
    } catch {
      // Keep the raw anchor; it will not match a heading and gets reported.
    }
    if (!linked.anchors.has(decoded)) {
      findings.push(
        finding('mastra/external-anchor', `${url}: no heading with id "${decoded}" in ${linked.file.path}`, at),
      )
    }
  })
  return findings
}

async function loadTargetPages(target: Target, repoRoot: string, docsRoot: string): Promise<SyncedPage[]> {
  const sourceDir = path.join(repoRoot, target.source)
  const routeBase = target.routeBasePath && target.routeBasePath !== '/' ? target.routeBasePath : ''
  return Promise.all(
    (await walkMdx(sourceDir))
      // Docusaurus skips `_`-prefixed partials.
      .filter(
        file =>
          !toPosix(path.relative(sourceDir, file))
            .split('/')
            .some(segment => segment.startsWith('_')),
      )
      .map(file => loadPage(docsRoot, sourceDir, routeBase, file)),
  )
}

/** Checks the links of every page of one site; its sections (targets) can link to each other. */
function checkSiteLinks(pages: SyncedPage[]): Finding[] {
  const findings: Finding[] = []
  const byRoute = new Map(pages.map(page => [page.route, page]))
  const byPath = new Map(pages.map(page => [page.file.path, page]))
  for (const page of pages) {
    if (page.parseError) {
      findings.push(
        finding('mastra/external-mdx-parse', `MDX parse error: ${page.parseError.reason}`, {
          file: page.file.path,
          line: page.parseError.line ?? undefined,
          column: page.parseError.column ?? undefined,
        }),
      )
    }
    findings.push(...checkPageLinks(page, byRoute, byPath))
  }
  return findings
}

async function checkSidebar(target: Target, pages: SyncedPage[], repoRoot: string, docsRoot: string) {
  const findings: Finding[] = []
  const sourceDir = path.join(repoRoot, target.source)
  const sidebarPath = path.join(sourceDir, 'sidebars.js')
  const sidebarFile = toPosix(path.relative(docsRoot, sidebarPath))
  let sidebarIds: Set<string>
  try {
    sidebarIds = await loadSidebarIds(sidebarPath)
  } catch (error) {
    findings.push(
      finding(
        'mastra/external-sidebar-invalid',
        `${target.name}: cannot load ${sidebarFile}: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
        { file: sidebarFile },
      ),
    )
    return findings
  }
  const docIds = new Set(pages.map(page => page.docId))
  for (const page of pages) {
    if (!sidebarIds.has(page.docId)) {
      findings.push(
        finding('mastra/external-sidebar-unlinked-page', `Page \`${page.docId}\` is not linked in ${sidebarFile}`, {
          file: page.file.path,
        }),
      )
    }
  }
  for (const id of sidebarIds) {
    if (!docIds.has(id)) {
      findings.push(
        finding('mastra/external-sidebar-missing-doc', `Sidebar doc \`${id}\` has no page in ${target.source}`, {
          file: sidebarFile,
        }),
      )
    }
  }
  return findings
}

/**
 * Validates every docs directory listed in the sync manifest: links resolve to synced pages, anchors to headings,
 * and the directory's `sidebars.js` matches its pages. A missing manifest means there is nothing to check.
 */
export async function checkExternalDocs(options: {
  repoRoot: string
  docsRoot: string
  manifestPath: string
}): Promise<Finding[]> {
  const { repoRoot, docsRoot } = options
  const manifestFile = toPosix(path.relative(docsRoot, options.manifestPath))
  let raw: string
  try {
    raw = await fs.readFile(options.manifestPath, 'utf-8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }

  // The sync script is the source of truth for manifest rules. It is ESM with top-level await, so it can't be
  // required from tsx's CJS output.
  const { validateManifest } = await import('../../../../.github/scripts/sync-docs.mjs')
  let manifest: unknown
  try {
    manifest = JSON.parse(raw)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return [finding('mastra/external-manifest-invalid', `Not valid JSON: ${reason}`, { file: manifestFile })]
  }
  let targets: Target[]
  try {
    targets = validateManifest(manifest, { rootDir: repoRoot }) as Target[]
  } catch (error) {
    const lines = (error instanceof Error ? error.message : String(error)).split('\n')
    const problems = lines.length > 1 ? lines.slice(1).map(line => line.trim()) : lines
    return problems.map(problem => finding('mastra/external-manifest-invalid', problem, { file: manifestFile }))
  }

  const pagesByTarget = await Promise.all(targets.map(target => loadTargetPages(target, repoRoot, docsRoot)))
  const findings: Finding[] = []
  for (const repo of new Set(targets.map(target => target.repo))) {
    findings.push(...checkSiteLinks(targets.flatMap((target, i) => (target.repo === repo ? pagesByTarget[i] : []))))
  }
  for (const [i, target] of targets.entries()) {
    findings.push(...(await checkSidebar(target, pagesByTarget[i], repoRoot, docsRoot)))
  }
  return findings
}

export const externalDocsCheck: Check = {
  name: 'external-docs',
  categories: ['links', 'sidebar'],
  scope: 'repo',
  async run(ctx) {
    const findings = await checkExternalDocs({
      repoRoot: path.resolve(ctx.rootDir, '..'),
      docsRoot: ctx.rootDir,
      manifestPath: manifestPath(ctx.rootDir),
    })
    return { findings }
  },
}
