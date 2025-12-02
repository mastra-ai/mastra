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
var optimistic_updates_impl_exports = {};
__export(optimistic_updates_impl_exports, {
  OptimisticQueryResults: () => OptimisticQueryResults
});
module.exports = __toCommonJS(optimistic_updates_impl_exports);
var import_api = require("../../server/api.js");
var import_common = require("../../common/index.js");
var import_logging = require("../logging.js");
var import_udf_path_utils = require("./udf_path_utils.js");
var import_errors = require("../../values/errors.js");
class OptimisticLocalStoreImpl {
  constructor(queryResults) {
    // A references of the query results in OptimisticQueryResults
    __publicField(this, "queryResults");
    // All of the queries modified by this class
    __publicField(this, "modifiedQueries");
    this.queryResults = queryResults;
    this.modifiedQueries = [];
  }
  getQuery(query, ...args) {
    const queryArgs = (0, import_common.parseArgs)(args[0]);
    const name = (0, import_api.getFunctionName)(query);
    const queryResult = this.queryResults.get(
      (0, import_udf_path_utils.serializePathAndArgs)(name, queryArgs)
    );
    if (queryResult === void 0) {
      return void 0;
    }
    return OptimisticLocalStoreImpl.queryValue(queryResult.result);
  }
  getAllQueries(query) {
    const queriesWithName = [];
    const name = (0, import_api.getFunctionName)(query);
    for (const queryResult of this.queryResults.values()) {
      if (queryResult.udfPath === (0, import_udf_path_utils.canonicalizeUdfPath)(name)) {
        queriesWithName.push({
          args: queryResult.args,
          value: OptimisticLocalStoreImpl.queryValue(queryResult.result)
        });
      }
    }
    return queriesWithName;
  }
  setQuery(queryReference, args, value) {
    const queryArgs = (0, import_common.parseArgs)(args);
    const name = (0, import_api.getFunctionName)(queryReference);
    const queryToken = (0, import_udf_path_utils.serializePathAndArgs)(name, queryArgs);
    let result;
    if (value === void 0) {
      result = void 0;
    } else {
      result = {
        success: true,
        value,
        // It's an optimistic update, so there are no function logs to show.
        logLines: []
      };
    }
    const query = {
      udfPath: name,
      args: queryArgs,
      result
    };
    this.queryResults.set(queryToken, query);
    this.modifiedQueries.push(queryToken);
  }
  static queryValue(result) {
    if (result === void 0) {
      return void 0;
    } else if (result.success) {
      return result.value;
    } else {
      return void 0;
    }
  }
}
class OptimisticQueryResults {
  constructor() {
    __publicField(this, "queryResults");
    __publicField(this, "optimisticUpdates");
    this.queryResults = /* @__PURE__ */ new Map();
    this.optimisticUpdates = [];
  }
  /**
   * Apply all optimistic updates on top of server query results
   */
  ingestQueryResultsFromServer(serverQueryResults, optimisticUpdatesToDrop) {
    this.optimisticUpdates = this.optimisticUpdates.filter((updateAndId) => {
      return !optimisticUpdatesToDrop.has(updateAndId.mutationId);
    });
    const oldQueryResults = this.queryResults;
    this.queryResults = new Map(serverQueryResults);
    const localStore = new OptimisticLocalStoreImpl(this.queryResults);
    for (const updateAndId of this.optimisticUpdates) {
      updateAndId.update(localStore);
    }
    const changedQueries = [];
    for (const [queryToken, query] of this.queryResults) {
      const oldQuery = oldQueryResults.get(queryToken);
      if (oldQuery === void 0 || oldQuery.result !== query.result) {
        changedQueries.push(queryToken);
      }
    }
    return changedQueries;
  }
  applyOptimisticUpdate(update, mutationId) {
    this.optimisticUpdates.push({
      update,
      mutationId
    });
    const localStore = new OptimisticLocalStoreImpl(this.queryResults);
    update(localStore);
    return localStore.modifiedQueries;
  }
  /**
   * @internal
   */
  rawQueryResult(queryToken) {
    return this.queryResults.get(queryToken);
  }
  queryResult(queryToken) {
    const query = this.queryResults.get(queryToken);
    if (query === void 0) {
      return void 0;
    }
    const result = query.result;
    if (result === void 0) {
      return void 0;
    } else if (result.success) {
      return result.value;
    } else {
      if (result.errorData !== void 0) {
        throw (0, import_logging.forwardData)(
          result,
          new import_errors.ConvexError(
            (0, import_logging.createHybridErrorStacktrace)("query", query.udfPath, result)
          )
        );
      }
      throw new Error(
        (0, import_logging.createHybridErrorStacktrace)("query", query.udfPath, result)
      );
    }
  }
  hasQueryResult(queryToken) {
    return this.queryResults.get(queryToken) !== void 0;
  }
  /**
   * @internal
   */
  queryLogs(queryToken) {
    const query = this.queryResults.get(queryToken);
    return query?.result?.logLines;
  }
}
//# sourceMappingURL=optimistic_updates_impl.js.map
