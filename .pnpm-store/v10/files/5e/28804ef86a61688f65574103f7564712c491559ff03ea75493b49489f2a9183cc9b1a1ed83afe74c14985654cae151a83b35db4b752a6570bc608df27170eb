import { AliasableExpression, AliasedExpression, Expression } from '../expression/expression.js';
import { AliasNode } from '../operation-node/alias-node.js';
import { JSONPathNode } from '../operation-node/json-path-node.js';
import { JSONReferenceNode } from '../operation-node/json-reference-node.js';
import { OperationNode } from '../operation-node/operation-node.js';
export declare class JSONPathBuilder<S, O = S> {
    #private;
    constructor(node: JSONReferenceNode | JSONPathNode);
    /**
     * Access an element of a JSON array in a specific location.
     *
     * Since there's no guarantee an element exists in the given array location, the
     * resulting type is always nullable. If you're sure the element exists, you
     * should use {@link SelectQueryBuilder.$assertType} to narrow the type safely.
     *
     * See also {@link key} to access properties of JSON objects.
     *
     * ### Examples
     *
     * ```ts
     * await db.selectFrom('person')
     *   .select(eb =>
     *     eb.ref('nicknames', '->').at(0).as('primary_nickname')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "nicknames"->0 as "primary_nickname" from "person"
     *```
     *
     * Combined with {@link key}:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('experience', '->').at(0).key('role').as('first_role')
     * )
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "experience"->0->'role' as "first_role" from "person"
     * ```
     *
     * You can use `'last'` to access the last element of the array in MySQL:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('nicknames', '->$').at('last').as('last_nickname')
     * )
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select `nicknames`->'$[last]' as `last_nickname` from `person`
     * ```
     *
     * Or `'#-1'` in SQLite:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('nicknames', '->>$').at('#-1').as('last_nickname')
     * )
     * ```
     *
     * The generated SQL (SQLite):
     *
     * ```sql
     * select "nicknames"->>'$[#-1]' as `last_nickname` from `person`
     * ```
     */
    at<I extends any[] extends O ? number | 'last' | `#-${number}` : never, O2 = null | NonNullable<NonNullable<O>[keyof NonNullable<O> & number]>>(index: `${I}` extends `${any}.${any}` | `#--${any}` ? never : I): TraversedJSONPathBuilder<S, O2>;
    /**
     * Access a property of a JSON object.
     *
     * If a field is optional, the resulting type will be nullable.
     *
     * See also {@link at} to access elements of JSON arrays.
     *
     * ### Examples
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('address', '->').key('city').as('city')
     * )
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "address"->'city' as "city" from "person"
     * ```
     *
     * Going deeper:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('profile', '->$').key('website').key('url').as('website_url')
     * )
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * select `profile`->'$.website.url' as `website_url` from `person`
     * ```
     *
     * Combined with {@link at}:
     *
     * ```ts
     * db.selectFrom('person').select(eb =>
     *   eb.ref('profile', '->').key('addresses').at(0).key('city').as('city')
     * )
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "profile"->'addresses'->0->'city' as "city" from "person"
     * ```
     */
    key<K extends any[] extends O ? never : O extends object ? keyof NonNullable<O> & string : never, O2 = undefined extends O ? null | NonNullable<NonNullable<O>[K]> : null extends O ? null | NonNullable<NonNullable<O>[K]> : string extends keyof NonNullable<O> ? null | NonNullable<NonNullable<O>[K]> : NonNullable<O>[K]>(key: K): TraversedJSONPathBuilder<S, O2>;
}
export declare class TraversedJSONPathBuilder<S, O> extends JSONPathBuilder<S, O> implements AliasableExpression<O> {
    #private;
    constructor(node: JSONReferenceNode | JSONPathNode);
    /** @private */
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
    get expressionType(): O | undefined;
    /**
     * Returns an aliased version of the expression.
     *
     * In addition to slapping `as "the_alias"` to the end of the SQL,
     * this method also provides strict typing:
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select(eb =>
     *     eb('first_name', '=', 'Jennifer').as('is_jennifer')
     *   )
     *   .executeTakeFirstOrThrow()
     *
     * // `is_jennifer: SqlBool` field exists in the result type.
     * console.log(result.is_jennifer)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "first_name" = $1 as "is_jennifer"
     * from "person"
     * ```
     */
    as<A extends string>(alias: A): AliasedExpression<O, A>;
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
    as<A extends string>(alias: Expression<unknown>): AliasedExpression<O, A>;
    /**
     * Change the output type of the json path.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `JSONPathBuilder` with a new output type.
     */
    $castTo<O2>(): TraversedJSONPathBuilder<S, O2>;
    $notNull(): TraversedJSONPathBuilder<S, Exclude<O, null>>;
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
export declare class AliasedJSONPathBuilder<O, A extends string> implements AliasedExpression<O, A> {
    #private;
    constructor(jsonPath: TraversedJSONPathBuilder<any, O>, alias: A | Expression<unknown>);
    /** @private */
    /**
     * Returns the aliased expression.
     */
    get expression(): Expression<O>;
    /** @private */
    /**
     * Returns the alias.
     */
    get alias(): A | Expression<unknown>;
    /**
     * Creates the OperationNode that describes how to compile this expression into SQL.
     */
    toOperationNode(): AliasNode;
}
