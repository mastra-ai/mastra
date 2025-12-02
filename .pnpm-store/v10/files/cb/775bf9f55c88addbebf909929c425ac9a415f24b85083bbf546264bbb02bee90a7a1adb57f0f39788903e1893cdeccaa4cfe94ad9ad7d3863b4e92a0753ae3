import type { DeleteQueryBuilder } from '../query-builder/delete-query-builder.js';
import type { DeleteResult } from '../query-builder/delete-result.js';
import type { ShallowRecord } from '../util/type-utils.js';
import type { ExtractTableAlias, From, FromTables, TableExpressionOrList } from './table-parser.js';
export type DeleteFrom<DB, TE extends TableExpressionOrList<DB, never>> = [
    TE
] extends [keyof DB] ? DeleteQueryBuilder<DB, ExtractTableAlias<DB, TE>, DeleteResult> : [
    TE
] extends [`${infer T} as ${infer A}`] ? T extends keyof DB ? DeleteQueryBuilder<DB & ShallowRecord<A, DB[T]>, A, DeleteResult> : never : TE extends ReadonlyArray<infer T> ? DeleteQueryBuilder<From<DB, T>, FromTables<DB, never, T>, DeleteResult> : DeleteQueryBuilder<From<DB, TE>, FromTables<DB, never, TE>, DeleteResult>;
