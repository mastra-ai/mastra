import { JSONValue } from "../../values/value.js";
import { FieldTypeFromFieldPath, GenericDocument, GenericSearchIndexConfig } from "../data_model.js";
import { SearchFilter, SearchFilterBuilder, SearchFilterFinalizer } from "../search_filter_builder.js";
export type SerializedSearchFilter = {
    type: "Search";
    fieldPath: string;
    value: string;
} | {
    type: "Eq";
    fieldPath: string;
    value: JSONValue;
};
export declare class SearchFilterBuilderImpl extends SearchFilter implements SearchFilterBuilder<GenericDocument, GenericSearchIndexConfig>, SearchFilterFinalizer<GenericDocument, GenericSearchIndexConfig> {
    private filters;
    private isConsumed;
    private constructor();
    static new(): SearchFilterBuilderImpl;
    private consume;
    search(fieldName: string, query: string): SearchFilterFinalizer<GenericDocument, GenericSearchIndexConfig>;
    eq<FieldName extends string>(fieldName: FieldName, value: FieldTypeFromFieldPath<GenericDocument, FieldName>): SearchFilterFinalizer<GenericDocument, GenericSearchIndexConfig>;
    export(): readonly SerializedSearchFilter[];
}
//# sourceMappingURL=search_filter_builder_impl.d.ts.map