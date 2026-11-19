import type { Root } from 'mdast'
import { remark } from 'remark'
import type { ContentFile } from './types'

export interface LintMessage {
  ruleId?: string | null
  source?: string | null
  reason: string
  line?: number | null
  column?: number | null
  fatal?: boolean | null
}

export interface ParsedMdx {
  tree: Root
  /** Messages reported by the remark-lint preset. */
  lintMessages: LintMessage[]
}

type Preset = { plugins: unknown[] }

let presetPromise: Promise<Preset> | undefined

function loadPreset(): Promise<Preset> {
  // The preset is ESM-only; a dynamic import keeps this module loadable from tsx's CJS output.
  presetPromise ??= import('@mastra/lint-docs/remark-preset').then(mod => (mod.default ?? mod) as Preset)
  return presetPromise
}

const cache = new WeakMap<ContentFile, Promise<ParsedMdx>>()

// Generated model pages embed a ~1,500-line `models={[...]}` prop. No rule inspects it, and acorn parsing it took
// ~20s of a full run, so blank it out. Keeping newlines keeps every line and offset unchanged.
const MODEL_TABLE = /^<ProviderModelsTable\b[\s\S]*?^\/>$/gm
const sourceForLint = (file: ContentFile) =>
  file.section === 'models' ? file.source.replace(MODEL_TABLE, block => block.replace(/[^\n]/g, ' ')) : file.source

/** Parses an MDX file with the docs remark preset and runs its lint rules. Results are cached per file. */
export function parseMdx(file: ContentFile): Promise<ParsedMdx> {
  let parsed = cache.get(file)
  if (!parsed) {
    parsed = loadPreset().then(
      preset =>
        new Promise<ParsedMdx>((resolve, reject) => {
          const processor = remark().use(preset as never)
          const input = { path: file.absolutePath, value: sourceForLint(file) }
          let tree: Root
          try {
            tree = processor.parse(input) as Root
          } catch (error) {
            // MDX syntax errors surface as a single fatal lint message.
            const err = error as {
              reason?: string
              message: string
              line?: number
              column?: number
              place?: { line?: number; column?: number }
            }
            resolve({
              tree: { type: 'root', children: [] },
              lintMessages: [
                {
                  ruleId: 'mdx-parse',
                  reason: err.reason ?? err.message,
                  line: err.line ?? err.place?.line,
                  column: err.column ?? err.place?.column,
                  fatal: true,
                },
              ],
            })
            return
          }
          processor.run(tree, input, (error, _tree, vfile) => {
            if (error) reject(error)
            else resolve({ tree, lintMessages: (vfile?.messages ?? []) as LintMessage[] })
          })
        }),
    )
    cache.set(file, parsed)
  }
  return parsed
}
