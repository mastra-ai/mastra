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
var filter_builder_impl_exports = {};
__export(filter_builder_impl_exports, {
  ExpressionImpl: () => ExpressionImpl,
  filterBuilderImpl: () => filterBuilderImpl,
  serializeExpression: () => serializeExpression
});
module.exports = __toCommonJS(filter_builder_impl_exports);
var import_value = require("../../values/value.js");
var import_filter_builder = require("../filter_builder.js");
class ExpressionImpl extends import_filter_builder.Expression {
  constructor(inner) {
    super();
    __publicField(this, "inner");
    this.inner = inner;
  }
  serialize() {
    return this.inner;
  }
}
function serializeExpression(expr) {
  if (expr instanceof ExpressionImpl) {
    return expr.serialize();
  } else {
    return { $literal: (0, import_value.convexOrUndefinedToJson)(expr) };
  }
}
const filterBuilderImpl = {
  //  Comparisons  /////////////////////////////////////////////////////////////
  eq(l, r) {
    return new ExpressionImpl({
      $eq: [serializeExpression(l), serializeExpression(r)]
    });
  },
  neq(l, r) {
    return new ExpressionImpl({
      $neq: [serializeExpression(l), serializeExpression(r)]
    });
  },
  lt(l, r) {
    return new ExpressionImpl({
      $lt: [serializeExpression(l), serializeExpression(r)]
    });
  },
  lte(l, r) {
    return new ExpressionImpl({
      $lte: [serializeExpression(l), serializeExpression(r)]
    });
  },
  gt(l, r) {
    return new ExpressionImpl({
      $gt: [serializeExpression(l), serializeExpression(r)]
    });
  },
  gte(l, r) {
    return new ExpressionImpl({
      $gte: [serializeExpression(l), serializeExpression(r)]
    });
  },
  //  Arithmetic  //////////////////////////////////////////////////////////////
  add(l, r) {
    return new ExpressionImpl({
      $add: [serializeExpression(l), serializeExpression(r)]
    });
  },
  sub(l, r) {
    return new ExpressionImpl({
      $sub: [serializeExpression(l), serializeExpression(r)]
    });
  },
  mul(l, r) {
    return new ExpressionImpl({
      $mul: [serializeExpression(l), serializeExpression(r)]
    });
  },
  div(l, r) {
    return new ExpressionImpl({
      $div: [serializeExpression(l), serializeExpression(r)]
    });
  },
  mod(l, r) {
    return new ExpressionImpl({
      $mod: [serializeExpression(l), serializeExpression(r)]
    });
  },
  neg(x) {
    return new ExpressionImpl({ $neg: serializeExpression(x) });
  },
  //  Logic  ///////////////////////////////////////////////////////////////////
  and(...exprs) {
    return new ExpressionImpl({ $and: exprs.map(serializeExpression) });
  },
  or(...exprs) {
    return new ExpressionImpl({ $or: exprs.map(serializeExpression) });
  },
  not(x) {
    return new ExpressionImpl({ $not: serializeExpression(x) });
  },
  //  Other  ///////////////////////////////////////////////////////////////////
  field(fieldPath) {
    return new ExpressionImpl({ $field: fieldPath });
  }
};
//# sourceMappingURL=filter_builder_impl.js.map
