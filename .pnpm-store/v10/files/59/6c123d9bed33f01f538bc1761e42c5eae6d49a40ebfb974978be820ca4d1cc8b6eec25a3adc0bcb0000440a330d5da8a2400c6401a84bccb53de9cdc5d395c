/// <reference types="./sqlite-introspector.d.ts" />
import { DEFAULT_MIGRATION_LOCK_TABLE, DEFAULT_MIGRATION_TABLE, } from '../../migration/migrator.js';
import { sql } from '../../raw-builder/sql.js';
export class SqliteIntrospector {
    #db;
    constructor(db) {
        this.#db = db;
    }
    async getSchemas() {
        // Sqlite doesn't support schemas.
        return [];
    }
    async getTables(options = { withInternalKyselyTables: false }) {
        return await this.#getTableMetadata(options);
    }
    async getMetadata(options) {
        return {
            tables: await this.getTables(options),
        };
    }
    #tablesQuery(qb, options) {
        let tablesQuery = qb
            .selectFrom('sqlite_master')
            .where('type', 'in', ['table', 'view'])
            .where('name', 'not like', 'sqlite_%')
            .select(['name', 'sql', 'type'])
            .orderBy('name');
        if (!options.withInternalKyselyTables) {
            tablesQuery = tablesQuery
                .where('name', '!=', DEFAULT_MIGRATION_TABLE)
                .where('name', '!=', DEFAULT_MIGRATION_LOCK_TABLE);
        }
        return tablesQuery;
    }
    async #getTableMetadata(options) {
        const tablesResult = await this.#tablesQuery(this.#db, options).execute();
        const tableMetadata = await this.#db
            .with('table_list', (qb) => this.#tablesQuery(qb, options))
            .selectFrom([
            'table_list as tl',
            sql `pragma_table_info(tl.name)`.as('p'),
        ])
            .select([
            'tl.name as table',
            'p.cid',
            'p.name',
            'p.type',
            'p.notnull',
            'p.dflt_value',
            'p.pk',
        ])
            .orderBy('tl.name')
            .orderBy('p.cid')
            .execute();
        const columnsByTable = {};
        for (const row of tableMetadata) {
            columnsByTable[row.table] ??= [];
            columnsByTable[row.table].push(row);
        }
        return tablesResult.map(({ name, sql, type }) => {
            // // Try to find the name of the column that has `autoincrement` 🤦
            let autoIncrementCol = sql
                ?.split(/[\(\),]/)
                ?.find((it) => it.toLowerCase().includes('autoincrement'))
                ?.trimStart()
                ?.split(/\s+/)?.[0]
                ?.replace(/["`]/g, '');
            const columns = columnsByTable[name] ?? [];
            // Otherwise, check for an INTEGER PRIMARY KEY
            // https://www.sqlite.org/autoinc.html
            if (!autoIncrementCol) {
                const pkCols = columns.filter((r) => r.pk > 0);
                if (pkCols.length === 1 && pkCols[0].type.toLowerCase() === 'integer') {
                    autoIncrementCol = pkCols[0].name;
                }
            }
            return {
                name: name,
                isView: type === 'view',
                columns: columns.map((col) => ({
                    name: col.name,
                    dataType: col.type,
                    isNullable: !col.notnull,
                    isAutoIncrementing: col.name === autoIncrementCol,
                    hasDefaultValue: col.dflt_value != null,
                    comment: undefined,
                })),
            };
        });
    }
}
