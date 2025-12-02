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
var queries_observer_exports = {};
__export(queries_observer_exports, {
  QueriesObserver: () => QueriesObserver
});
module.exports = __toCommonJS(queries_observer_exports);
var import_values = require("../values/index.js");
var import_api = require("../server/api.js");
class QueriesObserver {
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
      (0, import_api.getFunctionName)(query);
      if (this.queries[identifier] === void 0) {
        this.addQuery(identifier, query, args);
      } else {
        const existingInfo = this.queries[identifier];
        if ((0, import_api.getFunctionName)(query) !== (0, import_api.getFunctionName)(existingInfo.query) || JSON.stringify((0, import_values.convexToJson)(args)) !== JSON.stringify((0, import_values.convexToJson)(existingInfo.args))) {
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
      (0, import_api.getFunctionName)(query);
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
