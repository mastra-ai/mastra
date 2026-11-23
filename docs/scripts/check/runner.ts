import path from 'path'
import { formatCheck } from './checks/format'
import { frontmatterCheck } from './checks/frontmatter'
import { mdxCheck } from './checks/mdx'
import { redirectsCheck } from './checks/redirects'
import { sidebarCheck } from './checks/sidebar'
import { valeCheck } from './checks/vale'
import { CONTENT_ROOT, CONTENT_SECTIONS, loadAllContentFiles, loadContentFile, toPosix } from './content'
import { finding } from './finding'
import { matchesRuleFilter, RULE_FAMILIES, RULES } from './rules'
import { isSuppressed, parseSuppressions } from './suppress'
import {
  CATEGORIES,
  type Category,
  type Check,
  type CheckContext,
  type CheckResult,
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

/** Invalid invocation (bad arguments), as opposed to a crash in a check. */
export class UsageError extends Error {}

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
  const ignoredArgs: string[] = []
  if (scoped) {
    const relative = [
      ...new Set(options.files!.map(file => toPosix(path.relative(rootDir, path.resolve(rootDir, file))))),
    ]
    const content = relative.filter(isContentPath)
    ignoredArgs.push(...relative.filter(file => !isContentPath(file)))
    if (content.length === 0) {
      throw new UsageError(
        `None of the file arguments are docs content pages (src/content/en/**/*.mdx): ${relative.join(', ')}`,
      )
    }
    files = await Promise.all(content.map(file => loadContentFile(rootDir, file)))
  } else {
    files = await allFiles()
  }

  const ruleSelected = (ruleId: string) => rules.length === 0 || rules.some(filter => matchesRuleFilter(ruleId, filter))
  const suppressions = new Map(files.map(file => [file.path, parseSuppressions(file)]))
  const suppressed = (ruleId: string, file?: string, line?: number) => {
    const entry = file === undefined ? undefined : suppressions.get(file)
    return entry !== undefined && isSuppressed(entry, ruleId, line)
  }

  const findings: Finding[] = []
  if (categories.includes('structure') && ruleSelected('mastra/lint-comment-invalid')) {
    for (const file of files) {
      for (const { id, line } of suppressions.get(file.path)!.invalid) {
        findings.push(
          finding('mastra/lint-comment-invalid', `Unknown rule ID in lint comment: ${id}`, { file: file.path, line }),
        )
      }
    }
  }
  const skipped: SkippedCheck[] = ignoredArgs.map(file => ({
    check: 'files',
    reason: `${file} is not a docs content page (src/content/en/**/*.mdx), so it was not checked`,
  }))
  const selected = CHECKS.filter(
    check =>
      check.categories.some(category => categories.includes(category)) &&
      !(check.scope === 'files' && files.length === 0) &&
      // Vale is slow, so skip it when no --rule filter can select a Vale rule.
      !(
        check === valeCheck &&
        (options.skipVale || (rules.length > 0 && !rules.some(filter => couldMatchPrefix(filter, 'mastra/vale-'))))
      ),
  )
  const fix = options.fix ?? false
  const ctx: CheckContext = {
    rootDir,
    files,
    scoped,
    fix,
    categories,
    allFiles,
    isRuleActive: (ruleId, file, line) => ruleSelected(ruleId) && !suppressed(ruleId, file?.path, line),
  }
  // Checks overlap their subprocesses (Vale, oxfmt) with in-process parsing. With --fix they run one at a time
  // because the formatter and link fixes write the same files.
  const results: CheckResult[] = []
  if (fix) for (const check of selected) results.push(await check.run(ctx))
  else results.push(...(await Promise.all(selected.map(check => check.run(ctx)))))

  let fixed = 0
  for (const result of results) {
    fixed += result.fixed ?? 0
    skipped.push(...(result.skipped ?? []))
    for (const item of result.findings) {
      // Vale only runs when a filter can select a Vale rule, and when it can't start, none of those rules were checked.
      const selected = item.ruleId === 'mastra/vale-unavailable' || ruleSelected(item.ruleId)
      if (!categories.includes(item.category) || !selected) continue
      if (suppressed(item.ruleId, item.file, item.line)) continue
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
      checks: selected.map(check => check.name),
      skipped,
      durationMs: Date.now() - started,
    },
    findings,
  }
}
