import * as v from 'valibot'
import type { ApiContract, ApiType } from './model'

const identity = v.pipe(v.string(), v.minLength(1))
const source = v.strictObject({
  path: v.pipe(v.string(), v.regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)[^:]+$/)),
  line: v.pipe(v.number(), v.integer(), v.minValue(1)),
  character: v.pipe(v.number(), v.integer(), v.minValue(0)),
})
const reference = v.strictObject({
  id: identity,
  name: identity,
  boundary: v.picklist(['data', 'service', 'external', 'type-parameter']),
  reason: v.optional(identity),
  source: v.optional(source),
  canonical: v.optional(v.pipe(v.string(), v.startsWith('/'))),
})

export const apiTypeSchema: v.GenericSchema<ApiType> = v.lazy(() =>
  v.strictObject({
    kind: v.picklist([
      'array',
      'conditional',
      'indexedAccess',
      'inferred',
      'intersection',
      'intrinsic',
      'literal',
      'mapped',
      'namedTupleMember',
      'optional',
      'predicate',
      'query',
      'reference',
      'reflection',
      'rest',
      'templateLiteral',
      'tuple',
      'typeOperator',
      'union',
    ]),
    display: v.string(),
    attributes: v.record(v.string(), v.union([v.string(), v.number(), v.boolean()])),
    operands: v.array(v.strictObject({ role: identity, type: apiTypeSchema })),
    target: v.optional(reference),
    declaration: v.optional(identity),
  }),
)

const part = v.strictObject({
  kind: v.picklist(['text', 'code', 'inline-tag']),
  text: v.string(),
  tag: v.optional(v.string()),
  target: v.optional(v.string()),
})
const declaration = v.strictObject({
  id: identity,
  name: identity,
  kind: identity,
  source: v.optional(source),
  flags: v.array(identity),
  comment: v.optional(
    v.strictObject({
      summary: v.array(part),
      tags: v.array(v.strictObject({ name: identity, parameter: v.optional(v.string()), content: v.array(part) })),
      modifiers: v.array(identity),
    }),
  ),
  type: v.optional(apiTypeSchema),
  defaultType: v.optional(apiTypeSchema),
  defaultValue: v.optional(v.string()),
  children: v.array(identity),
  signatures: v.array(identity),
  parameters: v.array(identity),
  typeParameters: v.array(identity),
  indexSignatures: v.array(identity),
})

export const apiContractSchema: v.GenericSchema<ApiContract> = v.pipe(
  v.strictObject({
    version: v.literal(1),
    root: identity,
    declarations: v.record(identity, declaration),
    diagnostics: v.array(
      v.strictObject({
        code: v.picklist(['unresolved-link', 'unsupported-tag', 'unmapped-external']),
        owner: identity,
        message: v.string(),
      }),
    ),
  }),
  v.check(contract => {
    const has = (id: string) => Object.hasOwn(contract.declarations, id)
    const typeIsClosed = (type: ApiType): boolean =>
      (!type.declaration || has(type.declaration)) &&
      (type.target?.boundary !== 'data' || has(type.target.id)) &&
      type.operands.every(operand => typeIsClosed(operand.type))
    return (
      has(contract.root) &&
      Object.entries(contract.declarations).every(
        ([id, node]) =>
          id === node.id &&
          [
            ...node.children,
            ...node.signatures,
            ...node.parameters,
            ...node.typeParameters,
            ...node.indexSignatures,
          ].every(has) &&
          (!node.type || typeIsClosed(node.type)) &&
          (!node.defaultType || typeIsClosed(node.defaultType)),
      )
    )
  }, 'API contract contains an unresolved owned declaration or mismatched identity'),
)

export function parseContract(value: unknown): ApiContract {
  return v.parse(apiContractSchema, value)
}
