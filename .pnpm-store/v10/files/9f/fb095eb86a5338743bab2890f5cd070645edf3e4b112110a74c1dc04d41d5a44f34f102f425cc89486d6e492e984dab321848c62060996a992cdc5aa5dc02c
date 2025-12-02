import type {
  FieldNames,
  TypesInField,
  TypesMap,
  ExtractField,
  Kinds,
  NodeFieldInfo,
  RootKind,
  NamedKinds,
  ChildKinds,
  NamedChildKinds,
} from './staticTypes'
import type { NapiConfig } from './config'

export interface Edit {
  /** The start position of the edit */
  startPos: number
  /** The end position of the edit */
  endPos: number
  /** The text to be inserted */
  insertedText: string
}
export interface Pos {
  /** line number starting from 0 */
  line: number
  /** column number starting from 0 */
  column: number
  /** byte offset of the position */
  index: number
}
export interface Range {
  /** starting position of the range */
  start: Pos
  /** ending position of the range */
  end: Pos
}

export declare class SgNode<
  M extends TypesMap = TypesMap,
  out T extends Kinds<M> = Kinds<M>,
> {
  /** Returns the node's id */
  id(): number
  range(): Range
  isLeaf(): boolean
  isNamed(): boolean
  isNamedLeaf(): boolean
  text(): string
  matches(m: string | number | NapiConfig<M>): boolean
  inside(m: string | number | NapiConfig<M>): boolean
  has(m: string | number | NapiConfig<M>): boolean
  precedes(m: string | number | NapiConfig<M>): boolean
  follows(m: string | number | NapiConfig<M>): boolean
  /** Returns the string name of the node kind */
  kind(): T
  readonly kindToRefine: T
  /** Check if the node is the same kind as the given `kind` string */
  is<K extends T>(kind: K): this is SgNode<M, K>
  // we need this override to allow string literal union
  is(kind: string): boolean

  getMatch: NodeMethod<M, [mv: string]>
  getMultipleMatches(m: string): Array<SgNode<M>>
  getTransformed(m: string): string | null
  /** Returns the node's SgRoot */
  getRoot(): SgRoot<M>
  children(): Array<SgNode<M>>
  find: NodeMethod<M, [matcher: string | number | NapiConfig<M>]>
  findAll<K extends Kinds<M>>(
    matcher: string | number | NapiConfig<M>,
  ): Array<RefineNode<M, K>>
  /** Finds the first child node in the `field` */
  field<F extends FieldNames<M[T]>>(name: F): FieldNode<M, T, F>
  /** Finds all the children nodes in the `field` */
  fieldChildren<F extends FieldNames<M[T]>>(
    name: F,
  ): Exclude<FieldNode<M, T, F>, null>[]
  parent: NodeMethod<M>
  child(nth: number): SgNode<M, ChildKinds<M, T>> | null
  child<K extends NamedChildKinds<M, T>>(nth: number): RefineNode<M, K> | null
  ancestors(): Array<SgNode<M>>
  next: NodeMethod<M>
  nextAll(): Array<SgNode<M>>
  prev: NodeMethod<M>
  prevAll(): Array<SgNode<M>>
  replace(text: string): Edit
  commitEdits(edits: Array<Edit>): string
}
/** Represents the parsed tree of code. */
export declare class SgRoot<M extends TypesMap = TypesMap> {
  /** Returns the root SgNode of the ast-grep instance. */
  root(): SgNode<M, RootKind<M>>
  /**
   * Returns the path of the file if it is discovered by ast-grep's `findInFiles`.
   * Returns `"anonymous"` if the instance is created by `lang.parse(source)`.
   */
  filename(): string
}

interface NodeMethod<M extends TypesMap, Args extends unknown[] = []> {
  (...args: Args): SgNode<M> | null
  <K extends NamedKinds<M>>(...args: Args): RefineNode<M, K> | null
}

/**
 * if K contains string, return general SgNode. Otherwise,
 * if K is a literal union, return a union of SgNode of each kind.
 */
type RefineNode<M extends TypesMap, K> = string extends K
  ? SgNode<M>
  : K extends Kinds<M>
    ? SgNode<M, K>
    : never

/**
 * return the SgNode of the field in the node.
 */
// F extends string is used to prevent noisy TS hover info
type FieldNode<
  M extends TypesMap,
  K extends Kinds<M>,
  F extends FieldNames<M[K]>,
> = F extends string ? FieldNodeImpl<M, ExtractField<M[K], F>> : never

type FieldNodeImpl<M extends TypesMap, I extends NodeFieldInfo> = I extends {
  required: true
}
  ? RefineNode<M, TypesInField<M, I>>
  : RefineNode<M, TypesInField<M, I>> | null
