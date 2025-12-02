"use strict";
var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { convexToJson } from "../values/index.js";
import { getFunctionName } from "../server/api.js";
export class QueriesObserver {
  constructor(createWatch) {
    __publicField(this, "createWatch");
    __publicField(this, "queries");
    __publicField(this, "listeners");
    this.createWatch = createWatch;
    this.queries = {};
    this.listeners = /* @__PURE__ */ new Set();
  }
  setQueries(newQueries) {
    for (const identifier of Object.keys(newQueries)) {
      const { query, args } = newQueries[identifier];
      getFunctionName(query);
      if (this.queries[identifier] === void 0) {
        this.addQuery(identifier, query, args);
      } else {
        const existingInfo = this.queries[identifier];
        if (getFunctionName(query) !== getFunctionName(existingInfo.query) || JSON.stringify(convexToJson(args)) !== JSON.stringify(convexToJson(existingInfo.args))) {
          this.removeQuery(identifier);
          this.addQuery(identifier, query, args);
        }
      }
    }
    for (const identifier of Object.keys(this.queries)) {
      if (newQueries[identifier] === void 0) {
        this.removeQuery(identifier);
      }
    }
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  getLocalResults(queries) {
    const result = {};
    for (const identifier of Object.keys(queries)) {
      const { query, args } = queries[identifier];
      getFunctionName(query);
      const watch = this.createWatch(query, args);
      let value;
      try {
        value = watch.localQueryResult();
      } catch (e) {
        if (e instanceof Error) {
          value = e;
        } else {
          throw e;
        }
      }
      result[identifier] = value;
    }
    return result;
  }
  setCreateWatch(createWatch) {
    this.createWatch = createWatch;
    for (const identifier of Object.keys(this.queries)) {
      const { query, args, watch } = this.queries[identifier];
      const journal = watch.journal();
      this.removeQuery(identifier);
      this.addQuery(identifier, query, args, journal);
    }
  }
  destroy() {
    for (const identifier of Object.keys(this.queries)) {
      this.removeQuery(identifier);
    }
    this.listeners = /* @__PURE__ */ new Set();
  }
  addQuery(identifier, query, args, journal) {
    if (this.queries[identifier] !== void 0) {
      throw new Error(
        `Tried to add a new query with identifier ${identifier} when it already exists.`
      );
    }
    const watch = this.createWatch(query, args, journal);
    const unsubscribe = watch.onUpdate(() => this.notifyListeners());
    this.queries[identifier] = {
      query,
      args,
      watch,
      unsubscribe
    };
  }
  removeQuery(identifier) {
    const info = this.queries[identifier];
    if (info === void 0) {
      throw new Error(`No query found with identifier ${identifier}.`);
    }
    info.unsubscribe();
    delete this.queries[identifier];
  }
  notifyListeners() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}
//# sourceMappingURL=queries_observer.js.map
