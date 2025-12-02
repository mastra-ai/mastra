import { Value, NumericValue } from "../values/index.js";
import {
  DocumentByInfo,
  FieldPaths,
  FieldTypeFromFieldPath,
  GenericTableInfo,
} from "./data_model.js";

/**
 * Expressions are evaluated to produce a {@link values.Value} in the course of executing a query.
 *
 * To construct an expression, use the {@link FilterBuilder} provided within
 * {@link OrderedQuery.filter}.
 *
 * @typeParam T - The type that this expression evaluates to.
 * @public
 */
export abstract class Expression<T extends Value | undefined> {
  // Property for nominal type support.
  private _isExpression: undefined;

  // Property to distinguish expressions by the type they resolve to.
  private _value!: T;

  /**
   * @internal
   */
  constructor() {
    // only defining the constructor so we can mark it as internal and keep
    // it out of the docs.
  }
}
/**
 * An {@link Expression} or a constant {@link values.Value}
 *
 * @public
 */
export type ExpressionOrValue<T extends Value | undefined> = Expression<T> | T;

/**
 * An interface for defining filters in queries.
 *
 * `FilterBuilder` has various methods that produce {@link Expression}s.
 * These expressions can be nested together along with constants to express
 * a filter predicate.
 *
 * `FilterBuilder` is used within {@link OrderedQuery.filter} to create query
 * filters.
 *
 * Here are the available methods:
 *
 * |                               |                                               |
 * |-------------------------------|-----------------------------------------------|
 * | **Comparisons**               | Error when `l` and `r` are not the same type. |
 * | [`eq(l, r)`](#eq)             | `l === r`                                     |
 * | [`neq(l, r)`](#neq)           | `l !== r`                                     |
 * | [`lt(l, r)`](#lt)             | `l < r`                                       |
 * | [`lte(l, r)`](#lte)           | `l <= r`                                      |
 * | [`gt(l, r)`](#gt)             | `l > r`                                       |
 * | [`gte(l, r)`](#gte)           | `l >= r`                                      |
 * |                               |                                               |
 * | **Arithmetic**                | Error when `l` and `r` are not the same type. |
 * | [`add(l, r)`](#add)           | `l + r`                                       |
 * | [`sub(l, r)`](#sub)           | `l - r`                                       |
 * | [`mul(l, r)`](#mul)           | `l * r`                                       |
 * | [`div(l, r)`](#div)           | `l / r`                                       |
 * | [`mod(l, r)`](#mod)           | `l % r`                                       |
 * | [`neg(x)`](#neg)              | `-x`                                          |
 * |                               |                                               |
 * | **Logic**                     | Error if any param is not a `bool`.           |
 * | [`not(x)`](#not)              | `!x`                                          |
 * | [`and(a, b, ..., z)`](#and)   | `a && b && ... && z`                          |
 * | [`or(a, b, ..., z)`](#or)     | <code>a &#124;&#124; b &#124;&#124; ... &#124;&#124; z</code> |
 * |                               |                                               |
 * | **Other**                     |                                               |
 * | [`field(fieldPath)`](#field)  | Evaluates to the field at `fieldPath`.        |
 * @public
 */
export interface FilterBuilder<TableInfo extends GenericTableInfo> {
  //  Comparisons  /////////////////////////////////////////////////////////////

  /**
   * `l === r`
   *
   * @public
   * */
  eq<T extends Value | undefined>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<boolean>;

  /**
   * `l !== r`
   *
   * @public
   * */
  neq<T extends Value | undefined>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<boolean>;

  /**
   * `l < r`
   *
   * @public
   */
  lt<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<boolean>;

  /**
   * `l <= r`
   *
   * @public
   */
  lte<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<boolean>;

  /**
   * `l > r`
   *
   * @public
   */
  gt<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<boolean>;

  /**
   * `l >= r`
   *
   * @public
   */
  gte<T extends Value>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<boolean>;

  //  Arithmetic  //////////////////////////////////////////////////////////////

  /**
   * `l + r`
   *
   * @public
   */
  add<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<T>;

  /**
   * `l - r`
   *
   * @public
   */
  sub<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<T>;

  /**
   * `l * r`
   *
   * @public
   */
  mul<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<T>;

  /**
   * `l / r`
   *
   * @public
   */
  div<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<T>;

  /**
   * `l % r`
   *
   * @public
   */
  mod<T extends NumericValue>(
    l: ExpressionOrValue<T>,
    r: ExpressionOrValue<T>,
  ): Expression<T>;

  /**
   * `-x`
   *
   * @public
   */
  neg<T extends NumericValue>(x: ExpressionOrValue<T>): Expression<T>;

  //  Logic  ///////////////////////////////////////////////////////////////////

  /**
   * `exprs[0] && exprs[1] && ... && exprs[n]`
   *
   * @public
   */
  and(...exprs: Array<ExpressionOrValue<boolean>>): Expression<boolean>;

  /**
   * `exprs[0] || exprs[1] || ... || exprs[n]`
   *
   * @public
   */
  or(...exprs: Array<ExpressionOrValue<boolean>>): Expression<boolean>;

  /**
   * `!x`
   *
   * @public
   */
  not(x: ExpressionOrValue<boolean>): Expression<boolean>;

  //  Other  ///////////////////////////////////////////////////////////////////

  /**
   * Evaluates to the field at the given `fieldPath`.
   *
   * For example, in {@link OrderedQuery.filter} this can be used to examine the values being filtered.
   *
   * #### Example
   *
   * On this object:
   * ```
   * {
   *   "user": {
   *     "isActive": true
   *   }
   * }
   * ```
   *
   * `field("user.isActive")` evaluates to `true`.
   *
   * @public
   */
  field<FieldPath extends FieldPaths<TableInfo>>(
    fieldPath: FieldPath,
  ): Expression<FieldTypeFromFieldPath<DocumentByInfo<TableInfo>, FieldPath>>;
}
