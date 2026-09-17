export const apiTypeKinds = [
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
] as const

export type ApiTypeKind = (typeof apiTypeKinds)[number]

export const referenceBoundaries = ['data', 'service', 'external', 'type-parameter'] as const
export const commentPartKinds = ['text', 'code', 'inline-tag'] as const
export const diagnosticCodes = ['unresolved-link', 'unsupported-tag', 'unmapped-external'] as const

export interface ApiSource {
  path: string
  line: number
  character: number
}

export interface ApiReference {
  id: string
  name: string
  boundary: (typeof referenceBoundaries)[number]
  reason?: string
  source?: ApiSource
  canonical?: string
}

export interface ApiType {
  kind: ApiTypeKind
  display: string
  attributes: Record<string, string | number | boolean>
  operands: { role: string; type: ApiType }[]
  target?: ApiReference
  declaration?: string
}

export interface ApiCommentPart {
  kind: (typeof commentPartKinds)[number]
  text: string
  tag?: string
  target?: string
  targetSource?: ApiSource
}

export interface ApiComment {
  summary: ApiCommentPart[]
  tags: { name: string; parameter?: string; content: ApiCommentPart[] }[]
  modifiers: string[]
}

export interface ApiDeclaration {
  id: string
  name: string
  kind: string
  source?: ApiSource
  flags: string[]
  comment?: ApiComment
  type?: ApiType
  defaultType?: ApiType
  defaultValue?: string
  sourceSignature?: string
  sourceType?: string
  /** The `sourceType` annotation writes out its own object body rather than naming a declared type. */
  sourceTypeBody?: true
  children: string[]
  signatures: string[]
  parameters: string[]
  typeParameters: string[]
  indexSignatures: string[]
}

export interface ApiDiagnostic {
  code: (typeof diagnosticCodes)[number]
  owner: string
  message: string
}

export interface ApiContract {
  version: 1
  root: string
  declarations: Record<string, ApiDeclaration>
  diagnostics: ApiDiagnostic[]
}
