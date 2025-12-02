"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var api_exports = {};
__export(api_exports, {
  anyApi: () => anyApi,
  filterApi: () => filterApi,
  getFunctionName: () => getFunctionName,
  justActions: () => justActions,
  justInternal: () => justInternal,
  justMutations: () => justMutations,
  justPaginatedQueries: () => justPaginatedQueries,
  justPublic: () => justPublic,
  justQueries: () => justQueries,
  justSchedulable: () => justSchedulable,
  makeFunctionReference: () => makeFunctionReference
});
module.exports = __toCommonJS(api_exports);
var import_functionName = require("./functionName.js");
var import_paths = require("./components/paths.js");
function getFunctionName(functionReference) {
  const address = (0, import_paths.getFunctionAddress)(functionReference);
  if (address.name === void 0) {
    if (address.functionHandle !== void 0) {
      throw new Error(
        `Expected function reference like "api.file.func" or "internal.file.func", but received function handle ${address.functionHandle}`
      );
    } else if (address.reference !== void 0) {
      throw new Error(
        `Expected function reference in the current component like "api.file.func" or "internal.file.func", but received reference ${address.reference}`
      );
    }
    throw new Error(
      `Expected function reference like "api.file.func" or "internal.file.func", but received ${JSON.stringify(address)}`
    );
  }
  if (typeof functionReference === "string") return functionReference;
  const name = functionReference[import_functionName.functionName];
  if (!name) {
    throw new Error(`${functionReference} is not a functionReference`);
  }
  return name;
}
function makeFunctionReference(name) {
  return { [import_functionName.functionName]: name };
}
function createApi(pathParts = []) {
  const handler = {
    get(_, prop) {
      if (typeof prop === "string") {
        const newParts = [...pathParts, prop];
        return createApi(newParts);
      } else if (prop === import_functionName.functionName) {
        if (pathParts.length < 2) {
          const found = ["api", ...pathParts].join(".");
          throw new Error(
            `API path is expected to be of the form \`api.moduleName.functionName\`. Found: \`${found}\``
          );
        }
        const path = pathParts.slice(0, -1).join("/");
        const exportName = pathParts[pathParts.length - 1];
        if (exportName === "default") {
          return path;
        } else {
          return path + ":" + exportName;
        }
      } else if (prop === Symbol.toStringTag) {
        return "FunctionReference";
      } else {
        return void 0;
      }
    }
  };
  return new Proxy({}, handler);
}
function filterApi(api) {
  return api;
}
function justInternal(api) {
  return api;
}
function justPublic(api) {
  return api;
}
function justQueries(api) {
  return api;
}
function justMutations(api) {
  return api;
}
function justActions(api) {
  return api;
}
function justPaginatedQueries(api) {
  return api;
}
function justSchedulable(api) {
  return api;
}
const anyApi = createApi();
//# sourceMappingURL=api.js.map
