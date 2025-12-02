"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonArrayFrom = jsonArrayFrom;
exports.jsonObjectFrom = jsonObjectFrom;
exports.jsonBuildObject = jsonBuildObject;
exports.mergeAction = mergeAction;
const sql_js_1 = require("../raw-builder/sql.js");
/**
 * A postgres helper for aggregating a subquery (or other expression) into a JSONB array.
 *
 * ### Examples
 *
 * <!-- siteExample("select", "Nested array", 110) -->
 *
 * While kysely is not an ORM and it doesn't have the concept of relations, we do provide
 * helpers for fetching nested objects and arrays in a single query. In this example we
 * use the `jsonArrayFrom` helper to fetch person's pets along with the person's id.
 *
 * Please keep in mind that the helpers under the `kysely/helpers` folder, including
 * `jsonArrayFrom`, are not guaranteed to work with third party dialects. In order for
 * them to work, the dialect must automatically parse the `json` data type into
 * JavaScript JSON values like objects and arrays. Some dialects might simply return
 * the data as a JSON string. In these cases you can use the built in `ParseJSONResultsPlugin`
 * to parse the results.
 *
 * ```ts
 * import { jsonArrayFrom } from 'kysely/helpers/postgres'
 *
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonArrayFrom(
 *       eb.selectFrom('pet')
 *         .select(['pet.id as pet_id', 'pet.name'])
 *         .whereRef('pet.owner_id', '=', 'person.id')
 *         .orderBy('pet.name')
 *     ).as('pets')
 *   ])
 *   .execute()
 * ```
 *
 * The generated SQL (PostgreSQL):
 *
 * ```sql
 * select "id", (
 *   select coalesce(json_agg(agg), '[]') from (
 *     select "pet"."id" as "pet_id", "pet"."name"
 *     from "pet"
 *     where "pet"."owner_id" = "person"."id"
 *     order by "pet"."name"
 *   ) as agg
 * ) as "pets"
 * from "person"
 * ```
 */
function jsonArrayFrom(expr) {
    return (0, sql_js_1.sql) `(select coalesce(json_agg(agg), '[]') from ${expr} as agg)`;
}
/**
 * A postgres helper for turning a subquery (or other expression) into a JSON object.
 *
 * The subquery must only return one row.
 *
 * ### Examples
 *
 * <!-- siteExample("select", "Nested object", 120) -->
 *
 * While kysely is not an ORM and it doesn't have the concept of relations, we do provide
 * helpers for fetching nested objects and arrays in a single query. In this example we
 * use the `jsonObjectFrom` helper to fetch person's favorite pet along with the person's id.
 *
 * Please keep in mind that the helpers under the `kysely/helpers` folder, including
 * `jsonObjectFrom`, are not guaranteed to work with third-party dialects. In order for
 * them to work, the dialect must automatically parse the `json` data type into
 * JavaScript JSON values like objects and arrays. Some dialects might simply return
 * the data as a JSON string. In these cases you can use the built in `ParseJSONResultsPlugin`
 * to parse the results.
 *
 * ```ts
 * import { jsonObjectFrom } from 'kysely/helpers/postgres'
 *
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonObjectFrom(
 *       eb.selectFrom('pet')
 *         .select(['pet.id as pet_id', 'pet.name'])
 *         .whereRef('pet.owner_id', '=', 'person.id')
 *         .where('pet.is_favorite', '=', true)
 *     ).as('favorite_pet')
 *   ])
 *   .execute()
 * ```
 *
 * The generated SQL (PostgreSQL):
 *
 * ```sql
 * select "id", (
 *   select to_json(obj) from (
 *     select "pet"."id" as "pet_id", "pet"."name"
 *     from "pet"
 *     where "pet"."owner_id" = "person"."id"
 *     and "pet"."is_favorite" = $1
 *   ) as obj
 * ) as "favorite_pet"
 * from "person"
 * ```
 */
function jsonObjectFrom(expr) {
    return (0, sql_js_1.sql) `(select to_json(obj) from ${expr} as obj)`;
}
/**
 * The PostgreSQL `json_build_object` function.
 *
 * NOTE: This helper is only guaranteed to fully work with the built-in `PostgresDialect`.
 * While the produced SQL is compatible with all PostgreSQL databases, some third-party dialects
 * may not parse the nested JSON into objects. In these cases you can use the built in
 * `ParseJSONResultsPlugin` to parse the results.
 *
 * ### Examples
 *
 * ```ts
 * import { sql } from 'kysely'
 * import { jsonBuildObject } from 'kysely/helpers/postgres'
 *
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonBuildObject({
 *       first: eb.ref('first_name'),
 *       last: eb.ref('last_name'),
 *       full: sql<string>`first_name || ' ' || last_name`
 *     }).as('name')
 *   ])
 *   .execute()
 *
 * result[0]?.id
 * result[0]?.name.first
 * result[0]?.name.last
 * result[0]?.name.full
 * ```
 *
 * The generated SQL (PostgreSQL):
 *
 * ```sql
 * select "id", json_build_object(
 *   'first', first_name,
 *   'last', last_name,
 *   'full', first_name || ' ' || last_name
 * ) as "name"
 * from "person"
 * ```
 */
function jsonBuildObject(obj) {
    return (0, sql_js_1.sql) `json_build_object(${sql_js_1.sql.join(Object.keys(obj).flatMap((k) => [sql_js_1.sql.lit(k), obj[k]]))})`;
}
/**
 * The PostgreSQL `merge_action` function.
 *
 * This function can be used in a `returning` clause to get the action that was
 * performed in a `mergeInto` query. The function returns one of the following
 * strings: `'INSERT'`, `'UPDATE'`, or `'DELETE'`.
 *
 * ### Examples
 *
 * ```ts
 * import { mergeAction } from 'kysely/helpers/postgres'
 *
 * const result = await db
 *   .mergeInto('person as p')
 *   .using('person_backup as pb', 'p.id', 'pb.id')
 *   .whenMatched()
 *   .thenUpdateSet(({ ref }) => ({
 *     first_name: ref('pb.first_name'),
 *     updated_at: ref('pb.updated_at').$castTo<string | null>(),
 *   }))
 *   .whenNotMatched()
 *   .thenInsertValues(({ ref}) => ({
 *     id: ref('pb.id'),
 *     first_name: ref('pb.first_name'),
 *     created_at: ref('pb.updated_at'),
 *     updated_at: ref('pb.updated_at').$castTo<string | null>(),
 *   }))
 *   .returning([mergeAction().as('action'), 'p.id', 'p.updated_at'])
 *   .execute()
 *
 * result[0].action
 * ```
 *
 * The generated SQL (PostgreSQL):
 *
 * ```sql
 * merge into "person" as "p"
 * using "person_backup" as "pb" on "p"."id" = "pb"."id"
 * when matched then update set
 *   "first_name" = "pb"."first_name",
 *   "updated_at" = "pb"."updated_at"::text
 * when not matched then insert values ("id", "first_name", "created_at", "updated_at")
 * values ("pb"."id", "pb"."first_name", "pb"."updated_at", "pb"."updated_at")
 * returning merge_action() as "action", "p"."id", "p"."updated_at"
 * ```
 */
function mergeAction() {
    return (0, sql_js_1.sql) `merge_action()`;
}
