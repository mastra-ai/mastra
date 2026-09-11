export type ApiTypeKind =
  | 'array'
  | 'conditional'
  | 'indexedAccess'
  | 'inferred'
  | 'intersection'
  | 'intrinsic'
  | 'literal'
  | 'mapped'
  | 'namedTupleMember'
  | 'optional'
  | 'predicate'
  | 'query'
  | 'reference'
  | 'reflection'
  | 'rest'
  | 'templateLiteral'
  | 'tuple'
  | 'typeOperator'
  | 'union'

export interface ApiSource {
  path: string
  line: number
  character: number
}

export interface ApiReference {
  id: string
  name: string
  boundary: 'data' | 'service' | 'external' | 'type-parameter'
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
  kind: 'text' | 'code' | 'inline-tag'
  text: string
  tag?: string
  target?: string
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
  children: string[]
  signatures: string[]
  parameters: string[]
  typeParameters: string[]
  indexSignatures: string[]
}

export interface ApiDiagnostic {
  code: 'unresolved-link' | 'unsupported-tag' | 'unmapped-external'
  owner: string
  message: string
}

export interface ApiContract {
  version: 1
  root: string
  declarations: Record<string, ApiDeclaration>
  diagnostics: ApiDiagnostic[]
}
