import { isKnownRuleId, matchesRuleFilter } from './rules'
import type { ContentFile } from './types'

/**
 * Inline suppression comments, using remark-message-control's syntax inside MDX comments:
 *
 *   {/* lint disable mastra/bare-url *\/}   off until a matching `enable` (or end of file)
 *   {/* lint enable mastra/bare-url *\/}
 *   {/* lint ignore mastra/bare-url *\/}    off for the next block only
 *
 * Without rule IDs a comment applies to every rule. A `disable` placed before any body content
 * also covers the frontmatter, so it works for frontmatter rules and findings without a line.
 */
const COMMENT = /\{\s*\/\*\s*lint\s+(disable|enable|ignore)\b([\s\S]*?)\*\/\s*\}/g
const FENCE = /^\s*(`{3,}|~{3,})/

interface Range {
  ids: string[] | null
  start: number
  end: number
}

export interface Suppressions {
  ranges: Range[]
  invalid: { id: string; line: number }[]
}

export function parseSuppressions(file: ContentFile): Suppressions {
  const lines = file.source.split('\n')
  const ranges: Range[] = []
  const invalid: Suppressions['invalid'] = []
  const open: { ids: string[] | null; start: number }[] = []
  let fence: string | null = null
  let seenContent = false

  const nextBlockEnd = (from: number): number => {
    let i = from
    while (i < lines.length && lines[i].trim() === '') i++
    const opening = lines[i]?.match(FENCE)
    if (opening) {
      for (let j = i + 1; j < lines.length; j++) if (lines[j].trim().startsWith(opening[1])) return j + 1
      return lines.length
    }
    while (i < lines.length && lines[i].trim() !== '') i++
    return i
  }

  for (let i = file.bodyStartLine - 1; i < lines.length; i++) {
    const text = lines[i]
    const marker = text.match(FENCE)
    if (fence) {
      if (marker && marker[1].startsWith(fence)) fence = null
      continue
    }
    if (marker) {
      fence = marker[1]
      seenContent = true
      continue
    }

    const line = i + 1
    let rest = text
    for (const match of text.matchAll(COMMENT)) {
      const kind = match[1]
      const raw = match[2]
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
      for (const id of raw) if (!isKnownRuleId(id)) invalid.push({ id, line })
      const ids = raw.length === 0 ? null : raw.filter(isKnownRuleId)
      rest = rest.replace(match[0], '')

      if (kind === 'ignore') {
        ranges.push({ ids, start: line, end: nextBlockEnd(i + 1) })
      } else if (kind === 'disable') {
        open.push({ ids, start: seenContent ? line : 1 })
      } else {
        for (let k = open.length - 1; k >= 0; k--) {
          const entry = open[k]
          const closes = ids === null || entry.ids === null || entry.ids.some(id => ids.includes(id))
          if (!closes) continue
          ranges.push({ ids: entry.ids, start: entry.start, end: line })
          open.splice(k, 1)
        }
      }
    }
    if (rest.trim() !== '') seenContent = true
  }
  for (const entry of open) ranges.push({ ids: entry.ids, start: entry.start, end: Number.POSITIVE_INFINITY })
  return { ranges, invalid }
}

/** True when `ruleId` is suppressed at `line`. Findings without a line are only covered by file-wide disables. */
export function isSuppressed(suppressions: Suppressions, ruleId: string, line?: number): boolean {
  return suppressions.ranges.some(
    range =>
      (line === undefined
        ? range.start === 1 && range.end === Number.POSITIVE_INFINITY
        : line >= range.start && line <= range.end) &&
      (range.ids === null || range.ids.some(id => matchesRuleFilter(ruleId, id))),
  )
}
