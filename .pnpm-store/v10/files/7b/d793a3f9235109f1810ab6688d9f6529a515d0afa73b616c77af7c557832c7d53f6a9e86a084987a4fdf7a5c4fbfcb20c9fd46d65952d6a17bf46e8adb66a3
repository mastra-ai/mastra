"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MssqlIntrospector = void 0;
const migrator_js_1 = require("../../migration/migrator.js");
const object_utils_js_1 = require("../../util/object-utils.js");
class MssqlIntrospector {
    #db;
    constructor(db) {
        this.#db = db;
    }
    async getSchemas() {
        return await this.#db.selectFrom('sys.schemas').select('name').execute();
    }
    async getTables(options = { withInternalKyselyTables: false }) {
        const rawColumns = await this.#db
            .selectFrom('sys.tables as tables')
            .leftJoin('sys.schemas as table_schemas', 'table_schemas.schema_id', 'tables.schema_id')
            .innerJoin('sys.columns as columns', 'columns.object_id', 'tables.object_id')
            .innerJoin('sys.types as types', 'types.user_type_id', 'columns.user_type_id')
            .leftJoin('sys.schemas as type_schemas', 'type_schemas.schema_id', 'types.schema_id')
            .leftJoin('sys.extended_properties as comments', (join) => join
            .onRef('comments.major_id', '=', 'tables.object_id')
            .onRef('comments.minor_id', '=', 'columns.column_id')
            .on('comments.name', '=', 'MS_Description'))
            .$if(!options.withInternalKyselyTables, (qb) => qb
            .where('tables.name', '!=', migrator_js_1.DEFAULT_MIGRATION_TABLE)
            .where('tables.name', '!=', migrator_js_1.DEFAULT_MIGRATION_LOCK_TABLE))
            .select([
            'tables.name as table_name',
            (eb) => eb
                .ref('tables.type')
                .$castTo()
                .as('table_type'),
            'table_schemas.name as table_schema_name',
            'columns.default_object_id as column_default_object_id',
            'columns.generated_always_type_desc as column_generated_always_type',
            'columns.is_computed as column_is_computed',
            'columns.is_identity as column_is_identity',
            'columns.is_nullable as column_is_nullable',
            'columns.is_rowguidcol as column_is_rowguidcol',
            'columns.name as column_name',
            'types.is_nullable as type_is_nullable',
            'types.name as type_name',
            'type_schemas.name as type_schema_name',
            'comments.value as column_comment',
        ])
            .unionAll(this.#db
            .selectFrom('sys.views as views')
            .leftJoin('sys.schemas as view_schemas', 'view_schemas.schema_id', 'views.schema_id')
            .innerJoin('sys.columns as columns', 'columns.object_id', 'views.object_id')
            .innerJoin('sys.types as types', 'types.user_type_id', 'columns.user_type_id')
            .leftJoin('sys.schemas as type_schemas', 'type_schemas.schema_id', 'types.schema_id')
            .leftJoin('sys.extended_properties as comments', (join) => join
            .onRef('comments.major_id', '=', 'views.object_id')
            .onRef('comments.minor_id', '=', 'columns.column_id')
            .on('comments.name', '=', 'MS_Description'))
            .select([
            'views.name as table_name',
            'views.type as table_type',
            'view_schemas.name as table_schema_name',
            'columns.default_object_id as column_default_object_id',
            'columns.generated_always_type_desc as column_generated_always_type',
            'columns.is_computed as column_is_computed',
            'columns.is_identity as column_is_identity',
            'columns.is_nullable as column_is_nullable',
            'columns.is_rowguidcol as column_is_rowguidcol',
            'columns.name as column_name',
            'types.is_nullable as type_is_nullable',
            'types.name as type_name',
            'type_schemas.name as type_schema_name',
            'comments.value as column_comment',
        ]))
            .orderBy('table_schema_name')
            .orderBy('table_name')
            .orderBy('column_name')
            .execute();
        const tableDictionary = {};
        for (const rawColumn of rawColumns) {
            const key = `${rawColumn.table_schema_name}.${rawColumn.table_name}`;
            const table = (tableDictionary[key] =
                tableDictionary[key] ||
                    (0, object_utils_js_1.freeze)({
                        columns: [],
                        isView: rawColumn.table_type === 'V ',
                        name: rawColumn.table_name,
                        schema: rawColumn.table_schema_name ?? undefined,
                    }));
            table.columns.push((0, object_utils_js_1.freeze)({
                dataType: rawColumn.type_name,
                dataTypeSchema: rawColumn.type_schema_name ?? undefined,
                hasDefaultValue: rawColumn.column_default_object_id > 0 ||
                    rawColumn.column_generated_always_type !== 'NOT_APPLICABLE' ||
                    rawColumn.column_is_identity ||
                    rawColumn.column_is_computed ||
                    rawColumn.column_is_rowguidcol,
                isAutoIncrementing: rawColumn.column_is_identity,
                isNullable: rawColumn.column_is_nullable && rawColumn.type_is_nullable,
                name: rawColumn.column_name,
                comment: rawColumn.column_comment ?? undefined,
            }));
        }
        return Object.values(tableDictionary);
    }
    async getMetadata(options) {
        return {
            tables: await this.getTables(options),
        };
    }
}
exports.MssqlIntrospector = MssqlIntrospector;
