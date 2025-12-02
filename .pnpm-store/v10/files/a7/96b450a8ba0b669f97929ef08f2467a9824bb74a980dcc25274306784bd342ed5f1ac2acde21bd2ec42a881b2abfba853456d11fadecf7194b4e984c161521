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
var udf_path_utils_exports = {};
__export(udf_path_utils_exports, {
  canonicalizeUdfPath: () => canonicalizeUdfPath,
  serializePathAndArgs: () => serializePathAndArgs
});
module.exports = __toCommonJS(udf_path_utils_exports);
var import_values = require("../../values/index.js");
function canonicalizeUdfPath(udfPath) {
  const pieces = udfPath.split(":");
  let moduleName;
  let functionName;
  if (pieces.length === 1) {
    moduleName = pieces[0];
    functionName = "default";
  } else {
    moduleName = pieces.slice(0, pieces.length - 1).join(":");
    functionName = pieces[pieces.length - 1];
  }
  if (moduleName.endsWith(".js")) {
    moduleName = moduleName.slice(0, -3);
  }
  return `${moduleName}:${functionName}`;
}
function serializePathAndArgs(udfPath, args) {
  return JSON.stringify({
    udfPath: canonicalizeUdfPath(udfPath),
    args: (0, import_values.convexToJson)(args)
  });
}
//# sourceMappingURL=udf_path_utils.js.map
