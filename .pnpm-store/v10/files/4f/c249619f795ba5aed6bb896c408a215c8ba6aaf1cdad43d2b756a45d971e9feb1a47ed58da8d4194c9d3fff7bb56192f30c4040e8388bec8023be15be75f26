/// <reference types="./parse-json-results-plugin.d.ts" />
import { isPlainObject, isString } from '../../util/object-utils.js';
/**
 * Parses JSON strings in query results into JSON objects.
 *
 * This plugin can be useful with dialects that don't automatically parse
 * JSON into objects and arrays but return JSON strings instead.
 *
 * To apply this plugin globally, pass an instance of it to the `plugins` option
 * when creating a new `Kysely` instance:
 *
 * ```ts
 * import * as Sqlite from 'better-sqlite3'
 * import { Kysely, ParseJSONResultsPlugin, SqliteDialect } from 'kysely'
 * import type { Database } from 'type-editor' // imaginary module
 *
 * const db = new Kysely<Database>({
 *   dialect: new SqliteDialect({
 *     database: new Sqlite(':memory:'),
 *   }),
 *   plugins: [new ParseJSONResultsPlugin()],
 * })
 * ```
 *
 * To apply this plugin to a single query:
 *
 * ```ts
 * import { ParseJSONResultsPlugin } from 'kysely'
 * import { jsonArrayFrom } from 'kysely/helpers/sqlite'
 *
 * const result = await db
 *   .selectFrom('person')
 *   .select((eb) => [
 *     'id',
 *     'first_name',
 *     'last_name',
 *     jsonArrayFrom(
 *       eb.selectFrom('pet')
 *         .whereRef('owner_id', '=', 'person.id')
 *         .select(['name', 'species'])
 *     ).as('pets')
 *   ])
 *   .withPlugin(new ParseJSONResultsPlugin())
 *   .execute()
 * ```
 */
export class ParseJSONResultsPlugin {
    opt;
    #objectStrategy;
    constructor(opt = {}) {
        this.opt = opt;
        this.#objectStrategy = opt.objectStrategy || 'in-place';
    }
    // noop
    transformQuery(args) {
        return args.node;
    }
    async transformResult(args) {
        return {
            ...args.result,
            rows: parseArray(args.result.rows, this.#objectStrategy),
        };
    }
}
function parseArray(arr, objectStrategy) {
    const target = objectStrategy === 'create' ? new Array(arr.length) : arr;
    for (let i = 0; i < arr.length; ++i) {
        target[i] = parse(arr[i], objectStrategy);
    }
    return target;
}
function parse(obj, objectStrategy) {
    if (isString(obj)) {
        return parseString(obj);
    }
    if (Array.isArray(obj)) {
        return parseArray(obj, objectStrategy);
    }
    if (isPlainObject(obj)) {
        return parseObject(obj, objectStrategy);
    }
    return obj;
}
function parseString(str) {
    if (maybeJson(str)) {
        try {
            return parse(JSON.parse(str), 'in-place');
        }
        catch (err) {
            // this catch block is intentionally empty.
        }
    }
    return str;
}
function maybeJson(value) {
    return value.match(/^[\[\{]/) != null;
}
function parseObject(obj, objectStrategy) {
    const target = objectStrategy === 'create' ? {} : obj;
    for (const key in obj) {
        target[key] = parse(obj[key], objectStrategy);
    }
    return target;
}
