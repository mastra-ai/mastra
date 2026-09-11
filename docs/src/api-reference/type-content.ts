import { safeCommentUrl } from './comments'
import type { ApiType } from './model'
import type { CommentNode } from './presentation'

export function typeContent(type: ApiType | undefined, destinations: ReadonlyMap<string, string>): CommentNode[] {
  if (!type) return []
  const names = new Map<string, string>()
  const ambiguous = new Set<string>()
  function collect(current: ApiType) {
    const target = current.target
    const href = target ? destinations.get(target.id) : undefined
    if (target && href) {
      if (names.has(target.name) && names.get(target.name) !== href) ambiguous.add(target.name)
      names.set(target.name, href)
    }
    for (const operand of current.operands) collect(operand.type)
  }
  collect(type)
  const parts: CommentNode[] = []
  let position = 0
  for (const match of type.display.matchAll(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|[$\p{ID_Start}][$\u200c\u200d\p{ID_Continue}]*/gu,
  )) {
    if (/^["'`]/.test(match[0]) || /^\??\s*:/.test(type.display.slice(match.index + match[0].length))) continue
    const href = names.get(match[0])
    if (!href || ambiguous.has(match[0])) continue
    if (match.index > position) parts.push({ kind: 'text', value: type.display.slice(position, match.index) })
    parts.push({ kind: 'link', href: safeCommentUrl(href), children: [{ kind: 'text', value: match[0] }] })
    position = match.index + match[0].length
  }
  if (position < type.display.length) parts.push({ kind: 'text', value: type.display.slice(position) })
  return parts
}
