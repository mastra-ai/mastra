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
var hydration_exports = {};
__export(hydration_exports, {
  usePreloadedQuery: () => usePreloadedQuery
});
module.exports = __toCommonJS(hydration_exports);
var import_react = require("react");
var import_client = require("../react/client.js");
var import_api = require("../server/api.js");
var import_values = require("../values/index.js");
function usePreloadedQuery(preloadedQuery) {
  const args = (0, import_react.useMemo)(
    () => (0, import_values.jsonToConvex)(preloadedQuery._argsJSON),
    [preloadedQuery._argsJSON]
  );
  const preloadedResult = (0, import_react.useMemo)(
    () => (0, import_values.jsonToConvex)(preloadedQuery._valueJSON),
    [preloadedQuery._valueJSON]
  );
  const result = (0, import_client.useQuery)(
    (0, import_api.makeFunctionReference)(preloadedQuery._name),
    args
  );
  return result === void 0 ? preloadedResult : result;
}
//# sourceMappingURL=hydration.js.map
