import { execFile } from 'child_process'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { promisify } from 'util'
import { Worker } from 'worker_threads'
import { CONTENT_ROOT } from '../content'
import { finding } from '../finding'
import type { Check, CheckResult, ContentFile, Finding } from '../types'

const execFileAsync = promisify(execFile)

/** Sections formatted by `format:mdx`. Generated model pages are excluded. */
export const FORMATTED_SECTIONS = ['docs', 'integrations', 'reference']

/** Pages generated from an OpenAPI document by scripts/gateway-api/generate.ts. */
export const GENERATED_API_PAGE = /\.api\.mdx$/

/** Authored pages. Generated pages only get link and description checks. */
export function isFormattedFile(file: Pick<ContentFile, 'path' | 'section'>): boolean {
  return (
    file.path.startsWith(`${CONTENT_ROOT}/`) &&
    FORMATTED_SECTIONS.includes(file.section) &&
    !GENERATED_API_PAGE.test(file.path)
  )
}

async function loadOptions(rootDir: string): Promise<Record<string, unknown>> {
  // Same option handling as the oxfmt-mdx CLI: drop keys that only apply to file selection.
  const options = JSON.parse(await fs.readFile(path.join(rootDir, '.oxfmtrc.json'), 'utf-8')) as Record<string, unknown>
  delete options.$schema
  delete options.ignorePatterns
  delete options.overrides
  return options
}

type FormatResult = { path: string; raw: string; formatted: string } | { path: string; error: string }

const FORMAT_WORKERS = Math.max(1, Math.min(8, os.availableParallelism()))
const MIN_FILES_PER_WORKER = 25

/**
 * Formats MDX files across worker threads. Formatting is CPU-bound remark work, and on the main thread it would
 * also block the MDX checks that run alongside it.
 */
async function formatFiles(files: ContentFile[], options: Record<string, unknown>): Promise<FormatResult[]> {
  const count = Math.min(FORMAT_WORKERS, Math.ceil(files.length / MIN_FILES_PER_WORKER))
  const chunks = Array.from({ length: count }, (_, i) =>
    files.filter((_, j) => j % count === i).map(file => ({ path: file.path, absolutePath: file.absolutePath })),
  )
  const results = await Promise.all(
    chunks.map(
      chunk =>
        new Promise<FormatResult[]>((resolve, reject) => {
          const worker = new Worker(new URL('./format-worker.mjs', import.meta.url), {
            workerData: { files: chunk, options },
          })
          worker.once('message', resolve)
          worker.once('error', reject)
          worker.once('exit', code => {
            if (code !== 0) reject(new Error(`Format worker exited with code ${code}`))
          })
        }),
    ),
  )
  return results.flat()
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
    const files = ctx.files.filter(
      file => isFormattedFile(file) && !(ctx.fix && !ctx.isRuleActive('mastra/format', file)),
    )
    const byPath = new Map(files.map(file => [file.path, file]))
    for (const item of files.length > 0 ? await formatFiles(files, await loadOptions(ctx.rootDir)) : []) {
      if ('error' in item) {
        findings.push(
          finding('mastra/format', `Formatter failed: ${item.error}`, { file: item.path }, { fixable: false }),
        )
        continue
      }
      if (item.formatted === item.raw) continue
      if (fixFormat) {
        await fs.writeFile(byPath.get(item.path)!.absolutePath, item.formatted)
        result.fixed!++
      } else {
        findings.push(
          finding('mastra/format', 'File is not formatted; run `pnpm check --fix --rule mastra/format`', {
            file: item.path,
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
