"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { convexOrUndefinedToJson } from "../../values/value.js";
import {
  IndexRange
} from "../index_range_builder.js";
export class IndexRangeBuilderImpl extends IndexRange {
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
        value: convexOrUndefinedToJson(value)
      })
    );
  }
  gt(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gt",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value)
      })
    );
  }
  gte(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Gte",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value)
      })
    );
  }
  lt(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lt",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value)
      })
    );
  }
  lte(fieldName, value) {
    this.consume();
    return new IndexRangeBuilderImpl(
      this.rangeExpressions.concat({
        type: "Lte",
        fieldPath: fieldName,
        value: convexOrUndefinedToJson(value)
      })
    );
  }
  export() {
    this.consume();
    return this.rangeExpressions;
  }
}
//# sourceMappingURL=index_range_builder_impl.js.map
