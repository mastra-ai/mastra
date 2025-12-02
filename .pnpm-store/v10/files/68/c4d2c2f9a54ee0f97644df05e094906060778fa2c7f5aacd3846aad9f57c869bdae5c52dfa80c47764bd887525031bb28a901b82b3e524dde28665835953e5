import { QueryId } from '../util/query-id.js';
import { RootOperationNode } from './query-compiler.js';
export interface CompiledQuery<O = unknown> {
    readonly query: RootOperationNode;
    readonly queryId: QueryId;
    readonly sql: string;
    readonly parameters: ReadonlyArray<unknown>;
}
export declare const CompiledQuery: Readonly<{
    raw(sql: string, parameters?: unknown[]): CompiledQuery;
}>;
