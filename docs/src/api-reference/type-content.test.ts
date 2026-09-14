import { expect, it } from 'vitest'
import type { ApiDeclaration, ApiType } from './model'
import { isObjectType, typeContent } from './type-content'

const shape: ApiDeclaration = {
  id: 'shape',
  name: '__type',
  kind: 'TypeLiteral',
  flags: [],
  children: [],
  signatures: [],
  parameters: [],
  typeParameters: [],
  indexSignatures: [],
}

const reference: ApiType = {
  kind: 'reference',
  display: 'Payload',
  attributes: {},
  operands: [],
  target: { id: 'payload', name: 'Payload', boundary: 'data' },
}
it('links structured references without changing type text or linking literals', () => {
  const type: ApiType = {
    kind: 'union',
    display: 'Payload | "Payload"',
    attributes: {},
    operands: [
      { role: '0', type: reference },
      { role: '1', type: { kind: 'literal', display: '"Payload"', operands: [], attributes: {} } },
    ],
  }
  expect(typeContent(type, new Map([['payload', '#api-payload']]))).toEqual([
    { kind: 'link', href: '#api-payload', children: [{ kind: 'text', value: 'Payload' }] },
    { kind: 'text', value: ' | "Payload"' },
  ])
  expect(typeContent(type, new Map())).toEqual([{ kind: 'text', value: type.display }])
})
it('links structural objects while preserving union and array operators and the unabridged contract', () => {
  const object: ApiType = {
    kind: 'reflection',
    display: '{ value: string }',
    declaration: 'shape',
    operands: [],
    attributes: {},
  }
  const union: ApiType = {
    kind: 'union',
    display: '{ value: string } | undefined',
    operands: [
      { role: '0', type: object },
      { role: '1', type: { kind: 'intrinsic', display: 'undefined', attributes: {}, operands: [] } },
    ],
    attributes: {},
  }
  const array: ApiType = {
    kind: 'array',
    display: '({ value: string } | undefined)[]',
    operands: [{ role: 'element', type: union }],
    attributes: {},
  }
  const result = typeContent(array, new Map([['shape', '#api-shape']]), true, new Map(), { shape })
  expect(result).toContainEqual({ kind: 'link', href: '#api-shape', children: [{ kind: 'text', value: 'object' }] })
  expect(
    result
      .filter(part => part.kind === 'text')
      .map(part => part.value)
      .join(''),
  ).toBe('( | undefined)[]')
  expect(object.display).toBe('{ value: string }')
  expect(typeContent(object, new Map(), true)).toEqual([{ kind: 'text', value: object.display }])
})

it('only summarizes proven non-callable objects, retaining unsupported and cyclic types verbatim', () => {
  const object: ApiType = {
    kind: 'reflection',
    display: '{ value: string }',
    declaration: 'shape',
    operands: [],
    attributes: {},
  }
  const alias: ApiType = { ...reference, target: { id: 'alias', name: 'Alias', boundary: 'data' } }
  const declarations = { shape, alias: { ...shape, id: 'alias', kind: 'TypeAlias', type: object } }
  expect(isObjectType(object, declarations)).toBe(true)
  expect(isObjectType(alias, declarations)).toBe(true)
  const partial: ApiType = {
    kind: 'reference',
    display: 'Partial<Alias>',
    attributes: {},
    operands: [{ role: 'argument:0', type: alias }],
    target: { id: 'typescript:lib/lib.es5.d.ts:Partial', name: 'Partial', boundary: 'external' },
  }
  expect(isObjectType(partial, declarations)).toBe(true)
  expect(
    isObjectType({ ...partial, target: { id: 'other:Partial', name: 'Partial', boundary: 'external' } }, declarations),
  ).toBe(false)
  expect(isObjectType(partial, {})).toBe(false)
  expect(isObjectType(partial, { ...declarations, shape: { ...shape, signatures: ['call'] } })).toBe(false)
  const intersection: ApiType = {
    kind: 'intersection',
    display: 'Alias & { value: string }',
    operands: [
      { role: '0', type: alias },
      { role: '1', type: object },
    ],
    attributes: {},
  }
  expect(isObjectType(intersection, declarations)).toBe(true)
  for (const unsupported of [
    { ...intersection, kind: 'union' as const },
    { ...object, kind: 'conditional' as const },
    { ...object, kind: 'intrinsic' as const, display: 'string' },
    { ...object, declaration: 'unresolved' },
    { ...alias, target: { id: 'alias', name: 'Alias', boundary: 'external' as const } },
  ])
    expect(isObjectType(unsupported, declarations)).toBe(false)
  expect(isObjectType(alias, { alias: { ...declarations.alias, type: alias } })).toBe(false)
  for (const unsafeShape of [
    { ...shape, signatures: ['call'] },
    { ...shape, indexSignatures: ['index'] },
  ]) {
    const callable = { ...object, display: '(value: string) => void' }
    expect(isObjectType(callable, { shape: unsafeShape })).toBe(false)
    expect(typeContent(callable, new Map([['shape', '#api-shape']]), true, new Map(), { shape: unsafeShape })).toEqual([
      { kind: 'text', value: callable.display },
    ])
  }
  expect(
    isObjectType(
      {
        ...intersection,
        operands: [...intersection.operands, { role: '2', type: { ...object, kind: 'intrinsic', display: 'string' } }],
      },
      declarations,
    ),
  ).toBe(false)
})

it('leaves ambiguous same-name declarations unlinked', () => {
  const other: ApiType = { ...reference, target: { id: 'other', name: 'Payload', boundary: 'data' } }
  const type: ApiType = {
    kind: 'union',
    display: 'Payload | Payload',
    attributes: {},
    operands: [
      { role: '0', type: reference },
      { role: '1', type: other },
    ],
  }
  expect(
    typeContent(
      type,
      new Map([
        ['payload', '#api-payload'],
        ['other', '#api-other'],
      ]),
    ),
  ).toEqual([{ kind: 'text', value: type.display }])
})
