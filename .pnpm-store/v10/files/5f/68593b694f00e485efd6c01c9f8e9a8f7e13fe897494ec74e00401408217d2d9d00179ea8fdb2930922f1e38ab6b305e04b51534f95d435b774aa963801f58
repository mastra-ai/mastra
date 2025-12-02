/**
 * Reference
 * https://tree-sitter.github.io/tree-sitter/using-parsers#static-node-types
 * Rust CLI Impl
 * https://github.com/tree-sitter/tree-sitter/blob/f279d10aa2aca37c0004d84b2261685739f3cab8/cli/generate/src/node_types.rs#L35-L47
 */

export interface NodeBasicInfo {
  type: string
  named: boolean
}

export interface NodeFieldInfo {
  multiple: boolean
  required: boolean
  types: NodeBasicInfo[]
}

export interface NodeType extends NodeBasicInfo {
  root?: boolean
  fields?: {
    [fieldName: string]: NodeFieldInfo
  }
  children?: NodeFieldInfo
  subtypes?: NodeBasicInfo[]
}

/**
 * A map of key to NodeType.
 * Note, the key is not necessary node's kind.
 * it can be a rule representing a category of syntax nodes
 * (e.g. “expression”, “type”, “declaration”).
 * See reference above for more details.
 */
export interface TypesMap {
  [key: string]: NodeType
}

export type FieldNames<N extends NodeType> = N extends { fields: infer F }
  ? keyof F
  : string

export type ExtractField<
  N extends NodeType,
  F extends FieldNames<N>,
> = N['fields'] extends Record<F, NodeFieldInfo>
  ? N['fields'][F]
  : NodeFieldInfo

// in case of empty types array, return string as fallback
type NoNever<T, Fallback> = [T] extends [never] ? Fallback : T

export type TypesInField<M extends TypesMap, I extends NodeFieldInfo> = NoNever<
  ResolveType<M, I['types'][number]['type']>,
  Kinds<M>
>

export type NamedChildKinds<
  M extends TypesMap,
  T extends Kinds<M>,
> = M[T] extends { children: infer C extends NodeFieldInfo }
  ? TypesInField<M, C>
  : NamedKinds<M>
export type ChildKinds<M extends TypesMap, T extends Kinds<M>> =
  | NamedChildKinds<M, T>
  | LowPriorityKey

/**
 * resolve subtypes alias. see tree-sitter's reference
 * e.g. like `expression` => `binary_expression` | `unary_expression` | ...
 */
type ResolveType<M extends TypesMap, K> = K extends keyof M
  ? M[K] extends { subtypes: infer S extends NodeBasicInfo[] }
    ? ResolveType<M, S[number]['type']>
    : K
  : K

/**
 * All named nodes' kinds that are usable in ast-grep rule
 * NOTE: SgNode can return kind not in this list
 */
export type NamedKinds<M extends TypesMap> = ResolveType<M, keyof M>

/**
 * See open-ended unions / string literal completion in TypeScript
 * https://github.com/microsoft/TypeScript/issues/26277
 * https://github.com/microsoft/TypeScript/issues/33471
 */
type LowPriorityKey = string & {}

/**
 * A union of all named node kinds and a low priority key
 * tree-sitter Kinds also include unnamed nodes which is not usable in rule
 * NOTE: SgNode can return a string type if it is not a named node
 */
export type Kinds<M extends TypesMap = TypesMap> =
  | NamedKinds<M>
  | LowPriorityKey

/**
 * The root node kind of the tree.
 */
export type RootKind<M extends TypesMap> = NoNever<
  Extract<M[keyof M], { root: true }>['type'],
  Kinds<M>
>