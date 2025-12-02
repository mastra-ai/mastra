import type { UpdateQueryBuilder } from '../query-builder/update-query-builder.js';
import type { UpdateResult } from '../query-builder/update-result.js';
import type { ShallowRecord } from '../util/type-utils.js';
import type { ExtractTableAlias, From, FromTables, TableExpressionOrList } from './table-parser.js';
export type UpdateTable<DB, TE extends TableExpressionOrList<DB, never>> = [
    TE
] extends [keyof DB] ? UpdateQueryBuilder<DB, ExtractTableAlias<DB, TE>, ExtractTableAlias<DB, TE>, UpdateResult> : [
    TE
] extends [`${infer T} as ${infer A}`] ? T extends keyof DB ? UpdateQueryBuilder<DB & ShallowRecord<A, DB[T]>, A, A, UpdateResult> : never : TE extends ReadonlyArray<infer T> ? UpdateQueryBuilder<From<DB, T>, FromTables<DB, never, T>, FromTables<DB, never, T>, UpdateResult> : UpdateQueryBuilder<From<DB, TE>, FromTables<DB, never, TE>, FromTables<DB, never, TE>, UpdateResult>;
