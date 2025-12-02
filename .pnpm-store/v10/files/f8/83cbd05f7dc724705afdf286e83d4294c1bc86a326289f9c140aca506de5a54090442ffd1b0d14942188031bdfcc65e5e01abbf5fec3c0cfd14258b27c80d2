/// <reference types="./handle-empty-in-lists-plugin.d.ts" />
import { HandleEmptyInListsTransformer } from './handle-empty-in-lists-transformer.js';
/**
 * A plugin that allows handling `in ()` and `not in ()` expressions.
 *
 * These expressions are invalid SQL syntax for many databases, and result in runtime
 * database errors.
 *
 * The workarounds used by other libraries always involve modifying the query under
 * the hood, which is not aligned with Kysely's philosophy of WYSIWYG. We recommend manually checking
 * for empty arrays before passing them as arguments to `in` and `not in` expressions
 * instead, but understand that this can be cumbersome. Hence we're going with an
 * opt-in approach where you can choose if and how to handle these cases. We do
 * not want to make this the default behavior, as it can lead to unexpected behavior.
 * Use it at your own risk. Test it. Make sure it works as expected for you.
 *
 * Using this plugin also allows you to throw an error (thus avoiding unnecessary
 * requests to the database) or print a warning in these cases.
 *
 * ### Examples
 *
 * The following strategy replaces the `in`/`not in` expression with a noncontingent
 * expression. A contradiction (falsy) `1 = 0` for `in`, and a tautology (truthy) `1 = 1` for `not in`),
 * similarily to how {@link https://github.com/knex/knex/blob/176151d8048b2a7feeb89a3d649a5580786d4f4e/docs/src/guide/query-builder.md#L1763 | Knex.js},
 * {@link https://github.com/prisma/prisma-engines/blob/99168c54187178484dae45d9478aa40cfd1866d2/quaint/src/visitor.rs#L804-L823 | PrismaORM},
 * {@link https://github.com/laravel/framework/blob/8.x/src/Illuminate/Database/Query/Grammars/Grammar.php#L284-L291 | Laravel},
 * {@link https://docs.sqlalchemy.org/en/13/core/engines.html#sqlalchemy.create_engine.params.empty_in_strategy | SQLAlchemy}
 * handle this.
 *
 * ```ts
 * import Sqlite from 'better-sqlite3'
 * import {
 *   HandleEmptyInListsPlugin,
 *   Kysely,
 *   replaceWithNoncontingentExpression,
 *   SqliteDialect,
 * } from 'kysely'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new SqliteDialect({
 *     database: new Sqlite(':memory:'),
 *   }),
 *   plugins: [
 *     new HandleEmptyInListsPlugin({
 *       strategy: replaceWithNoncontingentExpression
 *     })
 *   ],
 * })
 *
 * const results = await db
 *   .selectFrom('person')
 *   .where('id', 'in', [])
 *   .where('first_name', 'not in', [])
 *   .selectAll()
 *   .execute()
 * ```
 *
 * The generated SQL (SQLite):
 *
 * ```sql
 * select * from "person" where 1 = 0 and 1 = 1
 * ```
 *
 * The following strategy does the following:
 *
 * When `in`, pushes a `null` value into the empty list resulting in `in (null)`,
 * similiarly to how {@link https://github.com/typeorm/typeorm/blob/0280cdc451c35ef73c830eb1191c95d34f6ce06e/src/query-builder/QueryBuilder.ts#L919-L922 | TypeORM}
 * and {@link https://github.com/sequelize/sequelize/blob/0f2891c6897e12bf9bf56df344aae5b698f58c7d/packages/core/src/abstract-dialect/where-sql-builder.ts#L368-L379 | Sequelize}
 * handle `in ()`. `in (null)` is logically the equivalent of `= null`, which returns
 * `null`, which is a falsy expression in most SQL databases. We recommend NOT
 * using this strategy if you plan to use `in` in `select`, `returning`, or `output`
 * clauses, as the return type differs from the `SqlBool` default type for comparisons.
 *
 * When `not in`, casts the left operand as `char` and pushes a unique value into
 * the empty list resulting in `cast({{lhs}} as char) not in ({{VALUE}})`. Casting
 * is required to avoid database errors with non-string values.
 *
 * ```ts
 * import Sqlite from 'better-sqlite3'
 * import {
 *   HandleEmptyInListsPlugin,
 *   Kysely,
 *   pushValueIntoList,
 *   SqliteDialect
 * } from 'kysely'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new SqliteDialect({
 *     database: new Sqlite(':memory:'),
 *   }),
 *   plugins: [
 *     new HandleEmptyInListsPlugin({
 *       strategy: pushValueIntoList('__kysely_no_values_were_provided__') // choose a unique value for not in. has to be something with zero chance being in the data.
 *     })
 *   ],
 * })
 *
 * const results = await db
 *   .selectFrom('person')
 *   .where('id', 'in', [])
 *   .where('first_name', 'not in', [])
 *   .selectAll()
 *   .execute()
 * ```
 *
 * The generated SQL (SQLite):
 *
 * ```sql
 * select * from "person" where "id" in (null) and cast("first_name" as char) not in ('__kysely_no_values_were_provided__')
 * ```
 *
 * The following custom strategy throws an error when an empty list is encountered
 * to avoid unnecessary requests to the database:
 *
 * ```ts
 * import Sqlite from 'better-sqlite3'
 * import {
 *   HandleEmptyInListsPlugin,
 *   Kysely,
 *   SqliteDialect
 * } from 'kysely'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new SqliteDialect({
 *     database: new Sqlite(':memory:'),
 *   }),
 *   plugins: [
 *     new HandleEmptyInListsPlugin({
 *       strategy: () => {
 *         throw new Error('Empty in/not-in is not allowed')
 *       }
 *     })
 *   ],
 * })
 *
 * const results = await db
 *   .selectFrom('person')
 *   .where('id', 'in', [])
 *   .selectAll()
 *   .execute() // throws an error with 'Empty in/not-in is not allowed' message!
 * ```
 */
export class HandleEmptyInListsPlugin {
    opt;
    #transformer;
    constructor(opt) {
        this.opt = opt;
        this.#transformer = new HandleEmptyInListsTransformer(opt.strategy);
    }
    transformQuery(args) {
        return this.#transformer.transformNode(args.node, args.queryId);
    }
    async transformResult(args) {
        return args.result;
    }
}
