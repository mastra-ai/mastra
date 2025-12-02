"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotMatchedThenableMergeQueryBuilder = exports.MatchedThenableMergeQueryBuilder = exports.WheneableMergeQueryBuilder = exports.MergeQueryBuilder = void 0;
const insert_query_node_js_1 = require("../operation-node/insert-query-node.js");
const merge_query_node_js_1 = require("../operation-node/merge-query-node.js");
const query_node_js_1 = require("../operation-node/query-node.js");
const update_query_node_js_1 = require("../operation-node/update-query-node.js");
const insert_values_parser_js_1 = require("../parser/insert-values-parser.js");
const join_parser_js_1 = require("../parser/join-parser.js");
const merge_parser_js_1 = require("../parser/merge-parser.js");
const select_parser_js_1 = require("../parser/select-parser.js");
const top_parser_js_1 = require("../parser/top-parser.js");
const noop_query_executor_js_1 = require("../query-executor/noop-query-executor.js");
const object_utils_js_1 = require("../util/object-utils.js");
const merge_result_js_1 = require("./merge-result.js");
const no_result_error_js_1 = require("./no-result-error.js");
const update_query_builder_js_1 = require("./update-query-builder.js");
class MergeQueryBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * This can be used to add any additional SQL to the end of the query.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db
     *   .mergeInto('person')
     *   .using('pet', 'pet.owner_id', 'person.id')
     *   .whenMatched()
     *   .thenDelete()
     *   .modifyEnd(sql.raw('-- this is a comment'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person" using "pet" on "pet"."owner_id" = "person"."id" when matched then delete -- this is a comment
     * ```
     */
    modifyEnd(modifier) {
        return new MergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, modifier.toOperationNode()),
        });
    }
    /**
     * Changes a `merge into` query to an `merge top into` query.
     *
     * `top` clause is only supported by some dialects like MS SQL Server.
     *
     * ### Examples
     *
     * Affect 5 matched rows at most:
     *
     * ```ts
     * await db.mergeInto('person')
     *   .top(5)
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (MS SQL Server):
     *
     * ```sql
     * merge top(5) into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     *
     * Affect 50% of matched rows:
     *
     * ```ts
     * await db.mergeInto('person')
     *   .top(50, 'percent')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (MS SQL Server):
     *
     * ```sql
     * merge top(50) percent into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     */
    top(expression, modifiers) {
        return new MergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithTop(this.#props.queryNode, (0, top_parser_js_1.parseTop)(expression, modifiers)),
        });
    }
    using(...args) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithUsing(this.#props.queryNode, (0, join_parser_js_1.parseJoin)('Using', args)),
        });
    }
    returning(args) {
        return new MergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithReturning(this.#props.queryNode, (0, select_parser_js_1.parseSelectArg)(args)),
        });
    }
    returningAll(table) {
        return new MergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithReturning(this.#props.queryNode, (0, select_parser_js_1.parseSelectAll)(table)),
        });
    }
    output(args) {
        return new MergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithOutput(this.#props.queryNode, (0, select_parser_js_1.parseSelectArg)(args)),
        });
    }
    outputAll(table) {
        return new MergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithOutput(this.#props.queryNode, (0, select_parser_js_1.parseSelectAll)(table)),
        });
    }
}
exports.MergeQueryBuilder = MergeQueryBuilder;
class WheneableMergeQueryBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * This can be used to add any additional SQL to the end of the query.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * await db
     *   .mergeInto('person')
     *   .using('pet', 'pet.owner_id', 'person.id')
     *   .whenMatched()
     *   .thenDelete()
     *   .modifyEnd(sql.raw('-- this is a comment'))
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person" using "pet" on "pet"."owner_id" = "person"."id" when matched then delete -- this is a comment
     * ```
     */
    modifyEnd(modifier) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithEndModifier(this.#props.queryNode, modifier.toOperationNode()),
        });
    }
    /**
     * See {@link MergeQueryBuilder.top}.
     */
    top(expression, modifiers) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithTop(this.#props.queryNode, (0, top_parser_js_1.parseTop)(expression, modifiers)),
        });
    }
    /**
     * Adds a simple `when matched` clause to the query.
     *
     * For a `when matched` clause with an `and` condition, see {@link whenMatchedAnd}.
     *
     * For a simple `when not matched` clause, see {@link whenNotMatched}.
     *
     * For a `when not matched` clause with an `and` condition, see {@link whenNotMatchedAnd}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     */
    whenMatched() {
        return this.#whenMatched([]);
    }
    whenMatchedAnd(...args) {
        return this.#whenMatched(args);
    }
    /**
     * Adds the `when matched` clause to the query with an `and` condition. But unlike
     * {@link whenMatchedAnd}, this method accepts a column reference as the 3rd argument.
     *
     * This method is similar to {@link SelectQueryBuilder.whereRef}, so see the documentation
     * for that method for more examples.
     */
    whenMatchedAndRef(lhs, op, rhs) {
        return this.#whenMatched([lhs, op, rhs], true);
    }
    #whenMatched(args, refRight) {
        return new MatchedThenableMergeQueryBuilder({
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithWhen(this.#props.queryNode, (0, merge_parser_js_1.parseMergeWhen)({ isMatched: true }, args, refRight)),
        });
    }
    /**
     * Adds a simple `when not matched` clause to the query.
     *
     * For a `when not matched` clause with an `and` condition, see {@link whenNotMatchedAnd}.
     *
     * For a simple `when matched` clause, see {@link whenMatched}.
     *
     * For a `when matched` clause with an `and` condition, see {@link whenMatchedAnd}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenNotMatched()
     *   .thenInsertValues({
     *     first_name: 'John',
     *     last_name: 'Doe',
     *   })
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when not matched then
     *   insert ("first_name", "last_name") values ($1, $2)
     * ```
     */
    whenNotMatched() {
        return this.#whenNotMatched([]);
    }
    whenNotMatchedAnd(...args) {
        return this.#whenNotMatched(args);
    }
    /**
     * Adds the `when not matched` clause to the query with an `and` condition. But unlike
     * {@link whenNotMatchedAnd}, this method accepts a column reference as the 3rd argument.
     *
     * Unlike {@link whenMatchedAndRef}, you cannot reference columns from the target table.
     *
     * This method is similar to {@link SelectQueryBuilder.whereRef}, so see the documentation
     * for that method for more examples.
     */
    whenNotMatchedAndRef(lhs, op, rhs) {
        return this.#whenNotMatched([lhs, op, rhs], true);
    }
    /**
     * Adds a simple `when not matched by source` clause to the query.
     *
     * Supported in MS SQL Server.
     *
     * Similar to {@link whenNotMatched}, but returns a {@link MatchedThenableMergeQueryBuilder}.
     */
    whenNotMatchedBySource() {
        return this.#whenNotMatched([], false, true);
    }
    whenNotMatchedBySourceAnd(...args) {
        return this.#whenNotMatched(args, false, true);
    }
    /**
     * Adds the `when not matched by source` clause to the query with an `and` condition.
     *
     * Similar to {@link whenNotMatchedAndRef}, but you can reference columns from
     * the target table, and not from source table and returns a {@link MatchedThenableMergeQueryBuilder}.
     */
    whenNotMatchedBySourceAndRef(lhs, op, rhs) {
        return this.#whenNotMatched([lhs, op, rhs], true, true);
    }
    returning(args) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithReturning(this.#props.queryNode, (0, select_parser_js_1.parseSelectArg)(args)),
        });
    }
    returningAll(table) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithReturning(this.#props.queryNode, (0, select_parser_js_1.parseSelectAll)(table)),
        });
    }
    output(args) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithOutput(this.#props.queryNode, (0, select_parser_js_1.parseSelectArg)(args)),
        });
    }
    outputAll(table) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: query_node_js_1.QueryNode.cloneWithOutput(this.#props.queryNode, (0, select_parser_js_1.parseSelectAll)(table)),
        });
    }
    #whenNotMatched(args, refRight = false, bySource = false) {
        const props = {
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithWhen(this.#props.queryNode, (0, merge_parser_js_1.parseMergeWhen)({ isMatched: false, bySource }, args, refRight)),
        };
        const Builder = bySource
            ? MatchedThenableMergeQueryBuilder
            : NotMatchedThenableMergeQueryBuilder;
        return new Builder(props);
    }
    /**
     * Simply calls the provided function passing `this` as the only argument. `$call` returns
     * what the provided function returns.
     *
     * If you want to conditionally call a method on `this`, see
     * the {@link $if} method.
     *
     * ### Examples
     *
     * The next example uses a helper function `log` to log a query:
     *
     * ```ts
     * import type { Compilable } from 'kysely'
     *
     * function log<T extends Compilable>(qb: T): T {
     *   console.log(qb.compile())
     *   return qb
     * }
     *
     * await db.updateTable('person')
     *   .set({ first_name: 'John' })
     *   .$call(log)
     *   .execute()
     * ```
     */
    $call(func) {
        return func(this);
    }
    /**
     * Call `func(this)` if `condition` is true.
     *
     * This method is especially handy with optional selects. Any `returning` or `returningAll`
     * method calls add columns as optional fields to the output type when called inside
     * the `func` callback. This is because we can't know if those selections were actually
     * made before running the code.
     *
     * You can also call any other methods inside the callback.
     *
     * ### Examples
     *
     * ```ts
     * import type { PersonUpdate } from 'type-editor' // imaginary module
     *
     * async function updatePerson(id: number, updates: PersonUpdate, returnLastName: boolean) {
     *   return await db
     *     .updateTable('person')
     *     .set(updates)
     *     .where('id', '=', id)
     *     .returning(['id', 'first_name'])
     *     .$if(returnLastName, (qb) => qb.returning('last_name'))
     *     .executeTakeFirstOrThrow()
     * }
     * ```
     *
     * Any selections added inside the `if` callback will be added as optional fields to the
     * output type since we can't know if the selections were actually made before running
     * the code. In the example above the return type of the `updatePerson` function is:
     *
     * ```ts
     * Promise<{
     *   id: number
     *   first_name: string
     *   last_name?: string
     * }>
     * ```
     */
    $if(condition, func) {
        if (condition) {
            return func(this);
        }
        return new WheneableMergeQueryBuilder({
            ...this.#props,
        });
    }
    toOperationNode() {
        return this.#props.executor.transformQuery(this.#props.queryNode, this.#props.queryId);
    }
    compile() {
        return this.#props.executor.compileQuery(this.toOperationNode(), this.#props.queryId);
    }
    /**
     * Executes the query and returns an array of rows.
     *
     * Also see the {@link executeTakeFirst} and {@link executeTakeFirstOrThrow} methods.
     */
    async execute() {
        const compiledQuery = this.compile();
        const result = await this.#props.executor.executeQuery(compiledQuery);
        const { adapter } = this.#props.executor;
        const query = compiledQuery.query;
        if ((query.returning && adapter.supportsReturning) ||
            (query.output && adapter.supportsOutput)) {
            return result.rows;
        }
        return [new merge_result_js_1.MergeResult(result.numAffectedRows)];
    }
    /**
     * Executes the query and returns the first result or undefined if
     * the query returned no result.
     */
    async executeTakeFirst() {
        const [result] = await this.execute();
        return result;
    }
    /**
     * Executes the query and returns the first result or throws if
     * the query returned no result.
     *
     * By default an instance of {@link NoResultError} is thrown, but you can
     * provide a custom error class, or callback as the only argument to throw a different
     * error.
     */
    async executeTakeFirstOrThrow(errorConstructor = no_result_error_js_1.NoResultError) {
        const result = await this.executeTakeFirst();
        if (result === undefined) {
            const error = (0, no_result_error_js_1.isNoResultErrorConstructor)(errorConstructor)
                ? new errorConstructor(this.toOperationNode())
                : errorConstructor(this.toOperationNode());
            throw error;
        }
        return result;
    }
}
exports.WheneableMergeQueryBuilder = WheneableMergeQueryBuilder;
class MatchedThenableMergeQueryBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Performs the `delete` action.
     *
     * To perform the `do nothing` action, see {@link thenDoNothing}.
     *
     * To perform the `update` action, see {@link thenUpdate} or {@link thenUpdateSet}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDelete()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   delete
     * ```
     */
    thenDelete() {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithThen(this.#props.queryNode, (0, merge_parser_js_1.parseMergeThen)('delete')),
        });
    }
    /**
     * Performs the `do nothing` action.
     *
     * This is supported in PostgreSQL.
     *
     * To perform the `delete` action, see {@link thenDelete}.
     *
     * To perform the `update` action, see {@link thenUpdate} or {@link thenUpdateSet}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenDoNothing()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   do nothing
     * ```
     */
    thenDoNothing() {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithThen(this.#props.queryNode, (0, merge_parser_js_1.parseMergeThen)('do nothing')),
        });
    }
    /**
     * Perform an `update` operation with a full-fledged {@link UpdateQueryBuilder}.
     * This is handy when multiple `set` invocations are needed.
     *
     * For a shorthand version of this method, see {@link thenUpdateSet}.
     *
     * To perform the `delete` action, see {@link thenDelete}.
     *
     * To perform the `do nothing` action, see {@link thenDoNothing}.
     *
     * ### Examples
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenMatched()
     *   .thenUpdate((ub) => ub
     *     .set(sql`metadata['has_pets']`, 'Y')
     *     .set({
     *       updated_at: new Date().toISOString(),
     *     })
     *   )
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when matched then
     *   update set metadata['has_pets'] = $1, "updated_at" = $2
     * ```
     */
    thenUpdate(set) {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithThen(this.#props.queryNode, (0, merge_parser_js_1.parseMergeThen)(set(new update_query_builder_js_1.UpdateQueryBuilder({
                queryId: this.#props.queryId,
                executor: noop_query_executor_js_1.NOOP_QUERY_EXECUTOR,
                queryNode: update_query_node_js_1.UpdateQueryNode.createWithoutTable(),
            })))),
        });
    }
    thenUpdateSet(...args) {
        // @ts-ignore not sure how to type this so it won't complain about set(...args).
        return this.thenUpdate((ub) => ub.set(...args));
    }
}
exports.MatchedThenableMergeQueryBuilder = MatchedThenableMergeQueryBuilder;
class NotMatchedThenableMergeQueryBuilder {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Performs the `do nothing` action.
     *
     * This is supported in PostgreSQL.
     *
     * To perform the `insert` action, see {@link thenInsertValues}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db.mergeInto('person')
     *   .using('pet', 'person.id', 'pet.owner_id')
     *   .whenNotMatched()
     *   .thenDoNothing()
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet" on "person"."id" = "pet"."owner_id"
     * when not matched then
     *   do nothing
     * ```
     */
    thenDoNothing() {
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithThen(this.#props.queryNode, (0, merge_parser_js_1.parseMergeThen)('do nothing')),
        });
    }
    thenInsertValues(insert) {
        const [columns, values] = (0, insert_values_parser_js_1.parseInsertExpression)(insert);
        return new WheneableMergeQueryBuilder({
            ...this.#props,
            queryNode: merge_query_node_js_1.MergeQueryNode.cloneWithThen(this.#props.queryNode, (0, merge_parser_js_1.parseMergeThen)(insert_query_node_js_1.InsertQueryNode.cloneWith(insert_query_node_js_1.InsertQueryNode.createWithoutInto(), {
                columns,
                values,
            }))),
        });
    }
}
exports.NotMatchedThenableMergeQueryBuilder = NotMatchedThenableMergeQueryBuilder;
