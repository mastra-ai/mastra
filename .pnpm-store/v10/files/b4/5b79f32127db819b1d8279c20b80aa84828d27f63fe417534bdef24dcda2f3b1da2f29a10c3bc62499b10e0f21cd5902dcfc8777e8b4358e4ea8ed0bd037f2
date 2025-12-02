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
var remote_query_set_exports = {};
__export(remote_query_set_exports, {
  RemoteQuerySet: () => RemoteQuerySet
});
module.exports = __toCommonJS(remote_query_set_exports);
var import_values = require("../../values/index.js");
var import_long = require("../../vendor/long.js");
var import_logging = require("../logging.js");
class RemoteQuerySet {
  constructor(queryPath, logger) {
    __publicField(this, "version");
    __publicField(this, "remoteQuerySet");
    __publicField(this, "queryPath");
    __publicField(this, "logger");
    this.version = { querySet: 0, ts: import_long.Long.fromNumber(0), identity: 0 };
    this.remoteQuerySet = /* @__PURE__ */ new Map();
    this.queryPath = queryPath;
    this.logger = logger;
  }
  transition(transition) {
    const start = transition.startVersion;
    if (this.version.querySet !== start.querySet || this.version.ts.notEquals(start.ts) || this.version.identity !== start.identity) {
      throw new Error(
        `Invalid start version: ${start.ts.toString()}:${start.querySet}:${start.identity}, transitioning from ${this.version.ts.toString()}:${this.version.querySet}:${this.version.identity}`
      );
    }
    for (const modification of transition.modifications) {
      switch (modification.type) {
        case "QueryUpdated": {
          const queryPath = this.queryPath(modification.queryId);
          if (queryPath) {
            for (const line of modification.logLines) {
              (0, import_logging.logForFunction)(this.logger, "info", "query", queryPath, line);
            }
          }
          const value = (0, import_values.jsonToConvex)(modification.value ?? null);
          this.remoteQuerySet.set(modification.queryId, {
            success: true,
            value,
            logLines: modification.logLines
          });
          break;
        }
        case "QueryFailed": {
          const queryPath = this.queryPath(modification.queryId);
          if (queryPath) {
            for (const line of modification.logLines) {
              (0, import_logging.logForFunction)(this.logger, "info", "query", queryPath, line);
            }
          }
          const { errorData } = modification;
          this.remoteQuerySet.set(modification.queryId, {
            success: false,
            errorMessage: modification.errorMessage,
            errorData: errorData !== void 0 ? (0, import_values.jsonToConvex)(errorData) : void 0,
            logLines: modification.logLines
          });
          break;
        }
        case "QueryRemoved": {
          this.remoteQuerySet.delete(modification.queryId);
          break;
        }
        default: {
          modification;
          throw new Error(`Invalid modification ${modification.type}`);
        }
      }
    }
    this.version = transition.endVersion;
  }
  remoteQueryResults() {
    return this.remoteQuerySet;
  }
  timestamp() {
    return this.version.ts;
  }
}
//# sourceMappingURL=remote_query_set.js.map
