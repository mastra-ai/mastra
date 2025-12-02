import { CreateIndexNode, IndexType } from '../operation-node/create-index-node.js';
import { OperationNodeSource } from '../operation-node/operation-node-source.js';
import { ExtractColumnNameFromOrderedColumnName, OrderedColumnName } from '../parser/reference-parser.js';
import { CompiledQuery } from '../query-compiler/compiled-query.js';
import { Compilable } from '../util/compilable.js';
import { QueryExecutor } from '../query-executor/query-executor.js';
import { QueryId } from '../util/query-id.js';
import { Expression } from '../expression/expression.js';
import { ComparisonOperatorExpression } from '../parser/binary-operation-parser.js';
import { ExpressionBuilder } from '../expression/expression-builder.js';
import { ShallowRecord, SqlBool } from '../util/type-utils.js';
export declare class CreateIndexBuilder<C = never> implements OperationNodeSource, Compilable {
    #private;
    constructor(props: CreateIndexBuilderProps);
    /**
     * Adds the "if not exists" modifier.
     *
     * If the index already exists, no error is thrown if this method has been called.
     */
    ifNotExists(): CreateIndexBuilder<C>;
    /**
     * Makes the index unique.
     */
    unique(): CreateIndexBuilder<C>;
    /**
     * Adds `nulls not distinct` specifier to index.
     * This only works on some dialects like PostgreSQL.
     *
     * ### Examples
     *
     * ```ts
     * db.schema.createIndex('person_first_name_index')
     *  .on('person')
     *  .column('first_name')
     *  .nullsNotDistinct()
     *  .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_index"
     * on "test" ("first_name")
     * nulls not distinct;
     * ```
     */
    nullsNotDistinct(): CreateIndexBuilder<C>;
    /**
     * Specifies the table for the index.
     */
    on(table: string): CreateIndexBuilder<C>;
    /**
     * Adds a column to the index.
     *
     * Also see {@link columns} for adding multiple columns at once or {@link expression}
     * for specifying an arbitrary expression.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *         .createIndex('person_first_name_and_age_index')
     *         .on('person')
     *         .column('first_name')
     *         .column('age desc')
     *         .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_and_age_index" on "person" ("first_name", "age" desc)
     * ```
     */
    column<CL extends string>(column: OrderedColumnName<CL>): CreateIndexBuilder<C | ExtractColumnNameFromOrderedColumnName<CL>>;
    /**
     * Specifies a list of columns for the index.
     *
     * Also see {@link column} for adding a single column or {@link expression} for
     * specifying an arbitrary expression.
     *
     * ### Examples
     *
     * ```ts
     * await db.schema
     *         .createIndex('person_first_name_and_age_index')
     *         .on('person')
     *         .columns(['first_name', 'age desc'])
     *         .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_and_age_index" on "person" ("first_name", "age" desc)
     * ```
     */
    columns<CL extends string>(columns: OrderedColumnName<CL>[]): CreateIndexBuilder<C | ExtractColumnNameFromOrderedColumnName<CL>>;
    /**
     * Specifies an arbitrary expression for the index.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *   .createIndex('person_first_name_index')
     *   .on('person')
     *   .expression(sql`first_name COLLATE "fi_FI"`)
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "person_first_name_index" on "person" (first_name COLLATE "fi_FI")
     * ```
     */
    expression(expression: Expression<any>): CreateIndexBuilder<C>;
    /**
     * Specifies the index type.
     */
    using(indexType: IndexType): CreateIndexBuilder<C>;
    using(indexType: string): CreateIndexBuilder<C>;
    /**
     * Adds a where clause to the query. This Effectively turns the index partial.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db.schema
     *    .createIndex('orders_unbilled_index')
     *    .on('orders')
     *    .column('order_nr')
     *    .where(sql.ref('billed'), 'is not', true)
     *    .where('order_nr', 'like', '123%')
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * create index "orders_unbilled_index" on "orders" ("order_nr") where "billed" is not true and "order_nr" like '123%'
     * ```
     *
     * Column names specified in {@link column} or {@link columns} are known at compile-time
     * and can be referred to in the current query and context.
     *
     * Sometimes you may want to refer to columns that exist in the table but are not
     * part of the current index. In that case you can refer to them using {@link sql}
     * expressions.
     *
     * Parameters are always sent as literals due to database restrictions.
     */
    where(lhs: C | Expression<any>, op: ComparisonOperatorExpression, rhs: unknown): CreateIndexBuilder<C>;
    where(factory: (qb: ExpressionBuilder<ShallowRecord<string, ShallowRecord<C & string, any>>, string>) => Expression<SqlBool>): CreateIndexBuilder<C>;
    where(expression: Expression<SqlBool>): CreateIndexBuilder<C>;
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     */
    $call<T>(func: (qb: this) => T): T;
    toOperationNode(): CreateIndexNode;
    compile(): CompiledQuery;
    execute(): Promise<void>;
}
export interface CreateIndexBuilderProps {
    readonly queryId: QueryId;
    readonly executor: QueryExecutor;
    readonly node: CreateIndexNode;
}
