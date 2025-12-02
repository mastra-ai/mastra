"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonArrayFrom = jsonArrayFrom;
exports.jsonObjectFrom = jsonObjectFrom;
exports.jsonBuildObject = jsonBuildObject;
const sql_js_1 = require("../raw-builder/sql.js");
const json_object_args_js_1 = require("../util/json-object-args.js");
/**
 * A MySQL helper for aggregating a subquery into a JSON array.
 *
 * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
 * While the produced SQL is compatible with all MySQL databases, some third-party dialects
 * may not parse the nested JSON into arrays. In these cases you can use the built in
 * `ParseJSONResultsPlugin` to parse the results.
 *
 * ### Examples
 *
 * ```ts
 * import { jsonArrayFrom } from 'kysely/helpers/mysql'
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
 *
 * result[0]?.id
 * result[0]?.pets[0]?.pet_id
 * result[0]?.pets[0]?.name
 * ```
 *
 * The generated SQL (MySQL):
 *
 * ```sql
 * select `id`, (
 *   select cast(coalesce(json_arrayagg(json_object(
 *     'pet_id', `agg`.`pet_id`,
 *     'name', `agg`.`name`
 *   )), '[]') as json) from (
 *     select `pet`.`id` as `pet_id`, `pet`.`name`
 *     from `pet`
 *     where `pet`.`owner_id` = `person`.`id`
 *     order by `pet`.`name`
 *   ) as `agg`
 * ) as `pets`
 * from `person`
 * ```
 */
function jsonArrayFrom(expr) {
    return (0, sql_js_1.sql) `(select cast(coalesce(json_arrayagg(json_object(${sql_js_1.sql.join(getMysqlJsonObjectArgs(expr.toOperationNode(), 'agg'))})), '[]') as json) from ${expr} as agg)`;
}
/**
 * A MySQL helper for turning a subquery into a JSON object.
 *
 * The subquery must only return one row.
 *
 * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
 * While the produced SQL is compatible with all MySQL databases, some third-party dialects
 * may not parse the nested JSON into objects. In these cases you can use the built in
 * `ParseJSONResultsPlugin` to parse the results.
 *
 * ### Examples
 *
 * ```ts
 * import { jsonObjectFrom } from 'kysely/helpers/mysql'
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
 *
 * result[0]?.id
 * result[0]?.favorite_pet?.pet_id
 * result[0]?.favorite_pet?.name
 * ```
 *
 * The generated SQL (MySQL):
 *
 * ```sql
 * select `id`, (
 *   select json_object(
 *     'pet_id', `obj`.`pet_id`,
 *     'name', `obj`.`name`
 *   ) from (
 *     select `pet`.`id` as `pet_id`, `pet`.`name`
 *     from `pet`
 *     where `pet`.`owner_id` = `person`.`id`
 *     and `pet`.`is_favorite` = ?
 *   ) as obj
 * ) as `favorite_pet`
 * from `person`
 * ```
 */
function jsonObjectFrom(expr) {
    return (0, sql_js_1.sql) `(select json_object(${sql_js_1.sql.join(getMysqlJsonObjectArgs(expr.toOperationNode(), 'obj'))}) from ${expr} as obj)`;
}
/**
 * The MySQL `json_object` function.
 *
 * NOTE: This helper is only guaranteed to fully work with the built-in `MysqlDialect`.
 * While the produced SQL is compatible with all MySQL databases, some third-party dialects
 * may not parse the nested JSON into objects. In these cases you can use the built in
 * `ParseJSONResultsPlugin` to parse the results.
 *
 * ### Examples
 *
 * ```ts
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
 *
 * result[0]?.id
 * result[0]?.name.first
 * result[0]?.name.last
 * result[0]?.name.full
 * ```
 *
 * The generated SQL (MySQL):
 *
 * ```sql
 * select "id", json_object(
 *   'first', first_name,
 *   'last', last_name,
 *   'full', concat(`first_name`, ?, `last_name`)
 * ) as "name"
 * from "person"
 * ```
 */
function jsonBuildObject(obj) {
    return (0, sql_js_1.sql) `json_object(${sql_js_1.sql.join(Object.keys(obj).flatMap((k) => [sql_js_1.sql.lit(k), obj[k]]))})`;
}
function getMysqlJsonObjectArgs(node, table) {
    try {
        return (0, json_object_args_js_1.getJsonObjectArgs)(node, table);
    }
    catch {
        throw new Error('MySQL jsonArrayFrom and jsonObjectFrom functions can only handle explicit selections due to limitations of the json_object function. selectAll() is not allowed in the subquery.');
    }
}
