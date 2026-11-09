export type Severity = 'error' | 'warn' | 'info'

export const CATEGORIES = ['frontmatter', 'sidebar', 'structure', 'links', 'prose', 'format', 'redirects'] as const
export type Category = (typeof CATEGORIES)[number]

export interface Finding {
  /** Stable rule ID, always prefixed with `mastra/`. */
  ruleId: string
  severity: Severity
  category: Category
  message: string
  /** Path relative to the docs package root. Omitted for repository-wide findings. */
  file?: string
  line?: number
  column?: number
  fixable: boolean
  /** Extra guidance, such as the replacement a fix would apply. */
  suggestion?: string
}

export interface SkippedCheck {
  check: string
  reason: string
}

export interface Summary {
  ok: boolean
  /** `partial` when no errors were found but a check (usually Vale) was skipped. */
  status: 'passed' | 'failed' | 'partial'
  errors: number
  warnings: number
  info: number
  fixable: number
  /** Fixes applied by `--fix`. */
  fixed: number
  filesChecked: number
  checks: string[]
  skipped: SkippedCheck[]
  durationMs: number
}

export interface CheckReport {
  version: 1
  summary: Summary
  findings: Finding[]
}

export interface ContentFile {
  /** Path relative to the docs package root, e.g. `src/content/en/docs/index.mdx`. */
  path: string
  absolutePath: string
  /** Content section: `docs`, `integrations`, `reference`, or `models`. */
  section: string
  /** Normalized source text (LF line endings, no BOM). */
  source: string
  frontmatter: Record<string, unknown> | null
  frontmatterError?: { message: string; line?: number }
  /** Line where the MDX body starts (1-based). 1 when the file has no frontmatter. */
  bodyStartLine: number
}

export interface CheckContext {
  /** Absolute path to the docs package root. */
  rootDir: string
  /** MDX files in scope for file-level checks. */
  files: ContentFile[]
  /** True when the user passed explicit file arguments. */
  scoped: boolean
  fix: boolean
  /** Categories selected by `--category` (all categories when none were given). */
  categories: Category[]
  /** False when a rule is excluded by `--rule` filters or suppressed by an inline `lint` comment in `file` (at `line`, or file-wide). Fixes must check this. */
  isRuleActive: (ruleId: string, file?: ContentFile, line?: number) => boolean
  /** Lazily loads every MDX file in the content sections, regardless of scope. */
  allFiles: () => Promise<ContentFile[]>
}

export interface CheckResult {
  findings: Finding[]
  fixed?: number
  skipped?: SkippedCheck[]
}

export interface Check {
  name: string
  categories: Category[]
  /** File-level checks only look at `ctx.files`; repo-wide checks always see everything. */
  scope: 'files' | 'repo'
  run: (ctx: CheckContext) => Promise<CheckResult>
}
