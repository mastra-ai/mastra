import type { SelectQueryBuilder } from '../query-builder/select-query-builder.js';
import type { ShallowRecord } from '../util/type-utils.js';
import type { ExtractTableAlias, From, FromTables, TableExpressionOrList } from './table-parser.js';
export type SelectFrom<DB, TB extends keyof DB, TE extends TableExpressionOrList<DB, TB>> = [TE] extends [keyof DB] ? SelectQueryBuilder<DB, TB | ExtractTableAlias<DB, TE>, {}> : [
    TE
] extends [`${infer T} as ${infer A}`] ? T extends keyof DB ? SelectQueryBuilder<DB & ShallowRecord<A, DB[T]>, TB | A, {}> : never : TE extends ReadonlyArray<infer T> ? SelectQueryBuilder<From<DB, T>, FromTables<DB, TB, T>, {}> : SelectQueryBuilder<From<DB, TE>, FromTables<DB, TB, TE>, {}>;
