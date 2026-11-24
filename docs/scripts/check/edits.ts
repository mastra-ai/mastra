import fs from 'fs/promises'
import type { ContentFile } from './types'

export interface TextEdit {
  /** Offsets into `ContentFile.source`. */
  start: number
  end: number
  text: string
  ruleId: string
}

/** Applies non-overlapping edits to a file's source, writes it to disk, and updates `file.source`. */
export async function applyEdits(file: ContentFile, edits: TextEdit[]): Promise<number> {
  const sorted = [...edits].sort((a, b) => b.start - a.start)
  let source = file.source
  let applied = 0
  let lastStart = Infinity
  for (const edit of sorted) {
    if (edit.end > lastStart) continue
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end)
    lastStart = edit.start
    applied++
  }
  if (applied > 0) {
    await fs.writeFile(file.absolutePath, source)
    file.source = source
  }
  return applied
}
