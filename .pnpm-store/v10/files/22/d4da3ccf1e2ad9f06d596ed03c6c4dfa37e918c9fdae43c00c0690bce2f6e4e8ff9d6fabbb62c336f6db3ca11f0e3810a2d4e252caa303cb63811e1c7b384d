"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryCreator = void 0;
const select_query_builder_js_1 = require("./query-builder/select-query-builder.js");
const insert_query_builder_js_1 = require("./query-builder/insert-query-builder.js");
const delete_query_builder_js_1 = require("./query-builder/delete-query-builder.js");
const update_query_builder_js_1 = require("./query-builder/update-query-builder.js");
const delete_query_node_js_1 = require("./operation-node/delete-query-node.js");
const insert_query_node_js_1 = require("./operation-node/insert-query-node.js");
const select_query_node_js_1 = require("./operation-node/select-query-node.js");
const update_query_node_js_1 = require("./operation-node/update-query-node.js");
const table_parser_js_1 = require("./parser/table-parser.js");
const with_parser_js_1 = require("./parser/with-parser.js");
const with_node_js_1 = require("./operation-node/with-node.js");
const query_id_js_1 = require("./util/query-id.js");
const with_schema_plugin_js_1 = require("./plugin/with-schema/with-schema-plugin.js");
const object_utils_js_1 = require("./util/object-utils.js");
const select_parser_js_1 = require("./parser/select-parser.js");
const merge_query_builder_js_1 = require("./query-builder/merge-query-builder.js");
const merge_query_node_js_1 = require("./operation-node/merge-query-node.js");
class QueryCreator {
    #props;
    constructor(props) {
        this.#props = (0, object_utils_js_1.freeze)(props);
    }
    /**
     * Creates a `select` query builder for the given table or tables.
     *
     * The tables passed to this method are built as the query's `from` clause.
     *
     * ### Examples
     *
     * Create a select query for one table:
     *
     * ```ts
     * db.selectFrom('person').selectAll()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "person"
     * ```
     *
     * Create a select query for one table with an alias:
     *
     * ```ts
     * const persons = await db.selectFrom('person as p')
     *   .select(['p.id', 'first_name'])
     *   .execute()
     *
     * console.log(persons[0].id)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "p"."id", "first_name" from "person" as "p"
     * ```
     *
     * Create a select query from a subquery:
     *
     * ```ts
     * const persons = await db.selectFrom(
     *     (eb) => eb.selectFrom('person').select('person.id as identifier').as('p')
     *   )
     *   .select('p.identifier')
     *   .execute()
     *
     * console.log(persons[0].identifier)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "p"."identifier",
     * from (
     *   select "person"."id" as "identifier" from "person"
     * ) as p
     * ```
     *
     * Create a select query from raw sql:
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const items = await db
     *   .selectFrom(sql<{ one: number }>`(select 1 as one)`.as('q'))
     *   .select('q.one')
     *   .execute()
     *
     * console.log(items[0].one)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "q"."one",
     * from (
     *   select 1 as one
     * ) as q
     * ```
     *
     * When you use the `sql` tag you need to also provide the result type of the
     * raw snippet / query so that Kysely can figure out what columns are
     * available for the rest of the query.
     *
     * The `selectFrom` method also accepts an array for multiple tables. All
     * the above examples can also be used in an array.
     *
     * ```ts
     * import { sql } from 'kysely'
     *
     * const items = await db.selectFrom([
     *     'person as p',
     *     db.selectFrom('pet').select('pet.species').as('a'),
     *     sql<{ one: number }>`(select 1 as one)`.as('q')
     *   ])
     *   .select(['p.id', 'a.species', 'q.one'])
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "p".id, "a"."species", "q"."one"
     * from
     *   "person" as "p",
     *   (select "pet"."species" from "pet") as a,
     *   (select 1 as one) as "q"
     * ```
     */
    selectFrom(from) {
        return (0, select_query_builder_js_1.createSelectQueryBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#props.executor,
            queryNode: select_query_node_js_1.SelectQueryNode.createFrom((0, table_parser_js_1.parseTableExpressionOrList)(from), this.#props.withNode),
        });
    }
    selectNoFrom(selection) {
        return (0, select_query_builder_js_1.createSelectQueryBuilder)({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#props.executor,
            queryNode: select_query_node_js_1.SelectQueryNode.cloneWithSelections(select_query_node_js_1.SelectQueryNode.create(this.#props.withNode), (0, select_parser_js_1.parseSelectArg)(selection)),
        });
    }
    /**
     * Creates an insert query.
     *
     * The return value of this query is an instance of {@link InsertResult}. {@link InsertResult}
     * has the {@link InsertResult.insertId | insertId} field that holds the auto incremented id of
     * the inserted row if the db returned one.
     *
     * See the {@link InsertQueryBuilder.values | values} method for more info and examples. Also see
     * the {@link ReturningInterface.returning | returning} method for a way to return columns
     * on supported databases like PostgreSQL.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .insertInto('person')
     *   .values({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   })
     *   .executeTakeFirst()
     *
     * console.log(result.insertId)
     * ```
     *
     * Some databases like PostgreSQL support the `returning` method:
     *
     * ```ts
     * const { id } = await db
     *   .insertInto('person')
     *   .values({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   })
     *   .returning('id')
     *   .executeTakeFirstOrThrow()
     * ```
     */
    insertInto(table) {
        return new insert_query_builder_js_1.InsertQueryBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#props.executor,
            queryNode: insert_query_node_js_1.InsertQueryNode.create((0, table_parser_js_1.parseTable)(table), this.#props.withNode),
        });
    }
    /**
     * Creates a "replace into" query.
     *
     * This is only supported by some dialects like MySQL or SQLite.
     *
     * Similar to MySQL's {@link InsertQueryBuilder.onDuplicateKeyUpdate} that deletes
     * and inserts values on collision instead of updating existing rows.
     *
     * An alias of SQLite's {@link InsertQueryBuilder.orReplace}.
     *
     * The return value of this query is an instance of {@link InsertResult}. {@link InsertResult}
     * has the {@link InsertResult.insertId | insertId} field that holds the auto incremented id of
     * the inserted row if the db returned one.
     *
     * See the {@link InsertQueryBuilder.values | values} method for more info and examples.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .replaceInto('person')
     *   .values({
     *     first_name: 'Jennifer',
     *     last_name: 'Aniston'
     *   })
     *   .executeTakeFirstOrThrow()
     *
     * console.log(result.insertId)
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * replace into `person` (`first_name`, `last_name`) values (?, ?)
     * ```
     */
    replaceInto(table) {
        return new insert_query_builder_js_1.InsertQueryBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#props.executor,
            queryNode: insert_query_node_js_1.InsertQueryNode.create((0, table_parser_js_1.parseTable)(table), this.#props.withNode, true),
        });
    }
    /**
     * Creates a delete query.
     *
     * See the {@link DeleteQueryBuilder.where} method for examples on how to specify
     * a where clause for the delete operation.
     *
     * The return value of the query is an instance of {@link DeleteResult}.
     *
     * ### Examples
     *
     * <!-- siteExample("delete", "Single row", 10) -->
     *
     * Delete a single row:
     *
     * ```ts
     * const result = await db
     *   .deleteFrom('person')
     *   .where('person.id', '=', 1)
     *   .executeTakeFirst()
     *
     * console.log(result.numDeletedRows)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * delete from "person" where "person"."id" = $1
     * ```
     *
     * Some databases such as MySQL support deleting from multiple tables:
     *
     * ```ts
     * const result = await db
     *   .deleteFrom(['person', 'pet'])
     *   .using('person')
     *   .innerJoin('pet', 'pet.owner_id', 'person.id')
     *   .where('person.id', '=', 1)
     *   .executeTakeFirst()
     * ```
     *
     * The generated SQL (MySQL):
     *
     * ```sql
     * delete from `person`, `pet`
     * using `person`
     * inner join `pet` on `pet`.`owner_id` = `person`.`id`
     * where `person`.`id` = ?
     * ```
     */
    deleteFrom(from) {
        return new delete_query_builder_js_1.DeleteQueryBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#props.executor,
            queryNode: delete_query_node_js_1.DeleteQueryNode.create((0, table_parser_js_1.parseTableExpressionOrList)(from), this.#props.withNode),
        });
    }
    /**
     * Creates an update query.
     *
     * See the {@link UpdateQueryBuilder.where} method for examples on how to specify
     * a where clause for the update operation.
     *
     * See the {@link UpdateQueryBuilder.set} method for examples on how to
     * specify the updates.
     *
     * The return value of the query is an {@link UpdateResult}.
     *
     * ### Examples
     *
     * ```ts
     * const result = await db
     *   .updateTable('person')
     *   .set({ first_name: 'Jennifer' })
     *   .where('person.id', '=', 1)
     *   .executeTakeFirst()
     *
     * console.log(result.numUpdatedRows)
     * ```
     */
    updateTable(tables) {
        return new update_query_builder_js_1.UpdateQueryBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#props.executor,
            queryNode: update_query_node_js_1.UpdateQueryNode.create((0, table_parser_js_1.parseTableExpressionOrList)(tables), this.#props.withNode),
        });
    }
    /**
     * Creates a merge query.
     *
     * The return value of the query is a {@link MergeResult}.
     *
     * See the {@link MergeQueryBuilder.using} method for examples on how to specify
     * the other table.
     *
     * ### Examples
     *
     * <!-- siteExample("merge", "Source row existence", 10) -->
     *
     * Update a target column based on the existence of a source row:
     *
     * ```ts
     * const result = await db
     *   .mergeInto('person as target')
     *   .using('pet as source', 'source.owner_id', 'target.id')
     *   .whenMatchedAnd('target.has_pets', '!=', 'Y')
     *   .thenUpdateSet({ has_pets: 'Y' })
     *   .whenNotMatchedBySourceAnd('target.has_pets', '=', 'Y')
     *   .thenUpdateSet({ has_pets: 'N' })
     *   .executeTakeFirstOrThrow()
     *
     * console.log(result.numChangedRows)
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "person"
     * using "pet"
     * on "pet"."owner_id" = "person"."id"
     * when matched and "has_pets" != $1
     * then update set "has_pets" = $2
     * when not matched by source and "has_pets" = $3
     * then update set "has_pets" = $4
     * ```
     *
     * <!-- siteExample("merge", "Temporary changes table", 20) -->
     *
     * Merge new entries from a temporary changes table:
     *
     * ```ts
     * const result = await db
     *   .mergeInto('wine as target')
     *   .using(
     *     'wine_stock_change as source',
     *     'source.wine_name',
     *     'target.name',
     *   )
     *   .whenNotMatchedAnd('source.stock_delta', '>', 0)
     *   .thenInsertValues(({ ref }) => ({
     *     name: ref('source.wine_name'),
     *     stock: ref('source.stock_delta'),
     *   }))
     *   .whenMatchedAnd(
     *     (eb) => eb('target.stock', '+', eb.ref('source.stock_delta')),
     *     '>',
     *     0,
     *   )
     *   .thenUpdateSet('stock', (eb) =>
     *     eb('target.stock', '+', eb.ref('source.stock_delta')),
     *   )
     *   .whenMatched()
     *   .thenDelete()
     *   .executeTakeFirstOrThrow()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * merge into "wine" as "target"
     * using "wine_stock_change" as "source"
     * on "source"."wine_name" = "target"."name"
     * when not matched and "source"."stock_delta" > $1
     * then insert ("name", "stock") values ("source"."wine_name", "source"."stock_delta")
     * when matched and "target"."stock" + "source"."stock_delta" > $2
     * then update set "stock" = "target"."stock" + "source"."stock_delta"
     * when matched
     * then delete
     * ```
     */
    mergeInto(targetTable) {
        return new merge_query_builder_js_1.MergeQueryBuilder({
            queryId: (0, query_id_js_1.createQueryId)(),
            executor: this.#props.executor,
            queryNode: merge_query_node_js_1.MergeQueryNode.create((0, table_parser_js_1.parseAliasedTable)(targetTable), this.#props.withNode),
        });
    }
    /**
     * Creates a `with` query (Common Table Expression).
     *
     * ### Examples
     *
     * <!-- siteExample("cte", "Simple selects", 10) -->
     *
     * Common table expressions (CTE) are a great way to modularize complex queries.
     * Essentially they allow you to run multiple separate queries within a
     * single roundtrip to the DB.
     *
     * Since CTEs are a part of the main query, query optimizers inside DB
     * engines are able to optimize the overall query. For example, postgres
     * is able to inline the CTEs inside the using queries if it decides it's
     * faster.
     *
     * ```ts
     * const result = await db
     *   // Create a CTE called `jennifers` that selects all
     *   // persons named 'Jennifer'.
     *   .with('jennifers', (db) => db
     *     .selectFrom('person')
     *     .where('first_name', '=', 'Jennifer')
     *     .select(['id', 'age'])
     *   )
     *   // Select all rows from the `jennifers` CTE and
     *   // further filter it.
     *   .with('adult_jennifers', (db) => db
     *     .selectFrom('jennifers')
     *     .where('age', '>', 18)
     *     .select(['id', 'age'])
     *   )
     *   // Finally select all adult jennifers that are
     *   // also younger than 60.
     *   .selectFrom('adult_jennifers')
     *   .where('age', '<', 60)
     *   .selectAll()
     *   .execute()
     * ```
     *
     * <!-- siteExample("cte", "Inserts, updates and deletions", 20) -->
     *
     * Some databases like postgres also allow you to run other queries than selects
     * in CTEs. On these databases CTEs are extremely powerful:
     *
     * ```ts
     * const result = await db
     *   .with('new_person', (db) => db
     *     .insertInto('person')
     *     .values({
     *       first_name: 'Jennifer',
     *       age: 35,
     *     })
     *     .returning('id')
     *   )
     *   .with('new_pet', (db) => db
     *     .insertInto('pet')
     *     .values({
     *       name: 'Doggo',
     *       species: 'dog',
     *       is_favorite: true,
     *       // Use the id of the person we just inserted.
     *       owner_id: db
     *         .selectFrom('new_person')
     *         .select('id')
     *     })
     *     .returning('id')
     *   )
     *   .selectFrom(['new_person', 'new_pet'])
     *   .select([
     *     'new_person.id as person_id',
     *     'new_pet.id as pet_id'
     *   ])
     *   .execute()
     * ```
     *
     * The CTE name can optionally specify column names in addition to
     * a name. In that case Kysely requires the expression to retun
     * rows with the same columns.
     *
     * ```ts
     * await db
     *   .with('jennifers(id, age)', (db) => db
     *     .selectFrom('person')
     *     .where('first_name', '=', 'Jennifer')
     *     // This is ok since we return columns with the same
     *     // names as specified by `jennifers(id, age)`.
     *     .select(['id', 'age'])
     *   )
     *   .selectFrom('jennifers')
     *   .selectAll()
     *   .execute()
     * ```
     *
     * The first argument can also be a callback. The callback is passed
     * a `CTEBuilder` instance that can be used to configure the CTE:
     *
     * ```ts
     * await db
     *   .with(
     *     (cte) => cte('jennifers').materialized(),
     *     (db) => db
     *       .selectFrom('person')
     *       .where('first_name', '=', 'Jennifer')
     *       .select(['id', 'age'])
     *   )
     *   .selectFrom('jennifers')
     *   .selectAll()
     *   .execute()
     * ```
     */
    with(nameOrBuilder, expression) {
        const cte = (0, with_parser_js_1.parseCommonTableExpression)(nameOrBuilder, expression);
        return new QueryCreator({
            ...this.#props,
            withNode: this.#props.withNode
                ? with_node_js_1.WithNode.cloneWithExpression(this.#props.withNode, cte)
                : with_node_js_1.WithNode.create(cte),
        });
    }
    /**
     * Creates a recursive `with` query (Common Table Expression).
     *
     * Note that recursiveness is a property of the whole `with` statement.
     * You cannot have recursive and non-recursive CTEs in a same `with` statement.
     * Therefore the recursiveness is determined by the **first** `with` or
     * `withRecusive` call you make.
     *
     * See the {@link with} method for examples and more documentation.
     */
    withRecursive(nameOrBuilder, expression) {
        const cte = (0, with_parser_js_1.parseCommonTableExpression)(nameOrBuilder, expression);
        return new QueryCreator({
            ...this.#props,
            withNode: this.#props.withNode
                ? with_node_js_1.WithNode.cloneWithExpression(this.#props.withNode, cte)
                : with_node_js_1.WithNode.create(cte, { recursive: true }),
        });
    }
    /**
     * Returns a copy of this query creator instance with the given plugin installed.
     */
    withPlugin(plugin) {
        return new QueryCreator({
            ...this.#props,
            executor: this.#props.executor.withPlugin(plugin),
        });
    }
    /**
     * Returns a copy of this query creator instance without any plugins.
     */
    withoutPlugins() {
        return new QueryCreator({
            ...this.#props,
            executor: this.#props.executor.withoutPlugins(),
        });
    }
    /**
     * Sets the schema to be used for all table references that don't explicitly
     * specify a schema.
     *
     * This only affects the query created through the builder returned from
     * this method and doesn't modify the `db` instance.
     *
     * See [this recipe](https://github.com/kysely-org/kysely/blob/master/site/docs/recipes/0007-schemas.md)
     * for a more detailed explanation.
     *
     * ### Examples
     *
     * ```
     * await db
     *   .withSchema('mammals')
     *   .selectFrom('pet')
     *   .selectAll()
     *   .innerJoin('public.person', 'public.person.id', 'pet.owner_id')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select * from "mammals"."pet"
     * inner join "public"."person"
     * on "public"."person"."id" = "mammals"."pet"."owner_id"
     * ```
     *
     * `withSchema` is smart enough to not add schema for aliases,
     * common table expressions or other places where the schema
     * doesn't belong to:
     *
     * ```
     * await db
     *   .withSchema('mammals')
     *   .selectFrom('pet as p')
     *   .select('p.name')
     *   .execute()
     * ```
     *
     * The generated SQL (PostgreSQL):
     *
     * ```sql
     * select "p"."name" from "mammals"."pet" as "p"
     * ```
     */
    withSchema(schema) {
        return new QueryCreator({
            ...this.#props,
            executor: this.#props.executor.withPluginAtFront(new with_schema_plugin_js_1.WithSchemaPlugin(schema)),
        });
    }
}
exports.QueryCreator = QueryCreator;
