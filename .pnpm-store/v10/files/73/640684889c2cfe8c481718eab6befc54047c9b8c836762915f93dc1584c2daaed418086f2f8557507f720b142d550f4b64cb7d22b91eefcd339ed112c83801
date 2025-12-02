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
var index_range_builder_impl_exports = {};
__export(index_range_builder_impl_exports, {
  IndexRangeBuilderImpl: () => IndexRangeBuilderImpl
});
module.exports = __toCommonJS(index_range_builder_impl_exports);
var import_value = require("../../values/value.js");
var import_index_range_builder = require("../index_range_builder.js");
class IndexRangeBuilderImpl extends import_index_range_builder.IndexRange {
  constructor(rangeExpressions) {
    super();
    __publicField(this, "rangeExpressions");
    __publicField(this, "isConsumed");
    this.rangeExpressions = rangeExpressions;
    this.isConsumed = false;
  }
  static new() {
    return new IndexRangeBuilderImpl([]);
  }
  consume() {
    if (this.isConsumed) {
      throw new Error(
        "IndexRangeBuilder has already been used! Chain your method calls like `q => q.eq(...).eq(...)`. See https://docs.convex.dev/using/indexes"
      );
    }
    this.isConsumed = true;
  }
  eq(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Eq",
        fieldPath: fieldName,
        value: (0, import_value.convexOrUndefinedToJson)(value)
      })
    );
  }
  gt(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gt",
        fieldPath: fieldName,
        value: (0, import_value.convexOrUndefinedToJson)(value)
      })
    );
  }
  gte(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gte",
        fieldPath: fieldName,
        value: (0, import_value.convexOrUndefinedToJson)(value)
      })
    );
  }
  lt(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lt",
        fieldPath: fieldName,
        value: (0, import_value.convexOrUndefinedToJson)(value)
      })
    );
  }
  lte(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lte",
        fieldPath: fieldName,
        value: (0, import_value.convexOrUndefinedToJson)(value)
      })
    );
  }
  export() {
    this.consume();
    return this.rangeExpressions;
  }
}
//# sourceMappingURL=index_range_builder_impl.js.map
