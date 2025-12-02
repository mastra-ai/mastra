"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { convexOrUndefinedToJson } from "../../values/value.js";
import {
  SearchFilter
} from "../search_filter_builder.js";
import { validateArg } from "./validate.js";
export class SearchFilterBuilderImpl extends SearchFilter {
  constructor(filters) {
    super();
    __publicField(this, "filters");
    __publicField(this, "isConsumed");
    this.filters = filters;
    this.isConsumed = false;
  }
  static new() {
    return new SearchFilterBuilderImpl([]);
  }
  consume() {
    if (this.isConsumed) {
      throw new Error(
        "SearchFilterBuilder has already been used! Chain your method calls like `q => q.search(...).eq(...)`."
      );
    }
    this.isConsumed = true;
  }
  search(fieldName, query) {
    validateArg(fieldName, 1, "search", "fieldName");
    validateArg(query, 2, "search", "query");
    this.consume();
    return new SearchFilterBuilderImpl(
      this.filters.concat({
        type: "Search",
        fieldPath: fieldName,
        value: query
      })
    );
  }
  eq(fieldName, value) {
    validateArg(fieldName, 1, "eq", "fieldName");
    if (arguments.length !== 2) {
      validateArg(value, 2, "search", "value");
    }
    this.consume();
    return new SearchFilterBuilderImpl(
      this.filters.concat({
        type: "Eq",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value)
      })
    );
  }
  export() {
    this.consume();
    return this.filters;
  }
}
//# sourceMappingURL=search_filter_builder_impl.js.map
