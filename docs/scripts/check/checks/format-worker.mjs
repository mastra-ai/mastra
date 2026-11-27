// Formats a share of the MDX files for the format check. Plain JS so a worker thread can load it without tsx.
import fs from 'fs/promises'
import { parentPort, workerData } from 'worker_threads'
import { formatMdx } from '@mastra/lint-docs/oxfmt-mdx'

/** @type {{ files: { path: string, absolutePath: string }[], options: Record<string, unknown> }} */
const { files, options } = workerData
const results = []
for (const file of files) {
  const raw = await fs.readFile(file.absolutePath, 'utf-8')
  try {
    const formatted = await formatMdx(raw, options, file.path)
    results.push({ path: file.path, raw, formatted })
  } catch (error) {
    results.push({ path: file.path, error: error instanceof Error ? error.message.split('\n')[0] : String(error) })
  }
}
parentPort.postMessage(results)
