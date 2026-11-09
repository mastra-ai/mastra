import path from 'path'
import { formatCheck } from './checks/format'
import { frontmatterCheck } from './checks/frontmatter'
import { mdxCheck } from './checks/mdx'
import { redirectsCheck } from './checks/redirects'
import { sidebarCheck } from './checks/sidebar'
import { valeCheck } from './checks/vale'
import { CONTENT_ROOT, CONTENT_SECTIONS, loadAllContentFiles, loadContentFile, toPosix } from './content'
import { matchesRuleFilter, RULE_FAMILIES, RULES } from './rules'
import {
  CATEGORIES,
  type Category,
  type Check,
  type CheckReport,
  type ContentFile,
  type Finding,
  type SkippedCheck,
} from './types'

export const CHECKS: Check[] = [frontmatterCheck, sidebarCheck, mdxCheck, valeCheck, formatCheck, redirectsCheck]

export interface RunOptions {
  rootDir: string
  /** Files to check, relative to `rootDir` or absolute. Empty means every content file. */
  files?: string[]
  categories?: Category[]
  rules?: string[]
  fix?: boolean
  /** Skip Vale (for example in CI jobs that run it on changed files only). */
  skipVale?: boolean
}

function isContentPath(relativePath: string): boolean {
  return (
    CONTENT_SECTIONS.some(section => relativePath.startsWith(`${CONTENT_ROOT}/${section.name}/`)) &&
    relativePath.endsWith('.mdx')
  )
}

/** True when a `--rule` filter can match some rule ID starting with `prefix`. */
function couldMatchPrefix(filter: string, prefix: string): boolean {
  if (filter.startsWith(prefix)) return true
  return filter.endsWith('*') && prefix.startsWith(filter.slice(0, -1))
}

export async function runChecks(options: RunOptions): Promise<CheckReport> {
  const started = Date.now()
  const { rootDir } = options
  const rules = options.rules ?? []
  // Only run checks that can report a selected rule.
  const ruleCategories = new Set(
    [
      ...RULES.filter(rule => rules.some(filter => matchesRuleFilter(rule.id, filter))),
      ...RULE_FAMILIES.filter(family => rules.some(filter => couldMatchPrefix(filter, family.id.slice(0, -1)))),
    ].map(rule => rule.category),
  )
  const categories = (options.categories?.length ? options.categories : [...CATEGORIES]).filter(
    category => rules.length === 0 || ruleCategories.has(category),
  )
  const scoped = (options.files?.length ?? 0) > 0

  let allFilesPromise: Promise<ContentFile[]> | undefined
  const allFiles = () => (allFilesPromise ??= loadAllContentFiles(rootDir))

  let files: ContentFile[]
  if (scoped) {
    const relative = [
      ...new Set(options.files!.map(file => toPosix(path.relative(rootDir, path.resolve(rootDir, file))))),
    ]
    files = await Promise.all(relative.filter(isContentPath).map(file => loadContentFile(rootDir, file)))
  } else {
    files = await allFiles()
  }

  const ruleSelected = (ruleId: string) => rules.length === 0 || rules.some(filter => matchesRuleFilter(ruleId, filter))
  const disabledFor = (ruleId: string, file?: ContentFile) =>
    file !== undefined && file.lintDisable.some(id => matchesRuleFilter(ruleId, id))
  const filesByPath = new Map(files.map(file => [file.path, file]))

  const findings: Finding[] = []
  const skipped: SkippedCheck[] = []
  const ran: string[] = []
  let fixed = 0

  for (const check of CHECKS) {
    if (!check.categories.some(category => categories.includes(category))) continue
    if (check === valeCheck && options.skipVale) continue
    // Vale is slow, so skip it when no --rule filter can select a Vale rule.
    if (check === valeCheck && rules.length > 0 && !rules.some(filter => couldMatchPrefix(filter, 'mastra/vale-')))
      continue
    if (check.scope === 'files' && files.length === 0) continue
    ran.push(check.name)
    const result = await check.run({
      rootDir,
      files,
      scoped,
      fix: options.fix ?? false,
      categories,
      allFiles,
      isRuleActive: (ruleId, file) => ruleSelected(ruleId) && !disabledFor(ruleId, file),
    })
    fixed += result.fixed ?? 0
    skipped.push(...(result.skipped ?? []))
    for (const item of result.findings) {
      if (!categories.includes(item.category) || !ruleSelected(item.ruleId)) continue
      // lintDisable never hides an invalid lintDisable entry.
      if (
        item.ruleId !== 'mastra/lint-disable-invalid' &&
        disabledFor(item.ruleId, item.file ? filesByPath.get(item.file) : undefined)
      )
        continue
      findings.push(item)
    }
  }

  findings.sort(
    (a, b) =>
      (a.file ?? '').localeCompare(b.file ?? '') ||
      (a.line ?? 0) - (b.line ?? 0) ||
      (a.column ?? 0) - (b.column ?? 0) ||
      a.ruleId.localeCompare(b.ruleId),
  )

  const count = (severity: Finding['severity']) => findings.filter(f => f.severity === severity).length
  const errors = count('error')
  return {
    version: 1,
    summary: {
      ok: errors === 0,
      status: errors > 0 ? 'failed' : skipped.length > 0 ? 'partial' : 'passed',
      errors,
      warnings: count('warn'),
      info: count('info'),
      fixable: findings.filter(f => f.fixable).length,
      fixed,
      filesChecked: files.length,
      checks: ran,
      skipped,
      durationMs: Date.now() - started,
    },
    findings,
  }
}
