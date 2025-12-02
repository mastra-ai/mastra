"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var search_filter_builder_impl_exports = {};
__export(search_filter_builder_impl_exports, {
  SearchFilterBuilderImpl: () => SearchFilterBuilderImpl
});
module.exports = __toCommonJS(search_filter_builder_impl_exports);
var import_value = require("../../values/value.js");
var import_search_filter_builder = require("../search_filter_builder.js");
var import_validate = require("./validate.js");
class SearchFilterBuilderImpl extends import_search_filter_builder.SearchFilter {
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
    (0, import_validate.validateArg)(fieldName, 1, "search", "fieldName");
    (0, import_validate.validateArg)(query, 2, "search", "query");
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
    (0, import_validate.validateArg)(fieldName, 1, "eq", "fieldName");
    if (arguments.length !== 2) {
      (0, import_validate.validateArg)(value, 2, "search", "value");
    }
    this.consume();
    return new SearchFilterBuilderImpl(
      this.filters.concat({
        type: "Eq",
        fieldPath: fieldName,
        value: (0, import_value.convexOrUndefinedToJson)(value)
      })
    );
  }
  export() {
    this.consume();
    return this.filters;
  }
}
//# sourceMappingURL=search_filter_builder_impl.js.map
