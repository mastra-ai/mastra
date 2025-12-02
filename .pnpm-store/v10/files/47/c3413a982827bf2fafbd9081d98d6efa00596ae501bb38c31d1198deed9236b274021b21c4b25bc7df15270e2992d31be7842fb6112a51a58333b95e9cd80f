"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { performAsyncSyscall } from "./syscall.js";
import { version } from "../../index.js";
import {
  FilterExpression
} from "../vector_search.js";
import { validateArg } from "./validate.js";
import { convexOrUndefinedToJson } from "../../values/value.js";
export function setupActionVectorSearch(requestId) {
  return async (tableName, indexName, query) => {
    validateArg(tableName, 1, "vectorSearch", "tableName");
    validateArg(indexName, 2, "vectorSearch", "indexName");
    validateArg(query, 3, "vectorSearch", "query");
    if (!query.vector || !Array.isArray(query.vector) || query.vector.length === 0) {
      throw Error("`vector` must be a non-empty Array in vectorSearch");
    }
    return await new VectorQueryImpl(
      requestId,
      tableName + "." + indexName,
      query
    ).collect();
  };
}
export class VectorQueryImpl {
  constructor(requestId, indexName, query) {
    __publicField(this, "requestId");
    __publicField(this, "state");
    this.requestId = requestId;
    const filters = query.filter ? serializeExpression(query.filter(filterBuilderImpl)) : null;
    this.state = {
      type: "preparing",
      query: {
        indexName,
        limit: query.limit,
        vector: query.vector,
        expressions: filters
      }
    };
  }
  async collect() {
    if (this.state.type === "consumed") {
      throw new Error("This query is closed and can't emit any more values.");
    }
    const query = this.state.query;
    this.state = { type: "consumed" };
    const { results } = await performAsyncSyscall("1.0/actions/vectorSearch", {
      requestId: this.requestId,
      version,
      query
    });
    return results;
  }
}
export class ExpressionImpl extends FilterExpression {
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
  eq(fieldName, value) {
    if (typeof fieldName !== "string") {
      throw new Error("The first argument to `q.eq` must be a field name.");
    }
    return new ExpressionImpl({
      $eq: [
        serializeExpression(new ExpressionImpl({ $field: fieldName })),
        serializeExpression(value)
      ]
    });
  },
  //  Logic  ///////////////////////////////////////////////////////////////////
  or(...exprs) {
    return new ExpressionImpl({ $or: exprs.map(serializeExpression) });
  }
};
//# sourceMappingURL=vector_search_impl.js.map
