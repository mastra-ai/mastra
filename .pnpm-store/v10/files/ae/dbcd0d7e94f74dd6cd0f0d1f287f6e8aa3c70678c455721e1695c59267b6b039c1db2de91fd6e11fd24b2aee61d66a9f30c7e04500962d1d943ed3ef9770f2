"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonArrayFrom = jsonArrayFrom;
exports.jsonObjectFrom = jsonObjectFrom;
exports.jsonBuildObject = jsonBuildObject;
const sql_js_1 = require("../raw-builder/sql.js");
/**
 * An MS SQL Server helper for aggregating a subquery into a JSON array.
 *
 * NOTE: This helper only works correctly if you've installed the `ParseJSONResultsPlugin`.
 * Otherwise the nested selections will be returned as JSON strings.
 *
 * The plugin can be installed like this:
 *
 * ```ts
 * import { Kysely, MssqlDialect, ParseJSONResultsPlugin } from 'kysely'
 * import * as Tarn from 'tarn'
 * import * as Tedious from 'tedious'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new MssqlDialect({
 *     tarn: { options: { max: 10, min: 0 }, ...Tarn },
 *     tedious: {
 *       ...Tedious,
 *       connectionFactory: () => new Tedious.Connection({
 *         authentication: {
 *           options: { password: 'password', userName: 'sa' },
 *           type: 'default',
 *         },
 *         options: { database: 'test', port: 21433, trustServerCertificate: true },
 *         server: 'localhost',
 *       }),
 *     },
 *   }),
 *   plugins: [new ParseJSONResultsPlugin()]
 * })
 * ```
 *
 * ### Examples
 *
 * ```ts
 * import { jsonArrayFrom } from 'kysely/helpers/mssql'
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
 *         .offset(0)
 *     ).as('pets')
 *   ])
 *   .execute()
 *
 * result[0]?.id
 * result[0]?.pets[0]?.pet_id
 * result[0]?.pets[0]?.name
 * ```
 *
 * The generated SQL (MS SQL Server):
 *
 * ```sql
 * select "id", (
 *   select coalesce((select * from (
 *     select "pet"."id" as "pet_id", "pet"."name"
 *     from "pet"
 *     where "pet"."owner_id" = "person"."id"
 *     order by "pet"."name"
 *     offset @1 rows
 *   ) as "agg" for json path, include_null_values), '[]')
 * ) as "pets"
 * from "person"
 * ```
 */
function jsonArrayFrom(expr) {
    return (0, sql_js_1.sql) `coalesce((select * from ${expr} as agg for json path, include_null_values), '[]')`;
}
/**
 * An MS SQL Server helper for turning a subquery into a JSON object.
 *
 * The subquery must only return one row.
 *
 * NOTE: This helper only works correctly if you've installed the `ParseJSONResultsPlugin`.
 * Otherwise the nested selections will be returned as JSON strings.
 *
 * The plugin can be installed like this:
 *
 * ```ts
 * import { Kysely, MssqlDialect, ParseJSONResultsPlugin } from 'kysely'
 * import * as Tarn from 'tarn'
 * import * as Tedious from 'tedious'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new MssqlDialect({
 *     tarn: { options: { max: 10, min: 0 }, ...Tarn },
 *     tedious: {
 *       ...Tedious,
 *       connectionFactory: () => new Tedious.Connection({
 *         authentication: {
 *           options: { password: 'password', userName: 'sa' },
 *           type: 'default',
 *         },
 *         options: { database: 'test', port: 21433, trustServerCertificate: true },
 *         server: 'localhost',
 *       }),
 *     },
 *   }),
 *   plugins: [new ParseJSONResultsPlugin()]
 * })
 * ```
 *
 * ### Examples
 *
 * ```ts
 * import { jsonObjectFrom } from 'kysely/helpers/mssql'
 *
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonObjectFrom(
 *       eb.selectFrom('pet')
 *         .select(['pet.id as pet_id', 'pet.name'])
 *         .whereRef('pet.owner_id', '=', 'person.id')
 *         .where('pet.is_favorite', '=', 1)
 *     ).as('favorite_pet')
 *   ])
 *   .execute()
 *
 * result[0]?.id
 * result[0]?.favorite_pet?.pet_id
 * result[0]?.favorite_pet?.name
 * ```
 *
 * The generated SQL (MS SQL Server):
 *
 * ```sql
 * select "id", (
 *   select * from (
 *     select "pet"."id" as "pet_id", "pet"."name"
 *     from "pet"
 *     where "pet"."owner_id" = "person"."id"
 *     and "pet"."is_favorite" = @1
 *   ) as "agg" for json path, include_null_values, without_array_wrapper
 * ) as "favorite_pet"
 * from "person"
 * ```
 */
function jsonObjectFrom(expr) {
    return (0, sql_js_1.sql) `(select * from ${expr} as agg for json path, include_null_values, without_array_wrapper)`;
}
/**
 * The MS SQL Server `json_query` function, single argument variant.
 *
 * NOTE: This helper only works correctly if you've installed the `ParseJSONResultsPlugin`.
 * Otherwise the nested selections will be returned as JSON strings.
 *
 * The plugin can be installed like this:
 *
 * ```ts
 * import { Kysely, MssqlDialect, ParseJSONResultsPlugin } from 'kysely'
 * import * as Tarn from 'tarn'
 * import * as Tedious from 'tedious'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new MssqlDialect({
 *     tarn: { options: { max: 10, min: 0 }, ...Tarn },
 *     tedious: {
 *       ...Tedious,
 *       connectionFactory: () => new Tedious.Connection({
 *         authentication: {
 *           options: { password: 'password', userName: 'sa' },
 *           type: 'default',
 *         },
 *         options: { database: 'test', port: 21433, trustServerCertificate: true },
 *         server: 'localhost',
 *       }),
 *     },
 *   }),
 *   plugins: [new ParseJSONResultsPlugin()]
 * })
 * ```
 *
 * ### Examples
 *
 * ```ts
 * import { jsonBuildObject } from 'kysely/helpers/mssql'
 *
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     jsonBuildObject({
 *       first: eb.ref('first_name'),
 *       last: eb.ref('last_name'),
 *       full: eb.fn('concat', ['first_name', eb.val(' '), 'last_name'])
 *     }).as('name')
 *   ])
 *   .execute()
 * ```
 *
 * The generated SQL (MS SQL Server):
 *
 * ```sql
 * select "id", json_query(
 *   '{"first":"'+"first_name"+',"last":"'+"last_name"+',"full":"'+concat("first_name", ' ', "last_name")+'"}'
 * ) as "name"
 * from "person"
 * ```
 */
function jsonBuildObject(obj) {
    return (0, sql_js_1.sql) `json_query('{${sql_js_1.sql.join(Object.keys(obj).map((k) => (0, sql_js_1.sql) `"${sql_js_1.sql.raw(k)}":"'+${obj[k]}+'"`), (0, sql_js_1.sql) `,`)}}')`;
}
