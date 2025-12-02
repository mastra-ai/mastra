import type { TypesMap, NamedKinds } from './staticTypes'

export type Strictness = 'cst' | 'smart' | 'ast' | 'relaxed' | 'signature'

export interface PatternObject<M extends TypesMap = TypesMap> {
  context: string
  selector?: NamedKinds<M> // only named node types
  strictness?: Strictness
}

export type PatternStyle<M extends TypesMap = TypesMap> =
  | string
  | PatternObject<M>

export interface Relation<M extends TypesMap = TypesMap> extends Rule<M> {
  /**
   * Specify how relational rule will stop relative to the target node.
   */
  stopBy?: 'neighbor' | 'end' | Rule<M>
  /** Specify the tree-sitter field in parent node. Only available in has/inside rule. */
  field?: string
}

export interface NthChildObject<M extends TypesMap = TypesMap> {
  /** The position in nodes' sibling list. It can be a number of An+B string */
  position: string | number
  ofRule?: Rule<M>
  reverse?: boolean
}

/**
 * NthChild can have these types:
 * * number: the position of the node in the sibling list.
 * * string: An + B style string like CSS nth-child selector.
 * * object: An object with `position` and `ofRule` fields.
 */
export type NthChild<M extends TypesMap = TypesMap> =
  | number
  | string
  | NthChildObject<M>

export interface Position {
  /** 0-indexed line number. */
  line: number
  /** 0-indexed column number. */
  column: number
}

export interface Range {
  start: Position
  end: Position
}

export interface Rule<M extends TypesMap = TypesMap> {
  /** A pattern string or a pattern object. */
  pattern?: PatternStyle<M>
  /** The kind name of the node to match. You can look up code's kind names in playground. */
  kind?: NamedKinds<M>
  /** The exact range of the node in the source code. */
  range?: Range
  /** A Rust regular expression to match the node's text. https://docs.rs/regex/latest/regex/#syntax */
  regex?: string
  /**
   * `nthChild` accepts number, string or object.
   * It specifies the position in nodes' sibling list. */
  nthChild?: NthChild<M>

  // relational
  /**
   * `inside` accepts a relational rule object.
   * the target node must appear inside of another node matching the `inside` sub-rule. */
  inside?: Relation<M>
  /**
   * `has` accepts a relational rule object.
   * the target node must has a descendant node matching the `has` sub-rule. */
  has?: Relation<M>
  /**
   * `precedes` accepts a relational rule object.
   * the target node must appear before another node matching the `precedes` sub-rule. */
  precedes?: Relation<M>
  /**
   * `follows` accepts a relational rule object.
   * the target node must appear after another node matching the `follows` sub-rule. */
  follows?: Relation<M>
  // composite
  /**
   * A list of sub rules and matches a node if all of sub rules match.
   * The meta variables of the matched node contain all variables from the sub-rules. */
  all?: Array<Rule<M>>
  /**
   * A list of sub rules and matches a node if any of sub rules match.
   * The meta variables of the matched node only contain those of the matched sub-rule. */
  any?: Array<Rule<M>>
  /** A single sub-rule and matches a node if the sub rule does not match. */
  not?: Rule<M>
  /** A utility rule id and matches a node if the utility rule matches. */
  matches?: string
}
