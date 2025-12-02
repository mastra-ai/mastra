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
var vector_search_impl_exports = {};
__export(vector_search_impl_exports, {
  ExpressionImpl: () => ExpressionImpl,
  VectorQueryImpl: () => VectorQueryImpl,
  filterBuilderImpl: () => filterBuilderImpl,
  serializeExpression: () => serializeExpression,
  setupActionVectorSearch: () => setupActionVectorSearch
});
module.exports = __toCommonJS(vector_search_impl_exports);
var import_syscall = require("./syscall.js");
var import__ = require("../../index.js");
var import_vector_search = require("../vector_search.js");
var import_validate = require("./validate.js");
var import_value = require("../../values/value.js");
function setupActionVectorSearch(requestId) {
  return async (tableName, indexName, query) => {
    (0, import_validate.validateArg)(tableName, 1, "vectorSearch", "tableName");
    (0, import_validate.validateArg)(indexName, 2, "vectorSearch", "indexName");
    (0, import_validate.validateArg)(query, 3, "vectorSearch", "query");
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
class VectorQueryImpl {
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
    const { results } = await (0, import_syscall.performAsyncSyscall)("1.0/actions/vectorSearch", {
      requestId: this.requestId,
      version: import__.version,
      query
    });
    return results;
  }
}
class ExpressionImpl extends import_vector_search.FilterExpression {
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
