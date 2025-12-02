import { AliasNode } from '../operation-node/alias-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { OperationNode } from '../operation-node/operation-node.js';
/**
 * `Expression` represents an arbitrary SQL expression with a type.
 *
 * Most Kysely methods accept instances of `Expression` and most classes like `SelectQueryBuilder`
 * and the return value of the {@link sql} template tag implement it.
 *
 * ### Examples
 *
 * ```ts
 * import { type Expression, sql } from 'kysely'
 *
 * const exp1: Expression<string> = sql<string>`CONCAT('hello', ' ', 'world')`
 * const exp2: Expression<{ first_name: string }> = db.selectFrom('person').select('first_name')
 * ```
 *
 * You can implement the `Expression` interface to create your own type-safe utilities for Kysely.
 */
export interface Expression<T> extends OperationNodeSource {
    /**
     * All expressions need to have this getter for complicated type-related reasons.
     * Simply add this getter for your expression and always return `undefined` from it:
     *
     * ### Examples
     *
     * ```ts
     * import { type Expression, type OperationNode, sql } from 'kysely'
     *
     * class SomeExpression<T> implements Expression<T> {
     *   get expressionType(): T | undefined {
     *     return undefined
     *   }
     *
     *   toOperationNode(): OperationNode {
     *     return sql`some sql here`.toOperationNode()
     *   }
     * }
     * ```
     *
     * The getter is needed to make the expression assignable to another expression only
     * if the types `T` are assignable. Without this property (or some other property
     * that references `T`), you could assing `Expression<string>` to `Expression<number>`.
     */
    get expressionType(): T | undefined;
    /**
     * Creates the OperationNode that describes how to compile this expression into SQL.
     *
     * ### Examples
     *
     * If you are creating a custom expression, it's often easiest to use the {@link sql}
     * template tag to build the node:
     *
     * ```ts
     * import { type Expression, type OperationNode, sql } from 'kysely'
     *
     * class SomeExpression<T> implements Expression<T> {
     *   get expressionType(): T | undefined {
     *     return undefined
     *   }
     *
     *   toOperationNode(): OperationNode {
     *     return sql`some sql here`.toOperationNode()
     *   }
     * }
     * ```
     */
    toOperationNode(): OperationNode;
}
/**
 * An expression with an `as` method.
 */
export interface AliasableExpression<T> extends Expression<T> {
    /**
     * Returns an aliased version of the expression.
     *
     * ### Examples
     *
     * In addition to slapping `as "the_alias"` at the end of the expression,
     * this method also provides strict typing:
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select((eb) =>
     *     // `eb.fn<string>` returns an AliasableExpression<string>
     *     eb.fn<string>('concat', ['first_name', eb.val(' '), 'last_name']).as('full_name')
     *   )
     *   .executeTakeFirstOrThrow()
     *
     * // `full_name: string` field exists in the result type.
     * console.log(result.full_name)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select
     *   concat("first_name", $1, "last_name") as "full_name"
     * from
     *   "person"
     * ```
     *
     * You can also pass in a raw SQL snippet (or any expression) but in that case you must
     * provide the alias as the only type argument:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const values = sql<{ a: number, b: string }>`(values (1, 'foo'))`
     *
     * // The alias is `t(a, b)` which specifies the column names
     * // in addition to the table name. We must tell kysely that
     * // columns of the table can be referenced through `t`
     * // by providing an explicit type argument.
     * const aliasedValues = values.as<'t'>(sql`t(a, b)`)
     *
     * await db
     *   .insertInto('person')
     *   .columns(['first_name', 'last_name'])
     *   .expression(
     *     db.selectFrom(aliasedValues).select(['t.a', 't.b'])
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * insert into "person" ("first_name", "last_name")
     * from (values (1, 'foo')) as t(a, b)
     * select "t"."a", "t"."b"
     * ```
     */
    as<A extends string>(alias: A): AliasedExpression<T, A>;
    as<A extends string>(alias: Expression<any>): AliasedExpression<T, A>;
}
/**
 * A type that holds an expression and an alias for it.
 *
 * `AliasedExpression<T, A>` can be used in places where, in addition to the value type `T`, you
 * also need a name `A` for that value. For example anything you can pass into the `select` method
 * needs to implement an `AliasedExpression<T, A>`. `A` becomes the name of the selected expression
 * in the result and `T` becomes its type.
 *
 * ### Examples
 *
 * ```ts
 * import {
 *   AliasNode,
 *   type AliasedExpression,
 *   type Expression,
 *   IdentifierNode
 * } from 'kysely'
 *
 * class SomeAliasedExpression<T, A extends string> implements AliasedExpression<T, A> {
 *   #expression: Expression<T>
 *   #alias: A
 *
 *   constructor(expression: Expression<T>, alias: A) {
 *     this.#expression = expression
 *     this.#alias = alias
 *   }
 *
 *   get expression(): Expression<T> {
 *     return this.#expression
 *   }
 *
 *   get alias(): A {
 *     return this.#alias
 *   }
 *
 *   toOperationNode(): AliasNode {
 *     return AliasNode.create(
 *       this.#expression.toOperationNode(),
 *       IdentifierNode.create(this.#alias)
 *     )
 *   }
 * }
 * ```
 */
export interface AliasedExpression<T, A extends string> extends OperationNodeSource {
    /**
     * Returns the aliased expression.
     */
    get expression(): Expression<T>;
    /**
     * Returns the alias.
     */
    get alias(): A | Expression<unknown>;
    /**
     * Creates the OperationNode that describes how to compile this expression into SQL.
     */
    toOperationNode(): AliasNode;
}
export declare function isExpression(obj: unknown): obj is Expression<any>;
export declare function isAliasedExpression(obj: unknown): obj is AliasedExpression<any, any>;
