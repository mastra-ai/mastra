import { JSONValue } from "../../values/index.js";
import { PaginationResult, PaginationOptions } from "../pagination.js";
import { Query, QueryInitializer } from "../query.js";
import { ExpressionOrValue, FilterBuilder } from "../filter_builder.js";
import { GenericTableInfo } from "../data_model.js";
import { IndexRangeBuilderImpl, SerializedRangeExpression } from "./index_range_builder_impl.js";
import { SearchFilterBuilderImpl, SerializedSearchFilter } from "./search_filter_builder_impl.js";
type QueryOperator = {
    filter: JSONValue;
} | {
    limit: number;
};
type Source = {
    type: "FullTableScan";
    tableName: string;
    order: "asc" | "desc" | null;
} | {
    type: "IndexRange";
    indexName: string;
    range: ReadonlyArray<SerializedRangeExpression>;
    order: "asc" | "desc" | null;
} | {
    type: "Search";
    indexName: string;
    filters: ReadonlyArray<SerializedSearchFilter>;
};
type SerializedQuery = {
    source: Source;
    operators: Array<QueryOperator>;
};
export declare class QueryInitializerImpl implements QueryInitializer<GenericTableInfo> {
    private tableName;
    constructor(tableName: string);
    withIndex(indexName: string, indexRange?: (q: IndexRangeBuilderImpl) => IndexRangeBuilderImpl): QueryImpl;
    withSearchIndex(indexName: string, searchFilter: (q: SearchFilterBuilderImpl) => SearchFilterBuilderImpl): QueryImpl;
    fullTableScan(): QueryImpl;
    order(order: "asc" | "desc"): QueryImpl;
    count(): Promise<number>;
    filter(predicate: (q: FilterBuilder<GenericTableInfo>) => ExpressionOrValue<boolean>): any;
    limit(n: number): any;
    collect(): Promise<any[]>;
    take(n: number): Promise<Array<any>>;
    paginate(paginationOpts: PaginationOptions): Promise<PaginationResult<any>>;
    first(): Promise<any>;
    unique(): Promise<any>;
    [Symbol.asyncIterator](): AsyncIterableIterator<any>;
}
export declare class QueryImpl implements Query<GenericTableInfo> {
    private state;
    private tableNameForErrorMessages;
    constructor(query: SerializedQuery);
    private takeQuery;
    private startQuery;
    private closeQuery;
    order(order: "asc" | "desc"): QueryImpl;
    filter(predicate: (q: FilterBuilder<GenericTableInfo>) => ExpressionOrValue<boolean>): any;
    limit(n: number): any;
    [Symbol.asyncIterator](): AsyncIterableIterator<any>;
    next(): Promise<IteratorResult<any>>;
    return(): Promise<{
        done: boolean;
        value: undefined;
    }>;
    paginate(paginationOpts: PaginationOptions): Promise<PaginationResult<any>>;
    collect(): Promise<Array<any>>;
    take(n: number): Promise<Array<any>>;
    first(): Promise<any | null>;
    unique(): Promise<any | null>;
}
export {};
//# sourceMappingURL=query_impl.d.ts.map