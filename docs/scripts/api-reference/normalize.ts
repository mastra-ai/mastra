import path from 'node:path'
import {
  DeclarationReflection,
  ParameterReflection,
  Reflection,
  ReflectionKind,
  ReflectionSymbolId,
  SignatureReflection,
  TypeParameterReflection,
  makeRecursiveVisitor,
  type CommentDisplayPart,
  type ProjectReflection,
  type ReferenceType,
  type SomeType,
  type TypeVisitor,
} from 'typedoc'
import type {
  ApiCommentPart,
  ApiContract,
  ApiDeclaration,
  ApiReference,
  ApiSource,
  ApiType,
} from '../../src/api-reference/model'
import { parseContract } from '../../src/api-reference/schema'
import { canonicalDestinations, ownedPackages, repositoryRoot, serviceClassifications, symbolIdentity } from './config'

export function normalize(project: ProjectReflection, root: Reflection, rootId: string): ApiContract {
  const ids = new Map<Reflection, string>()
  const declarations: Record<string, ApiDeclaration> = {}
  const diagnostics: ApiContract['diagnostics'] = []
  const supportedTags = new Set([
    '@param',
    '@returns',
    '@example',
    '@deprecated',
    '@default',
    '@defaultValue',
    '@remarks',
    '@typeParam',
    '@see',
  ])

  function primaryId(reflection: Reflection): string {
    const symbol = project.getSymbolIdFromReflection(reflection)
    if (symbol?.packageName === '@mastra/core') {
      if (symbol.qualifiedName === 'Config' && symbol.packagePath === 'src/mastra/index.ts')
        return '@mastra/core!Config'
      if (symbol.qualifiedName === 'Agent' && symbol.packagePath === 'src/agent/agent.ts')
        return '@mastra/core/agent!Agent'
    }
    if (symbol) return symbolIdentity(symbol.packageName, symbol.packagePath, symbol.qualifiedName)
    throw new Error(`Missing stable identity for ${reflection.getFullName()}`)
  }

  function index(reflection: Reflection, id: string) {
    if (ids.has(reflection)) return
    ids.set(reflection, reflection === root ? rootId : id)
    const counts = new Map<string, number>()
    reflection.traverse((child, role) => {
      const key = `${role}/${child.name}`
      const ordinal = counts.get(key) ?? 0
      counts.set(key, ordinal + 1)
      const childId = reflection.kindOf(ReflectionKind.Project | ReflectionKind.Module | ReflectionKind.Namespace)
        ? primaryId(child)
        : `${ids.get(reflection)}/${key}/${ordinal}`
      index(child, childId)
    })
    let ordinal = 0
    const visitor = makeRecursiveVisitor({
      reflection(type) {
        index(type.declaration, `${ids.get(reflection)}/type/${ordinal++}`)
      },
    })
    if (
      reflection instanceof DeclarationReflection ||
      reflection instanceof SignatureReflection ||
      reflection instanceof ParameterReflection ||
      reflection instanceof TypeParameterReflection
    ) {
      reflection.type?.visit(visitor)
    }
    if (reflection instanceof TypeParameterReflection) reflection.default?.visit(visitor)
  }
  const primary = Object.values(project.reflections).filter(
    reflection =>
      reflection instanceof DeclarationReflection &&
      reflection.parent?.kindOf(ReflectionKind.Project | ReflectionKind.Module | ReflectionKind.Namespace),
  )
  primary.forEach(reflection => index(reflection, primaryId(reflection)))
  if (!ids.has(root)) index(root, rootId)

  function idOf(reflection: Reflection) {
    const id = ids.get(reflection)
    if (!id) throw new Error(`Unindexed declaration ${reflection.getFullName()}`)
    return id
  }
  function sourceOf(reflection: Reflection): ApiSource | undefined {
    const source = 'sources' in reflection && Array.isArray(reflection.sources) ? reflection.sources[0] : undefined
    if (!source) return undefined
    const relative = path.isAbsolute(source.fileName) ? path.relative(repositoryRoot, source.fileName) : source.fileName
    if (relative.startsWith('../')) return undefined
    return { path: relative.split(path.sep).join('/'), line: source.line, character: source.character }
  }
  function normalizePart(part: CommentDisplayPart, owner: string): ApiCommentPart {
    if (part.kind === 'text' || part.kind === 'code') return { kind: part.kind, text: part.text }
    if (part.kind === 'relative-link') {
      const resolved = part.target === undefined ? undefined : project.files.resolvePath(part.target)
      if (!resolved) diagnostics.push({ code: 'unresolved-link', owner, message: part.text })
      return { kind: 'text', text: part.text }
    }
    let target: string | undefined
    if (typeof part.target === 'string') target = part.target
    else if (part.target instanceof Reflection) target = ids.get(part.target) ?? primaryId(part.target)
    else if (part.target instanceof ReflectionSymbolId)
      target = symbolIdentity(part.target.packageName, part.target.packagePath, part.target.qualifiedName)
    if (part.tag.startsWith('@link') && !target)
      diagnostics.push({ code: 'unresolved-link', owner, message: part.text })
    return { kind: 'inline-tag', text: part.text, tag: part.tag, ...(target && { target }) }
  }

  function referenceOf(type: ReferenceType, owner: string): ApiReference {
    const reflection = type.reflection
    const symbol = type.symbolId ?? (reflection && project.getSymbolIdFromReflection(reflection))
    if (type.refersToTypeParameter || type.isIntentionallyBroken()) {
      return {
        id: reflection ? idOf(reflection) : `${owner}/generic/${type.name}`,
        name: type.name,
        boundary: 'type-parameter',
      }
    }
    const key = symbol && symbolIdentity(symbol.packageName, symbol.packagePath, symbol.qualifiedName)
    const reason = key && serviceClassifications.get(key)
    const id = reflection
      ? idOf(reflection)
      : (key ?? `${type.package ?? 'external'}!${type.qualifiedName || type.name}`)
    const source = reflection ? sourceOf(reflection) : undefined
    const canonical = canonicalDestinations.get(id)
    if (reason)
      return {
        id,
        name: type.name,
        boundary: 'service',
        reason,
        ...(source && { source }),
        ...(canonical && { canonical }),
      }
    if (symbol && ownedPackages.has(symbol.packageName)) {
      if (!reflection) throw new Error(`Required owned reference is unresolved: ${key}`)
      visit(reflection)
      return { id, name: type.name, boundary: 'data', ...(source && { source }), ...(canonical && { canonical }) }
    }
    if (!canonical)
      diagnostics.push({ code: 'unmapped-external', owner, message: `${type.package ?? 'external'}:${type.name}` })
    return { id, name: type.name, boundary: 'external', ...(canonical && { canonical }) }
  }

  function normalizeType(type: SomeType, owner: string): ApiType {
    const operands: ApiType['operands'] = []
    const attributes: ApiType['attributes'] = {}
    const add = (role: string, child: SomeType | undefined) => {
      if (child) operands.push({ role, type: normalizeType(child, owner) })
    }
    let target: ApiReference | undefined
    let declaration: string | undefined
    const visitor: TypeVisitor<void> = {
      array(t) {
        add('element', t.elementType)
      },
      optional(t) {
        add('element', t.elementType)
      },
      rest(t) {
        add('element', t.elementType)
      },
      conditional(t) {
        add('check', t.checkType)
        add('extends', t.extendsType)
        add('true', t.trueType)
        add('false', t.falseType)
      },
      indexedAccess(t) {
        add('object', t.objectType)
        add('index', t.indexType)
      },
      inferred(t) {
        attributes.name = t.name
        add('constraint', t.constraint)
      },
      intersection(t) {
        t.types.forEach((child, i) => add(`member:${i}`, child))
      },
      union(t) {
        t.types.forEach((child, i) => add(`member:${i}`, child))
      },
      intrinsic(t) {
        attributes.name = t.name
      },
      literal(t) {
        attributes.value = String(t.value)
        attributes.valueType = t.value === null ? 'null' : typeof t.value
      },
      mapped(t) {
        attributes.parameter = t.parameter
        if (t.optionalModifier) attributes.optional = t.optionalModifier
        if (t.readonlyModifier) attributes.readonly = t.readonlyModifier
        add('parameter', t.parameterType)
        add('template', t.templateType)
        add('name', t.nameType)
      },
      predicate(t) {
        attributes.name = t.name
        attributes.asserts = t.asserts
        add('target', t.targetType)
      },
      query(t) {
        add('query', t.queryType)
      },
      reference(t) {
        target = referenceOf(t, owner)
        t.typeArguments?.forEach((child, i) => add(`argument:${i}`, child))
      },
      reflection(t) {
        declaration = visit(t.declaration)
      },
      templateLiteral(t) {
        attributes.head = t.head
        t.tail.forEach(([child, text], i) => {
          add(`tail:${i}`, child)
          attributes[`tail:${i}`] = text
        })
      },
      tuple(t) {
        t.elements?.forEach((child, i) => add(`element:${i}`, child))
      },
      namedTupleMember(t) {
        attributes.name = t.name
        attributes.optional = t.isOptional
        add('element', t.element)
      },
      typeOperator(t) {
        attributes.operator = t.operator
        add('target', t.target)
      },
      unknown(t) {
        throw new Error(`Unsupported required type at ${owner}: ${t.toString()}`)
      },
    }
    if (type.type === 'unknown') throw new Error(`Unsupported required type at ${owner}: ${type.toString()}`)
    type.visit(visitor)
    return {
      kind: type.type,
      display: type.toString(),
      attributes,
      operands,
      ...(target && { target }),
      ...(declaration && { declaration }),
    }
  }

  function visit(reflection: Reflection): string {
    const id = idOf(reflection)
    if (Object.hasOwn(declarations, id)) return id
    const node: ApiDeclaration = {
      id,
      name: reflection.name,
      kind: ReflectionKind[reflection.kind],
      flags: [],
      children: [],
      signatures: [],
      parameters: [],
      typeParameters: [],
      indexSignatures: [],
    }
    declarations[id] = node
    const source = sourceOf(reflection)
    if (source) node.source = source
    for (const [name, enabled] of Object.entries(reflection.flags.toObject())) if (enabled) node.flags.push(name)
    node.flags.sort()
    if (reflection.comment) {
      node.comment = {
        summary: reflection.comment.summary.map(part => normalizePart(part, id)),
        tags: reflection.comment.blockTags.map(tag => {
          if (!supportedTags.has(tag.tag)) diagnostics.push({ code: 'unsupported-tag', owner: id, message: tag.tag })
          return {
            name: tag.tag,
            ...(tag.name && { parameter: tag.name }),
            content: tag.content.map(part => normalizePart(part, id)),
          }
        }),
        modifiers: [...reflection.comment.modifierTags].sort(),
      }
    }
    if (reflection instanceof DeclarationReflection) {
      node.children = reflection.children?.map(visit) ?? []
      node.signatures = [
        ...(reflection.signatures ?? []),
        ...(reflection.getSignature ? [reflection.getSignature] : []),
        ...(reflection.setSignature ? [reflection.setSignature] : []),
      ].map(visit)
      node.indexSignatures = reflection.indexSignatures?.map(visit) ?? []
      node.typeParameters = reflection.typeParameters?.map(visit) ?? []
      if (reflection.defaultValue !== undefined) node.defaultValue = reflection.defaultValue
    }
    if (reflection instanceof SignatureReflection) {
      node.parameters = reflection.parameters?.map(visit) ?? []
      node.typeParameters = reflection.typeParameters?.map(visit) ?? []
    }
    if (reflection instanceof ParameterReflection && reflection.defaultValue !== undefined)
      node.defaultValue = reflection.defaultValue
    if (
      reflection instanceof DeclarationReflection ||
      reflection instanceof SignatureReflection ||
      reflection instanceof ParameterReflection ||
      reflection instanceof TypeParameterReflection
    ) {
      if (reflection.type) node.type = normalizeType(reflection.type, id)
    }
    if (reflection instanceof TypeParameterReflection && reflection.default)
      node.defaultType = normalizeType(reflection.default, id)
    return id
  }
  visit(root)
  return parseContract({
    version: 1,
    root: rootId,
    declarations: Object.fromEntries(Object.entries(declarations).sort(([a], [b]) => a.localeCompare(b, 'en'))),
    diagnostics: diagnostics.sort((a, b) =>
      `${a.owner}:${a.code}:${a.message}`.localeCompare(`${b.owner}:${b.code}:${b.message}`, 'en'),
    ),
  })
}
