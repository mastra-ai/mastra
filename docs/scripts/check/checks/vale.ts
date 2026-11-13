import { execFile } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import { toPosix } from '../content'
import { finding } from '../finding'
import { slugifyRuleName } from '../rules'
import type { Check, CheckResult, Finding, Severity } from '../types'
import { isFormattedFile } from './format'

const execFileAsync = promisify(execFile)

interface ValeAlert {
  Check: string
  Message: string
  Severity: 'error' | 'warning' | 'suggestion'
  Line: number
  Span: [number, number]
}

const SEVERITY: Record<ValeAlert['Severity'], Severity> = { error: 'error', warning: 'warn', suggestion: 'info' }

/** The Vale binary from `pnpm vale:download`, or `vale` on PATH (as installed in CI). */
async function findVale(rootDir: string): Promise<string | undefined> {
  const local = path.join(rootDir, 'scripts', 'vale', 'bin', 'vale')
  try {
    await fs.access(local)
    return local
  } catch {}
  try {
    await execFileAsync('vale', ['--version'])
    return 'vale'
  } catch {
    return undefined
  }
}

export function valeFindings(rootDir: string, output: Record<string, ValeAlert[]>): Finding[] {
  const findings: Finding[] = []
  for (const [file, alerts] of Object.entries(output)) {
    const relative = toPosix(path.relative(rootDir, path.resolve(rootDir, file)))
    for (const alert of alerts) {
      findings.push(
        finding(
          `mastra/vale-${slugifyRuleName(alert.Check)}`,
          alert.Message,
          { file: relative, line: alert.Line, column: alert.Span[0] },
          {
            severity: SEVERITY[alert.Severity] ?? 'warn',
          },
        ),
      )
    }
  }
  return findings
}

export const valeCheck: Check = {
  name: 'vale',
  categories: ['prose'],
  scope: 'files',
  async run(ctx): Promise<CheckResult> {
    // Vale covers the same sections as remark and the formatter; generated model pages are excluded.
    const files = ctx.files.filter(isFormattedFile).map(file => file.path)
    if (files.length === 0) return { findings: [] }

    // A missing or broken Vale binary is an error, not a skip, so a run without Vale never looks green.
    const unavailable = (message: string): CheckResult => ({
      findings: [
        finding(
          'mastra/vale-unavailable',
          message,
          {},
          {
            suggestion: 'Run `pnpm vale:download`, or pass `--no-vale` to skip Vale on purpose',
          },
        ),
      ],
    })

    const vale = await findVale(ctx.rootDir)
    if (!vale) return unavailable('Vale is not installed, so prose was not checked')

    let stdout: string
    try {
      ;({ stdout } = await execFileAsync(vale, ['--output=JSON', '--minAlertLevel=warning', ...files], {
        cwd: ctx.rootDir,
        maxBuffer: 64 * 1024 * 1024,
      }))
    } catch (error) {
      // Vale exits 1 when it reports errors; the JSON is still on stdout.
      const err = error as { code?: number; stdout?: string; stderr?: string }
      if (err.code !== 1 || !err.stdout) {
        return unavailable(`Vale failed to run: ${(err.stderr || String(error)).trim().split('\n')[0]}`)
      }
      stdout = err.stdout
    }
    return { findings: valeFindings(ctx.rootDir, JSON.parse(stdout || '{}')) }
  },
}
