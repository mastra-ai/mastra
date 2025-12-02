import { JSONValue, Value } from "../../values/index.js";
import { GenericDocument, GenericIndexFields } from "../data_model.js";
import { IndexRange, IndexRangeBuilder, LowerBoundIndexRangeBuilder, UpperBoundIndexRangeBuilder } from "../index_range_builder.js";
export type SerializedRangeExpression = {
    type: "Eq" | "Gt" | "Gte" | "Lt" | "Lte";
    fieldPath: string;
    value: JSONValue;
};
export declare class IndexRangeBuilderImpl extends IndexRange implements IndexRangeBuilder<GenericDocument, GenericIndexFields>, LowerBoundIndexRangeBuilder<GenericDocument, string>, UpperBoundIndexRangeBuilder<GenericDocument, string> {
    private rangeExpressions;
    private isConsumed;
    private constructor();
    static new(): IndexRangeBuilderImpl;
    private consume;
    eq(fieldName: string, value: Value): IndexRangeBuilderImpl;
    gt(fieldName: string, value: Value): IndexRangeBuilderImpl;
    gte(fieldName: string, value: Value): IndexRangeBuilderImpl;
    lt(fieldName: string, value: Value): IndexRangeBuilderImpl;
    lte(fieldName: string, value: Value): IndexRangeBuilderImpl;
    export(): readonly SerializedRangeExpression[];
}
//# sourceMappingURL=index_range_builder_impl.d.ts.map