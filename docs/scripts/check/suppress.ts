import { isKnownRulePattern, matchesRuleFilter } from './rules'
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
const FENCE_CLOSE = /^\s*(`{3,}|~{3,})\s*$/

/** CommonMark: same fence character, at least as long as the opener, nothing but whitespace after. */
function closesFence(text: string, opener: string): boolean {
  const match = text.match(FENCE_CLOSE)
  return match !== null && match[1][0] === opener[0] && match[1].length >= opener.length
}

interface Range {
  /** Suppressed rule IDs, or `null` for every rule. */
  ids: string[] | null
  /** With `ids: null`, rules re-enabled by a later `lint enable <ids>`. */
  except?: string[]
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
  const open: Omit<Range, 'end'>[] = []
  let fence: string | null = null
  let seenContent = false

  const nextBlockEnd = (from: number): number => {
    let i = from
    while (i < lines.length && lines[i].trim() === '') i++
    const opening = lines[i]?.match(FENCE)
    if (opening) {
      for (let j = i + 1; j < lines.length; j++) if (closesFence(lines[j], opening[1])) return j + 1
      return lines.length
    }
    while (i < lines.length && lines[i].trim() !== '') i++
    return i
  }

  for (let i = file.bodyStartLine - 1; i < lines.length; i++) {
    const text = lines[i]
    const marker = text.match(FENCE)
    if (fence) {
      if (closesFence(text, fence)) fence = null
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
      for (const id of raw) if (!isKnownRulePattern(id)) invalid.push({ id, line })
      const ids = raw.length === 0 ? null : raw.filter(isKnownRulePattern)
      rest = rest.replace(match[0], '')

      if (kind === 'ignore') {
        ranges.push({ ids, start: line, end: nextBlockEnd(i + 1) })
      } else if (kind === 'disable') {
        open.push({ ids, start: seenContent ? line : 1 })
      } else {
        for (let k = open.length - 1; k >= 0; k--) {
          const entry = open[k]
          if (ids !== null && entry.ids !== null && !entry.ids.some(id => ids.includes(id))) continue
          ranges.push({ ...entry, end: line })
          open.splice(k, 1)
          // A partial enable keeps the other rules of the disable off from here on.
          if (ids === null) continue
          if (entry.ids === null) {
            open.splice(k, 0, { ids: null, except: [...(entry.except ?? []), ...ids], start: line })
          } else {
            const remaining = entry.ids.filter(id => !ids.includes(id))
            if (remaining.length > 0) open.splice(k, 0, { ids: remaining, start: line })
          }
        }
      }
    }
    if (rest.trim() !== '') seenContent = true
  }
  for (const entry of open) ranges.push({ ...entry, end: Number.POSITIVE_INFINITY })
  return { ranges, invalid }
}

/** True when `ruleId` is suppressed at `line`. Findings without a line are only covered by file-wide disables. */
export function isSuppressed(suppressions: Suppressions, ruleId: string, line?: number): boolean {
  return suppressions.ranges.some(
    range =>
      (line === undefined
        ? range.start === 1 && range.end === Number.POSITIVE_INFINITY
        : line >= range.start && line <= range.end) &&
      (range.ids === null
        ? !range.except?.some(id => matchesRuleFilter(ruleId, id))
        : range.ids.some(id => matchesRuleFilter(ruleId, id))),
  )
}
