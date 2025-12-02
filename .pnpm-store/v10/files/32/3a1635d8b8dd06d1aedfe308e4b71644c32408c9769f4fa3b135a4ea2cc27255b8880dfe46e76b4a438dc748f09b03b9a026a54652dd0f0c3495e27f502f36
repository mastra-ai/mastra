"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MysqlIntrospector = void 0;
const migrator_js_1 = require("../../migration/migrator.js");
const object_utils_js_1 = require("../../util/object-utils.js");
const sql_js_1 = require("../../raw-builder/sql.js");
class MysqlIntrospector {
    #db;
    constructor(db) {
        this.#db = db;
    }
    async getSchemas() {
        let rawSchemas = await this.#db
            .selectFrom('information_schema.schemata')
            .select('schema_name')
            .$castTo()
            .execute();
        return rawSchemas.map((it) => ({ name: it.SCHEMA_NAME }));
    }
    async getTables(options = { withInternalKyselyTables: false }) {
        let query = this.#db
            .selectFrom('information_schema.columns as columns')
            .innerJoin('information_schema.tables as tables', (b) => b
            .onRef('columns.TABLE_CATALOG', '=', 'tables.TABLE_CATALOG')
            .onRef('columns.TABLE_SCHEMA', '=', 'tables.TABLE_SCHEMA')
            .onRef('columns.TABLE_NAME', '=', 'tables.TABLE_NAME'))
            .select([
            'columns.COLUMN_NAME',
            'columns.COLUMN_DEFAULT',
            'columns.TABLE_NAME',
            'columns.TABLE_SCHEMA',
            'tables.TABLE_TYPE',
            'columns.IS_NULLABLE',
            'columns.DATA_TYPE',
            'columns.EXTRA',
            'columns.COLUMN_COMMENT',
        ])
            .where('columns.TABLE_SCHEMA', '=', (0, sql_js_1.sql) `database()`)
            .orderBy('columns.TABLE_NAME')
            .orderBy('columns.ORDINAL_POSITION')
            .$castTo();
        if (!options.withInternalKyselyTables) {
            query = query
                .where('columns.TABLE_NAME', '!=', migrator_js_1.DEFAULT_MIGRATION_TABLE)
                .where('columns.TABLE_NAME', '!=', migrator_js_1.DEFAULT_MIGRATION_LOCK_TABLE);
        }
        const rawColumns = await query.execute();
        return this.#parseTableMetadata(rawColumns);
    }
    async getMetadata(options) {
        return {
            tables: await this.getTables(options),
        };
    }
    #parseTableMetadata(columns) {
        return columns.reduce((tables, it) => {
            let table = tables.find((tbl) => tbl.name === it.TABLE_NAME);
            if (!table) {
                table = (0, object_utils_js_1.freeze)({
                    name: it.TABLE_NAME,
                    isView: it.TABLE_TYPE === 'VIEW',
                    schema: it.TABLE_SCHEMA,
                    columns: [],
                });
                tables.push(table);
            }
            table.columns.push((0, object_utils_js_1.freeze)({
                name: it.COLUMN_NAME,
                dataType: it.DATA_TYPE,
                isNullable: it.IS_NULLABLE === 'YES',
                isAutoIncrementing: it.EXTRA.toLowerCase().includes('auto_increment'),
                hasDefaultValue: it.COLUMN_DEFAULT !== null,
                comment: it.COLUMN_COMMENT === '' ? undefined : it.COLUMN_COMMENT,
            }));
            return tables;
        }, []);
    }
}
exports.MysqlIntrospector = MysqlIntrospector;
