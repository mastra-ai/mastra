import { JSONValue } from "../../values/index.js";
import { FilterExpression, VectorFilterBuilder, VectorSearch, VectorSearchQuery } from "../vector_search.js";
import { GenericDataModel, GenericDocument, GenericTableInfo, GenericVectorIndexConfig } from "../data_model.js";
import { Value } from "../../values/value.js";
export declare function setupActionVectorSearch(requestId: string): VectorSearch<GenericDataModel, string, string>;
export declare class VectorQueryImpl {
    private requestId;
    private state;
    constructor(requestId: string, indexName: string, query: VectorSearchQuery<GenericTableInfo, string>);
    collect(): Promise<Array<any>>;
}
type ExpressionOrValue<T extends Value | undefined> = FilterExpression<T> | T;
export declare class ExpressionImpl extends FilterExpression<any> {
    private inner;
    constructor(inner: JSONValue);
    serialize(): JSONValue;
}
export declare function serializeExpression(expr: ExpressionOrValue<Value | undefined>): JSONValue;
export declare const filterBuilderImpl: VectorFilterBuilder<GenericDocument, GenericVectorIndexConfig>;
export {};
//# sourceMappingURL=vector_search_impl.d.ts.map