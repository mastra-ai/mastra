"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { convexOrUndefinedToJson } from "../../values/value.js";
import {
  Expression
} from "../filter_builder.js";
export class ExpressionImpl extends Expression {
  constructor(inner) {
    super();
    __publicField(this, "inner");
    this.inner = inner;
  }
  serialize() {
    return this.inner;
  }
}
export function serializeExpression(expr) {
  if (expr instanceof ExpressionImpl) {
    return expr.serialize();
  } else {
    return { $literal: convexOrUndefinedToJson(expr) };
  }
}
export const filterBuilderImpl = {
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
