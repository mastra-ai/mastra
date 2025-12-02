import { JSONValue, convexOrUndefinedToJson } from "../../values/value.js";
import {
  FieldTypeFromFieldPath,
  GenericDocument,
  GenericSearchIndexConfig,
} from "../data_model.js";
import {
  SearchFilter,
  SearchFilterBuilder,
  SearchFilterFinalizer,
} from "../search_filter_builder.js";
import { validateArg } from "./validate.js";

export type SerializedSearchFilter =
  | {
      type: "Search";
      fieldPath: string;
      value: string;
    }
  | {
      type: "Eq";
      fieldPath: string;
      value: JSONValue;
    };

export class SearchFilterBuilderImpl
  extends SearchFilter
  implements
    SearchFilterBuilder<GenericDocument, GenericSearchIndexConfig>,
    SearchFilterFinalizer<GenericDocument, GenericSearchIndexConfig>
{
  private filters: ReadonlyArray<SerializedSearchFilter>;
  private isConsumed: boolean;
  private constructor(filters: ReadonlyArray<SerializedSearchFilter>) {
    super();
    this.filters = filters;
    this.isConsumed = false;
  }

  static new(): SearchFilterBuilderImpl {
    return new SearchFilterBuilderImpl([]);
  }

  private consume() {
    if (this.isConsumed) {
      throw new Error(
        "SearchFilterBuilder has already been used! Chain your method calls like `q => q.search(...).eq(...)`.",
      );
    }
    this.isConsumed = true;
  }

  search(
    fieldName: string,
    query: string,
  ): SearchFilterFinalizer<GenericDocument, GenericSearchIndexConfig> {
    validateArg(fieldName, 1, "search", "fieldName");
    validateArg(query, 2, "search", "query");
    this.consume();
    return new SearchFilterBuilderImpl(
      this.filters.concat({
        type: "Search",
        fieldPath: fieldName,
        value: query,
      }),
    );
  }
  eq<FieldName extends string>(
    fieldName: FieldName,
    value: FieldTypeFromFieldPath<GenericDocument, FieldName>,
  ): SearchFilterFinalizer<GenericDocument, GenericSearchIndexConfig> {
    validateArg(fieldName, 1, "eq", "fieldName");
    // when `undefined` is passed explicitly, it is allowed.
    if (arguments.length !== 2) {
      validateArg(value, 2, "search", "value");
    }
    this.consume();
    return new SearchFilterBuilderImpl(
      this.filters.concat({
        type: "Eq",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value),
      }),
    );
  }

  export() {
    this.consume();
    return this.filters;
  }
}
