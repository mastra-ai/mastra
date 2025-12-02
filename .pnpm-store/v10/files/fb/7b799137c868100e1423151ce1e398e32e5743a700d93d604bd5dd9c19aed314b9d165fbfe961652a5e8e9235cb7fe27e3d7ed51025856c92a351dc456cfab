"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import {
  getFunctionName
} from "../../server/api.js";
import { parseArgs } from "../../common/index.js";
import { createHybridErrorStacktrace, forwardData } from "../logging.js";
import {
  canonicalizeUdfPath,
  serializePathAndArgs
} from "./udf_path_utils.js";
import { ConvexError } from "../../values/errors.js";
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
    const queryArgs = parseArgs(args[0]);
    const name = getFunctionName(query);
    const queryResult = this.queryResults.get(
      serializePathAndArgs(name, queryArgs)
    );
    if (queryResult === void 0) {
      return void 0;
    }
    return OptimisticLocalStoreImpl.queryValue(queryResult.result);
  }
  getAllQueries(query) {
    const queriesWithName = [];
    const name = getFunctionName(query);
    for (const queryResult of this.queryResults.values()) {
      if (queryResult.udfPath === canonicalizeUdfPath(name)) {
        queriesWithName.push({
          args: queryResult.args,
          value: OptimisticLocalStoreImpl.queryValue(queryResult.result)
        });
      }
    }
    return queriesWithName;
  }
  setQuery(queryReference, args, value) {
    const queryArgs = parseArgs(args);
    const name = getFunctionName(queryReference);
    const queryToken = serializePathAndArgs(name, queryArgs);
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
export class OptimisticQueryResults {
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
        throw forwardData(
          result,
          new ConvexError(
            createHybridErrorStacktrace("query", query.udfPath, result)
          )
        );
      }
      throw new Error(
        createHybridErrorStacktrace("query", query.udfPath, result)
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
