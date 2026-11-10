import path from 'path'
import { fileURLToPath } from 'url'
import { isDirectRun } from '../is-direct-run'
import { runChecks, UsageError, type RunOptions } from './runner'
import { CATEGORIES, type Category, type CheckReport, type Finding } from './types'

const USAGE = `Usage: pnpm check [options] [files...]

Runs every docs check and reports findings with stable rule IDs.

Options:
  --format <human|json> Output format (default: human). --json is shorthand for --format json
  --fix                 Apply safe fixes (formatting, sidebar sort, link rewrites, generated redirects)
  --rule <id>           Only report this rule. Repeatable. A trailing * matches a prefix: --rule 'mastra/sidebar-*'
  --only <category>     Only run this category. Repeatable. Alias: --category. One of: ${CATEGORIES.join(', ')}
  --quiet               Only print errors
  --no-vale             Skip Vale
  -h, --help            Show this help

With file arguments, file-level checks only look at those MDX files. Sidebar and redirect checks always run repo-wide.
Exits 1 when any error is reported, 0 otherwise. Warnings never fail the command.`

export interface CliOptions extends Omit<RunOptions, 'rootDir'> {
  json: boolean
  quiet: boolean
  help: boolean
}

export function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    quiet: false,
    help: false,
    fix: false,
    files: [],
    rules: [],
    categories: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    const value = () => {
      const [, inline] = arg.split(/=(.*)/s)
      if (inline !== undefined) return inline
      const next = argv[++i]
      if (next === undefined) throw new Error(`${arg} needs a value`)
      return next
    }
    if (arg === '--json') options.json = true
    else if (arg === '--format' || arg.startsWith('--format=')) {
      const format = value()
      if (format !== 'json' && format !== 'human') throw new Error(`Unknown format "${format}". Use human or json`)
      options.json = format === 'json'
    } else if (arg === '--fix') options.fix = true
    else if (arg === '--quiet' || arg === '-q') options.quiet = true
    else if (arg === '--no-vale') options.skipVale = true
    else if (arg === '--help' || arg === '-h') options.help = true
    else if (arg === '--rule' || arg.startsWith('--rule=')) options.rules!.push(...value().split(','))
    else if (arg === '--only' || arg.startsWith('--only=') || arg === '--category' || arg.startsWith('--category=')) {
      for (const category of value().split(',')) {
        if (!CATEGORIES.includes(category as Category)) {
          throw new Error(`Unknown category "${category}". Use one of: ${CATEGORIES.join(', ')}`)
        }
        options.categories!.push(category as Category)
      }
    } else if (arg.startsWith('-')) throw new Error(`Unknown option ${arg}`)
    else options.files!.push(arg)
  }
  return options
}

const COLORS = { error: '\x1b[31m', warn: '\x1b[33m', info: '\x1b[36m', dim: '\x1b[2m', reset: '\x1b[0m' }

export function formatHuman(report: CheckReport, { quiet = false, color = false } = {}): string {
  const paint = (key: keyof typeof COLORS, text: string) => (color ? `${COLORS[key]}${text}${COLORS.reset}` : text)
  const shown = quiet ? report.findings.filter(f => f.severity === 'error') : report.findings
  const lines: string[] = []

  const groups = new Map<string, Finding[]>()
  for (const item of shown) {
    const key = item.file ?? '(repository)'
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  for (const [file, items] of groups) {
    lines.push(file)
    for (const item of items) {
      const location = item.line ? `${item.line}:${item.column ?? 1}` : ''
      const fix = item.fixable ? paint('dim', ' (fixable)') : ''
      lines.push(
        `  ${location.padEnd(8)} ${paint(item.severity, item.severity.padEnd(7))} ${item.message}  ${paint('dim', item.ruleId)}${fix}`,
      )
      if (item.suggestion) lines.push(`  ${''.padEnd(8)} ${''.padEnd(7)} ${paint('dim', `→ ${item.suggestion}`)}`)
    }
    lines.push('')
  }

  const { summary } = report
  for (const skip of summary.skipped) lines.push(paint('warn', `Skipped ${skip.check}: ${skip.reason}`))
  const parts = [
    `${summary.errors} error${summary.errors === 1 ? '' : 's'}`,
    `${summary.warnings} warning${summary.warnings === 1 ? '' : 's'}`,
  ]
  if (summary.info) parts.push(`${summary.info} info`)
  if (summary.fixed) parts.push(`${summary.fixed} fixed`)
  const status = summary.ok ? paint('info', '✓') : paint('error', '✖')
  lines.push(
    `${status} ${parts.join(', ')} in ${summary.filesChecked} files (${(summary.durationMs / 1000).toFixed(1)}s)`,
  )
  if (summary.fixable && !summary.fixed)
    lines.push(paint('dim', `${summary.fixable} finding(s) can be fixed with --fix`))
  return lines.join('\n')
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let options: CliOptions
  try {
    options = parseArgs(argv)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    console.error(USAGE)
    return 2
  }
  if (options.help) {
    console.log(USAGE)
    return 0
  }

  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  // pnpm runs scripts from the package root; resolve file arguments against the caller's directory.
  const cwd = process.env.INIT_CWD ?? process.cwd()
  const files = options.files!.map(file => path.resolve(cwd, file))
  let report: Awaited<ReturnType<typeof runChecks>>
  try {
    report = await runChecks({ ...options, rootDir, files })
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    console.error(error.message)
    return 2
  }

  if (options.json) console.log(JSON.stringify(report, null, 2))
  else console.log(formatHuman(report, { quiet: options.quiet, color: process.stdout.isTTY }))
  return report.summary.ok ? 0 : 1
}

if (isDirectRun(import.meta.url)) {
  main().then(
    code => {
      process.exitCode = code
    },
    error => {
      console.error(error)
      process.exitCode = 2
    },
  )
}
