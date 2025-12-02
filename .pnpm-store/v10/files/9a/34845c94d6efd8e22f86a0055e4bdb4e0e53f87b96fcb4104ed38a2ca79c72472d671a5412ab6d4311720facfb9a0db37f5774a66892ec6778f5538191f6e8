import { AliasNode } from '../operation-node/alias-node.js';
import { AndNode } from '../operation-node/and-node.js';
import { OperationNode } from '../operation-node/operation-node.js';
import { OrNode } from '../operation-node/or-node.js';
import { ParensNode } from '../operation-node/parens-node.js';
import { ComparisonOperatorExpression, OperandValueExpressionOrList } from '../parser/binary-operation-parser.js';
import { OperandExpression } from '../parser/expression-parser.js';
import { ReferenceExpression } from '../parser/reference-parser.js';
import { KyselyTypeError } from '../util/type-error.js';
import { SqlBool } from '../util/type-utils.js';
import { AliasableExpression, AliasedExpression, Expression } from './expression.js';
export declare class ExpressionWrapper<DB, TB extends keyof DB, T> implements AliasableExpression<T> {
    #private;
    constructor(node: OperationNode);
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
    get expressionType(): T | undefined;
    /**
     * Returns an aliased version of the expression.
     *
     * ### Examples
     *
     * In addition to slapping `as "the_alias"` to the end of the SQL,
     * this method also provides strict typing:
     *
     * ```ts
     * const result = await db
     *   .selectFrom('person')
     *   .select((eb) =>
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
    as<A extends string>(alias: A): AliasedExpression<T, A>;
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
    as<A extends string>(alias: Expression<unknown>): AliasedExpression<T, A>;
    /**
     * Combines `this` and another expression using `OR`.
     *
     * Also see {@link ExpressionBuilder.or}
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where(eb => eb('first_name', '=', 'Jennifer')
     *     .or('first_name', '=', 'Arnold')
     *     .or('first_name', '=', 'Sylvester')
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   "first_name" = $1
     *   or "first_name" = $2
     *   or "first_name" = $3
     * )
     * ```
     *
     * You can also pass any expression as the only argument to
     * this method:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where(eb => eb('first_name', '=', 'Jennifer')
     *     .or(eb('first_name', '=', 'Sylvester').and('last_name', '=', 'Stallone'))
     *     .or(eb.exists(
     *       eb.selectFrom('pet')
     *         .select('id')
     *         .whereRef('pet.owner_id', '=', 'person.id')
     *     ))
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   "first_name" = $1
     *   or ("first_name" = $2 and "last_name" = $3)
     *   or exists (
     *     select "id"
     *     from "pet"
     *     where "pet"."owner_id" = "person"."id"
     *   )
     * )
     * ```
     */
    or<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): T extends SqlBool ? OrWrapper<DB, TB, SqlBool> : KyselyTypeError<'or() method can only be called on boolean expressions'>;
    or<E extends OperandExpression<SqlBool>>(expression: E): T extends SqlBool ? OrWrapper<DB, TB, SqlBool> : KyselyTypeError<'or() method can only be called on boolean expressions'>;
    /**
     * Combines `this` and another expression using `AND`.
     *
     * Also see {@link ExpressionBuilder.and}
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where(eb => eb('first_name', '=', 'Jennifer')
     *     .and('last_name', '=', 'Aniston')
     *     .and('age', '>', 40)
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   "first_name" = $1
     *   and "last_name" = $2
     *   and "age" > $3
     * )
     * ```
     *
     * You can also pass any expression as the only argument to
     * this method:
     *
     * ```ts
     * const result = await db.selectFrom('person')
     *   .selectAll()
     *   .where(eb => eb('first_name', '=', 'Jennifer')
     *     .and(eb('first_name', '=', 'Sylvester').or('last_name', '=', 'Stallone'))
     *     .and(eb.exists(
     *       eb.selectFrom('pet')
     *         .select('id')
     *         .whereRef('pet.owner_id', '=', 'person.id')
     *     ))
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select *
     * from "person"
     * where (
     *   "first_name" = $1
     *   and ("first_name" = $2 or "last_name" = $3)
     *   and exists (
     *     select "id"
     *     from "pet"
     *     where "pet"."owner_id" = "person"."id"
     *   )
     * )
     * ```
     */
    and<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): T extends SqlBool ? AndWrapper<DB, TB, SqlBool> : KyselyTypeError<'and() method can only be called on boolean expressions'>;
    and<E extends OperandExpression<SqlBool>>(expression: E): T extends SqlBool ? AndWrapper<DB, TB, SqlBool> : KyselyTypeError<'and() method can only be called on boolean expressions'>;
    /**
     * Change the output type of the expression.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `ExpressionWrapper` with a new output type.
     */
    $castTo<C>(): ExpressionWrapper<DB, TB, C>;
    /**
     * Omit null from the expression's type.
     *
     * This function can be useful in cases where you know an expression can't be
     * null, but Kysely is unable to infer it.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of `this` with a new output type.
     */
    $notNull(): ExpressionWrapper<DB, TB, Exclude<T, null>>;
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
export declare class AliasedExpressionWrapper<T, A extends string> implements AliasedExpression<T, A> {
    #private;
    constructor(expr: Expression<T>, alias: A | Expression<unknown>);
    /** @private */
    /**
     * Returns the aliased expression.
     */
    get expression(): Expression<T>;
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
export declare class OrWrapper<DB, TB extends keyof DB, T extends SqlBool> implements AliasableExpression<T> {
    #private;
    constructor(node: OrNode);
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
    get expressionType(): T | undefined;
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
     *     eb('first_name', '=', 'Jennifer')
     *       .or('first_name', '=', 'Sylvester')
     *       .as('is_jennifer_or_sylvester')
     *   )
     *   .executeTakeFirstOrThrow()
     *
     * // `is_jennifer_or_sylvester: SqlBool` field exists in the result type.
     * console.log(result.is_jennifer_or_sylvester)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "first_name" = $1 or "first_name" = $2 as "is_jennifer_or_sylvester"
     * from "person"
     * ```
     */
    as<A extends string>(alias: A): AliasedExpression<T, A>;
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
    as<A extends string>(alias: Expression<unknown>): AliasedExpression<T, A>;
    /**
     * Combines `this` and another expression using `OR`.
     *
     * See {@link ExpressionWrapper.or} for examples.
     */
    or<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): OrWrapper<DB, TB, T>;
    or<E extends OperandExpression<SqlBool>>(expression: E): OrWrapper<DB, TB, T>;
    /**
     * Change the output type of the expression.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `OrWrapper` with a new output type.
     */
    $castTo<C extends SqlBool>(): OrWrapper<DB, TB, C>;
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
    toOperationNode(): ParensNode;
}
export declare class AndWrapper<DB, TB extends keyof DB, T extends SqlBool> implements AliasableExpression<T> {
    #private;
    constructor(node: AndNode);
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
    get expressionType(): T | undefined;
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
     *     eb('first_name', '=', 'Jennifer')
     *       .and('last_name', '=', 'Aniston')
     *       .as('is_jennifer_aniston')
     *   )
     *   .executeTakeFirstOrThrow()
     *
     * // `is_jennifer_aniston: SqlBool` field exists in the result type.
     * console.log(result.is_jennifer_aniston)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "first_name" = $1 and "first_name" = $2 as "is_jennifer_aniston"
     * from "person"
     * ```
     */
    as<A extends string>(alias: A): AliasedExpression<T, A>;
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
    as<A extends string>(alias: Expression<unknown>): AliasedExpression<T, A>;
    /**
     * Combines `this` and another expression using `AND`.
     *
     * See {@link ExpressionWrapper.and} for examples.
     */
    and<RE extends ReferenceExpression<DB, TB>, VE extends OperandValueExpressionOrList<DB, TB, RE>>(lhs: RE, op: ComparisonOperatorExpression, rhs: VE): AndWrapper<DB, TB, T>;
    and<E extends OperandExpression<SqlBool>>(expression: E): AndWrapper<DB, TB, T>;
    /**
     * Change the output type of the expression.
     *
     * This method call doesn't change the SQL in any way. This methods simply
     * returns a copy of this `AndWrapper` with a new output type.
     */
    $castTo<C extends SqlBool>(): AndWrapper<DB, TB, C>;
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
    toOperationNode(): ParensNode;
}
