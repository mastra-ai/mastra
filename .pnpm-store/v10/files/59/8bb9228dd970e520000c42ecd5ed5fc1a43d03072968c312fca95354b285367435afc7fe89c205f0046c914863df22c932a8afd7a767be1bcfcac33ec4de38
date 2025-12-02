/// <reference types="./camel-case-plugin.d.ts" />
import { isPlainObject } from '../../util/object-utils.js';
import { SnakeCaseTransformer } from './camel-case-transformer.js';
import { createCamelCaseMapper, createSnakeCaseMapper, } from './camel-case.js';
/**
 * A plugin that converts snake_case identifiers in the database into
 * camelCase in the JavaScript side.
 *
 * For example let's assume we have a table called `person_table`
 * with columns `first_name` and `last_name` in the database. When
 * using `CamelCasePlugin` we would setup Kysely like this:
 *
 * ```ts
 * import * as Sqlite from 'better-sqlite3'
 * import { CamelCasePlugin, Kysely, SqliteDialect } from 'kysely'
 *
 * interface CamelCasedDatabase {
 *   userMetadata: {
 *     firstName: string
 *     lastName: string
 *   }
 * }
 *
 * const db = new Kysely<CamelCasedDatabase>({
 *   dialect: new SqliteDialect({
 *     database: new Sqlite(':memory:'),
 *   }),
 *   plugins: [new CamelCasePlugin()],
 * })
 *
 * const person = await db.selectFrom('userMetadata')
 *   .where('firstName', '=', 'Arnold')
 *   .select(['firstName', 'lastName'])
 *   .executeTakeFirst()
 *
 * if (person) {
 *   console.log(person.firstName)
 * }
 * ```
 *
 * The generated SQL (SQLite):
 *
 * ```sql
 * select "first_name", "last_name" from "user_metadata" where "first_name" = ?
 * ```
 *
 * As you can see from the example, __everything__ needs to be defined
 * in camelCase in the TypeScript code: table names, columns, schemas,
 * __everything__. When using the `CamelCasePlugin` Kysely works as if
 * the database was defined in camelCase.
 *
 * There are various options you can give to the plugin to modify
 * the way identifiers are converted. See {@link CamelCasePluginOptions}.
 * If those options are not enough, you can override this plugin's
 * `snakeCase` and `camelCase` methods to make the conversion exactly
 * the way you like:
 *
 * ```ts
 * class MyCamelCasePlugin extends CamelCasePlugin {
 *   protected override snakeCase(str: string): string {
 *     // ...
 *
 *     return str
 *   }
 *
 *   protected override camelCase(str: string): string {
 *     // ...
 *
 *     return str
 *   }
 * }
 * ```
 */
export class CamelCasePlugin {
    opt;
    #camelCase;
    #snakeCase;
    #snakeCaseTransformer;
    constructor(opt = {}) {
        this.opt = opt;
        this.#camelCase = createCamelCaseMapper(opt);
        this.#snakeCase = createSnakeCaseMapper(opt);
        this.#snakeCaseTransformer = new SnakeCaseTransformer(this.snakeCase.bind(this));
    }
    transformQuery(args) {
        return this.#snakeCaseTransformer.transformNode(args.node, args.queryId);
    }
    async transformResult(args) {
        if (args.result.rows && Array.isArray(args.result.rows)) {
            return {
                ...args.result,
                rows: args.result.rows.map((row) => this.mapRow(row)),
            };
        }
        return args.result;
    }
    mapRow(row) {
        return Object.keys(row).reduce((obj, key) => {
            let value = row[key];
            if (Array.isArray(value)) {
                value = value.map((it) => (canMap(it, this.opt) ? this.mapRow(it) : it));
            }
            else if (canMap(value, this.opt)) {
                value = this.mapRow(value);
            }
            obj[this.camelCase(key)] = value;
            return obj;
        }, {});
    }
    snakeCase(str) {
        return this.#snakeCase(str);
    }
    camelCase(str) {
        return this.#camelCase(str);
    }
}
function canMap(obj, opt) {
    return isPlainObject(obj) && !opt?.maintainNestedObjectKeys;
}
