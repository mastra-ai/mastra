import { safeCommentUrl } from './comments'
import type { ApiDeclaration, ApiType } from './model'
import type { CommentNode } from './presentation'

export function isObjectType(
  type: ApiType | undefined,
  declarations: Readonly<Record<string, ApiDeclaration>>,
  seen = new Set<string>(),
): boolean {
  if (!type) return false
  if (
    type.kind === 'reference' &&
    type.target?.boundary === 'external' &&
    type.target.id === 'typescript:lib/lib.es5.d.ts:Partial' &&
    type.operands.length === 1 &&
    type.operands[0].role === 'argument:0'
  ) {
    return isObjectType(type.operands[0].type, declarations, seen)
  }
  if (type.kind === 'intersection')
    return type.operands.length > 0 && type.operands.every(operand => isObjectType(operand.type, declarations, seen))
  const id =
    type.kind === 'reflection'
      ? type.declaration
      : type.kind === 'reference' && type.target?.boundary === 'data'
        ? type.target.id
        : undefined
  if (!id || seen.has(id)) return false
  const declaration = declarations[id]
  if (!declaration || declaration.signatures.length || declaration.indexSignatures.length) return false
  const visited = new Set(seen).add(id)
  if (declaration.type) return isObjectType(declaration.type, declarations, visited)
  return declaration.kind === 'TypeLiteral' || declaration.kind === 'Interface'
}

export function typeContent(
  type: ApiType | undefined,
  destinations: ReadonlyMap<string, string>,
  compact = false,
  structuralLabels: ReadonlyMap<string, string> = new Map(),
  declarations: Readonly<Record<string, ApiDeclaration>> = {},
): CommentNode[] {
  if (!type) return []
  function render(current: ApiType, parentPrecedence = 0): CommentNode[] {
    if (compact && current.kind === 'reflection' && current.declaration && isObjectType(current, declarations)) {
      const href = destinations.get(current.declaration)
      if (href)
        return [
          {
            kind: 'link',
            href: safeCommentUrl(href),
            children: [{ kind: 'text', value: structuralLabels.get(current.declaration) ?? 'object' }],
          },
        ]
    }
    if (compact && (current.kind === 'intersection' || current.kind === 'union')) {
      const precedence = current.kind === 'union' ? 1 : 2
      const content = current.operands.flatMap((operand, index): CommentNode[] => {
        const separator: CommentNode[] = index
          ? [{ kind: 'text', value: current.kind === 'union' ? ' | ' : ' & ' }]
          : []
        return [...separator, ...render(operand.type, precedence)]
      })
      return precedence < parentPrecedence
        ? [{ kind: 'text', value: '(' }, ...content, { kind: 'text', value: ')' }]
        : content
    }
    if (compact && current.kind === 'array' && current.operands.length === 1)
      return [...render(current.operands[0].type, 3), { kind: 'text', value: '[]' }]
    return linkedDisplay(current, destinations)
  }
  return render(type)
}

function linkedDisplay(type: ApiType, destinations: ReadonlyMap<string, string>): CommentNode[] {
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
