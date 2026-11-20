import { execFile } from 'child_process'
import fs from 'fs/promises'
import path from 'path'
import { promisify } from 'util'
import { CONTENT_ROOT } from '../content'
import { finding } from '../finding'
import type { Check, CheckResult, ContentFile, Finding } from '../types'

const execFileAsync = promisify(execFile)

/** Sections formatted by `format:mdx`. Generated model pages are excluded. */
export const FORMATTED_SECTIONS = ['docs', 'integrations', 'reference']

export function isFormattedFile(file: Pick<ContentFile, 'path' | 'section'>): boolean {
  return file.path.startsWith(`${CONTENT_ROOT}/`) && FORMATTED_SECTIONS.includes(file.section)
}

type FormatMdx = (source: string, options?: Record<string, unknown>, filePath?: string) => Promise<string>

async function loadFormatter(rootDir: string): Promise<{ formatMdx: FormatMdx; options: Record<string, unknown> }> {
  const mod = (await import('@mastra/lint-docs/oxfmt-mdx')) as { formatMdx: FormatMdx }
  // Same option handling as the oxfmt-mdx CLI: drop keys that only apply to file selection.
  const options = JSON.parse(await fs.readFile(path.join(rootDir, '.oxfmtrc.json'), 'utf-8')) as Record<string, unknown>
  delete options.$schema
  delete options.ignorePatterns
  delete options.overrides
  return { formatMdx: mod.formatMdx, options }
}

/** Runs `oxfmt` on non-MDX files and returns the paths that need formatting. */
async function oxfmtUnformatted(rootDir: string): Promise<string[]> {
  const bin = path.join(rootDir, 'node_modules', '.bin', 'oxfmt')
  try {
    await execFileAsync(bin, ['--check', '.'], { cwd: rootDir, maxBuffer: 16 * 1024 * 1024 })
    return []
  } catch (error) {
    const err = error as { code?: number | string; stdout?: string; stderr?: string }
    if (typeof err.code !== 'number') throw error
    const output = `${err.stdout ?? ''}\n${err.stderr ?? ''}`
    // oxfmt lists each unformatted file as `path (12ms)`; summary lines don't match.
    const files = output
      .split('\n')
      .map(line => line.trim().match(/^(\S+\.\w+) \(\d+m?s\)$/)?.[1])
      .filter((file): file is string => file !== undefined)
    if (files.length === 0) {
      throw new Error(`oxfmt --check failed with exit code ${err.code}: ${output.trim().split('\n')[0]}`)
    }
    return files
  }
}

export const formatCheck: Check = {
  name: 'format',
  categories: ['format'],
  scope: 'files',
  async run(ctx): Promise<CheckResult> {
    const findings: Finding[] = []
    const result: CheckResult = { findings, fixed: 0 }
    const fixFormat = ctx.fix && ctx.isRuleActive('mastra/format')
    const { formatMdx, options } = await loadFormatter(ctx.rootDir)

    for (const file of ctx.files.filter(isFormattedFile)) {
      if (ctx.fix && !ctx.isRuleActive('mastra/format', file)) continue
      const raw = await fs.readFile(file.absolutePath, 'utf-8')
      let formatted: string
      try {
        formatted = await formatMdx(raw, options, file.path)
      } catch (error) {
        findings.push(
          finding(
            'mastra/format',
            `Formatter failed: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
            { file: file.path },
            { fixable: false },
          ),
        )
        continue
      }
      if (formatted === raw) continue
      if (fixFormat) {
        await fs.writeFile(file.absolutePath, formatted)
        result.fixed!++
      } else {
        findings.push(
          finding('mastra/format', 'File is not formatted; run `pnpm check --fix --rule mastra/format`', {
            file: file.path,
          }),
        )
      }
    }

    // Non-MDX files (config, scripts, components) are repo-wide and only checked on unscoped runs.
    if (!ctx.scoped) {
      if (fixFormat) {
        const before = await oxfmtUnformatted(ctx.rootDir)
        if (before.length > 0) {
          await execFileAsync(path.join(ctx.rootDir, 'node_modules', '.bin', 'oxfmt'), ['.'], { cwd: ctx.rootDir })
          result.fixed! += before.length
        }
      } else {
        for (const file of await oxfmtUnformatted(ctx.rootDir)) {
          findings.push(
            finding('mastra/format', 'File is not formatted; run `pnpm check --fix --rule mastra/format`', { file }),
          )
        }
      }
    }
    return result
  },
}
